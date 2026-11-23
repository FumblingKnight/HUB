import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const here=new URL('.',import.meta.url);
let src;
try{src=fs.readFileSync(new URL('../site/newspaper.js',here),'utf8')}catch(e){
 if(!process.env.MIRA_LOCAL_FIXTURE)throw e;
 src=fs.readFileSync(new URL('newspaper.js',here),'utf8');
}
function harness(input={}){
 const nodes={}; const get=id=>nodes[id] ||= {innerHTML:'',dataset:{}, addEventListener(){}};
 const doc={body:{dataset:{}},getElementById:get,querySelectorAll:()=>[],addEventListener(){}};
 const ctx=vm.createContext({document:doc,URL,Intl,setInterval:()=>0,fetch:()=>new Promise(()=>{}),window:{},sample:input});
 vm.runInContext(src,ctx); vm.runInContext('DATA={stories:[],stats:{},...sample};morning();sectionRender();',ctx);
 return {html:get('morning-content').innerHTML,ctx,get};
}
const lead={title:'A paper about a telescope',category:'Science',url:'https://example.org/telescope',summary:'Synthetic test summary.'};
const leadURL=lead.url;
test('published newsroom edition shows editor, illustration, exact citations and completed roles',()=>{
 const a='https://example.org/original',b='https://example.net/official';
 const {html}=harness({morning:{edition_date:'2026-11-24',title:'Edition title',lead:{...lead,claims:[{text:'Verified claim A',source_urls:[a]},{text:'Verified claim B',source_urls:[a,b]}]},sections:[{name:'Science desk',stories:[lead,{title:'Other story',url:b}]}], newsroom:{version:1,editor_note:'Good morning.',stages:[{role:'reporting',note:'Two sources opened'},{role:'critique',note:'Fact-checked'}],illustration:{motif:'orbit',alt:'Planet with orbit lines',caption:'House engraving'}}}});
 assert.match(html,/Tuesday 24 November 2026|Tuesday, 24 November 2026/);
 assert.match(html,/Good morning\./);assert.match(html,/aria-label="Planet with orbit lines"/);assert.match(html,/Editorial illustration/i);
 assert.match(html,/Verified claim A.*Source 1/);assert.match(html,/Verified claim B.*Source 1.*Source 2/);
 assert.match(html,/Two sources opened/); assert.match(html,/Fact-checked/);
 assert.equal(html.split('A paper about a telescope').length-1,1); assert.match(html,/Other story/);
 assert.match(html,/rel="noopener noreferrer"/);
});
test('legacy edition renders without fabricated roles and no-edition fallback shows the 8 a.m. start',()=>{
 const old=harness({morning:{edition_date:'2026-11-07',title:'Old edition',dek:'Older editor summary.',lead,sections:[]}});
 assert.match(old.html,/Old edition/);assert.match(old.html,/Older editor summary/);
 assert.match(old.html,/Abstract geometric engraving/);assert.doesNotMatch(old.html,/How this edition was made/);
 assert.match(harness().html,/8:00 a.m. India time/);
});
test('untrusted text is escaped, unsafe citations are omitted, arbitrary art and stage types fall back',()=>{
 const evil='<script>alert(1)</script>';
 const {html}=harness({morning:{title:evil,lead:{...lead,url:'javascript:alert(1)',claims:[{text:evil,source_urls:['javascript:alert(2)','http://example.net/a','https://user:password@example.net/a','https://example.net/a']},{text:'Unsourced',source_urls:['javascript:alert(2)']}]},newsroom:{version:1,editor_note:evil,illustration:{motif:{toString:null},alt:evil,caption:evil},stages:[{role:{toString:null},note:evil},{role:'critique',note:evil}]}}});
 assert.doesNotMatch(html,/<script>|href="javascript:|href="http:|user:password|Unsourced/);
 assert.match(html,/&lt;script&gt;alert/);
 assert.match(html,/Abstract geometric engraving/);
 assert.match(html,/Fact-check &amp; critique/);
});
test('live filter and live search intersect, navigation preserves renderability',()=>{
 const {ctx,get}=harness({stories:[{id:'a',title:'Radio telescope',lane:'core'},{id:'b',title:'Radio receiver',lane:'wildcard'},{id:'c',title:'Power unit',lane:'core'}]});
 vm.runInContext("TERM='radio'; FILTER='core'; navigate('live'); sectionRender()",ctx);
 const result=get('live-stories').innerHTML;
 assert.match(result,/Radio telescope/);assert.doesNotMatch(result,/Radio receiver|Power unit/);
 assert.match(result,/Follow updates|Worth more/);assert.equal(ctx.document.body.dataset.editionView,'live');
});

test('only audited-shape canonical YouTube video choices render, never eager frames',()=>{
 const href='https://www.youtube.com/watch?v=AbCdEfGhI_J';
 const {html,ctx}=harness({morning:{lead:{...lead,video:{url:href,title:'<em>Primary source clip</em>'}}}});
 assert.match(html,/Official footage/);
 assert.match(html,/aria-expanded="false">Load video/);
 assert.match(html,/href="https:\/\/www\.youtube\.com\/watch\?v=AbCdEfGhI_J"/);
 assert.match(html,/&lt;em&gt;Primary source clip&lt;\/em&gt;/);
 assert.doesNotMatch(html,/<iframe|youtube-nocookie|ytimg/);
 for(const url of ['javascript:alert(1)','https://www.youtube.com.evil.org/watch?v=AbCdEfGhI_J',
     'https://www.youtube.com/watch?v=AbCdEfGhI_J&autoplay=1','https://www.youtube.com:443/watch?v=AbCdEfGhI_J',
     'https://www.youtube-nocookie.com/embed/AbCdEfGhI_J','https://youtu.be/AbCdEfGhI_J']){
   ctx.suspect={url,title:'Untrusted link'};
   assert.equal(vm.runInContext('pressVideo(suspect)',ctx),'');
 }
});

test('old morning issue is labelled archived even when recent hourly publication exists',()=>{
 const old=harness({published_at:new Date().toISOString(),morning:{edition_date:'2026-11-07',title:'Old masthead',lead,sections:[]}});
 assert.match(old.html,/Archive edition from/);
 assert.match(old.html,/Today.s morning paper has not been published/);
 vm.runInContext("rail()",old.ctx);
 assert.match(old.get('top-status').textContent,/Morning paper .* days old/);
 vm.runInContext("navigate('live')",old.ctx);
 assert.match(old.get('top-status').textContent,/Live desk updated/);
});
test('invalid or future edition dates are never labelled current',()=>{
 const invalid=harness({morning:{edition_date:'2099-01-01',title:'Future edition',lead,sections:[]}});
 assert.match(invalid.html,/Edition date unavailable or invalid/);
 vm.runInContext("rail()",invalid.ctx);
 assert.equal(invalid.get('top-status').textContent,'No verified morning edition');
});

test('source-first excerpts show a short quote, attributed publisher and original link',()=>{
 const excerpt={text:'This experiment has produced a measured result.',source_url:'https://example.org/telescope',publisher:'Science Desk'};
 const {html}=harness({morning:{edition_date:'2026-11-24',lead:{...lead,source_excerpt:excerpt},sections:[]}});
 assert.match(html,/press-source-excerpt/);
 assert.match(html,/This experiment has produced a measured result/);
 assert.match(html,/Quoted from Science Desk/);
 assert.match(html,/cite="https:\/\/example.org\/telescope"/);
 assert.match(html,/Original source/);
});
test('untrusted excerpts fail closed and text never executes as markup',()=>{
 const extra={text:'A cited & quoted <script>example</script> from the report',source_url:'https://example.org/telescope',publisher:'A & B'};
 const {html}=harness({morning:{lead:{...lead,source_excerpt:extra},sections:[]}});
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
 for(const source_url of ['javascript:alert(1)','http://example.org/telescope','https://user:password@example.org/article']){
  const {html}=harness({morning:{lead:{...lead,source_excerpt:{...extra,source_url}},sections:[]}});
  assert.doesNotMatch(html,/press-source-excerpt/);
 }
 const over=harness({morning:{lead:{...lead,source_excerpt:{...extra,text:Array(26).fill('word').join(' ')}},sections:[]}});
 assert.doesNotMatch(over.html,/press-source-excerpt/);
});
