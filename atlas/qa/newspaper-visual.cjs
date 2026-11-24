const {chromium}=require('playwright'), fs=require('node:fs'),assert=require('node:assert/strict');
const clip='https://www.youtube.com/watch?v=AbCdEfGhI_J',embed='https://www.youtube-nocookie.com/embed/AbCdEfGhI_J?autoplay=0&playsinline=1';
const headline='A telescope gets a sharper view of the night sky';
const lead={title:headline,video:{url:clip,title:'Example observatory demonstration'},url:'https://example.org/fictional/observatory',category:'Science',
summary:'The fictional Example Observatory tests an illustrative mirror. This is sample layout content, not real news.',why:'The sample distinguishes sources from editorial commentary.',
claims:[{text:'An explicitly fictional instrument was installed in this layout exercise.',source_urls:['https://example.org/fictional/observatory','https://example.net/fictional/data']}]};
const story=(i,desk)=>({title:'Fictional source-based investigation '+i+': where the evidence leads',url:'https://example.org/fictional/story-'+i,category:desk,
summary:'Synthetic reporting for visual and print testing. No factual claim about the world is made here.',
body_paragraphs:['This is a fictional article paragraph used to test a newspaper column. Real reporting should link the primary document, distinguish publication and occurrence dates, and identify uncertainty. The reader should be able to follow the story without mistaking a summary for source evidence.','The second original sample paragraph illustrates depth and reasonable line lengths. Every fact would require independent examination and clear citations before publication.'],
why:'It illustrates how the digital broadsheet handles detailed context.',
claims:[{text:'This is synthetic source-citation material, not factual reporting.',source_urls:['https://example.org/fictional/story-'+i]}]});
const sections=['World & Ideas','Engineering','Art & Culture','Science Beyond'].map((name,i)=>({name,description:'Original evidence, checked claims and critical context',stories:[story(i*2+1,name),story(i*2+2,name)]}));
const edition={edition_date:'2026-11-24',title:'A day worth reading',dek:'Fictional design exercise only.',lead,sections,
rabbit_hole:{title:'The original research desk',why:'A demonstration of primary-source reading beyond a headline.',url:'https://example.org/fictional/deeper'},
watch_next:[{topic:'The next unanswered question',trigger:'Look for the original new evidence'}],skip_today:'Weak repeated claims.',
newsroom:{version:1,editor_note:'A fictional edition used only to test actual pages, interaction, and printing.',illustration:{motif:'orbit',caption:'Original editorial motif',alt:'Illustrated planet ring.'},stages:[{role:'critique',note:'Source links and safety were challenged in this fictional test.'}]}};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 fs.mkdirSync('artifacts',{recursive:true});
 try{
 for(const [name,width,height] of [['desktop',1440,1020],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.route('**/api/mira/newspaper',route=>route.fulfill({json:{morning:edition,stories:[{id:'synthetic',title:'Radio telescope',lane:'core',url:'https://example.org/fictional/radio'}],stats:{}}}));
  let external=0;await page.route('https://www.youtube-nocookie.com/**',route=>{external++;return route.fulfill({status:200,contentType:'text/html',body:'<h1>Test player</h1>'})});
  await page.goto('http://127.0.0.1:8765/newspaper.html');await page.getByRole('heading',{name:headline,exact:true}).waitFor();
  assert.equal(await page.locator('.paper-sheet').count(),6);
  assert.equal(await page.locator('.paper-sheet:not([hidden])').count(),1);
  assert.ok(await page.getByRole('img',{name:'Illustrated planet ring.'}).isVisible());
  assert.equal(await page.getByRole('link',{name:/Source 2/}).getAttribute('href'),'https://example.net/fictional/data');
  assert.equal(await page.locator('iframe').count(),0);assert.equal(external,0);
  await page.screenshot({path:'artifacts/newspaper-multipage-'+name+'-front.png',fullPage:true});
  await page.locator('.paper-navigation [data-paper-go="1"]').click();
  assert.ok(await page.getByRole('heading',{name:'World & Ideas'}).isVisible());assert.equal(new URL(page.url()).hash,'#page-2');
  assert.ok(await page.locator('.paper-story-body p').first().isVisible());
  if(name==='desktop')await page.screenshot({path:'artifacts/newspaper-multipage-desktop-interior.png',fullPage:true});
  await page.locator('.paper-navigation [data-paper-go="5"]').click();
  assert.ok(await page.getByRole('heading',{name:'Before you fold the paper.'}).isVisible());
  if(name==='desktop')await page.screenshot({path:'artifacts/newspaper-multipage-desktop-back.png',fullPage:true});
  await page.locator('.paper-navigation [data-paper-go="0"]').click();
  const request=page.waitForRequest(embed);await page.getByRole('button',{name:'Load video'}).click();const q=await request;
  assert.equal((await q.allHeaders()).referer,'http://127.0.0.1:8765/');
  assert.equal(external,1);assert.equal(await page.locator('iframe').count(),1);
  await page.locator('.paper-navigation [data-paper-go="1"]').click();
  assert.equal(await page.locator('iframe').count(),0,'turning page stops video');
  await page.getByRole('button',{name:'Live desk',exact:true}).click();
  assert.ok(await page.getByLabel('Find in the live desk').isVisible());
  await page.getByRole('button',{name:'Morning edition',exact:true}).click();
  const geom=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:window.innerWidth}));
  assert.ok(geom.scroll<=geom.width,JSON.stringify(geom));
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.paper-sheet:visible').count(),6);
  assert.equal(await page.locator('iframe:visible').count(),0);
  if(name==='desktop'){await page.pdf({path:'artifacts/newspaper-multipage-print.pdf',preferCSSPageSize:true,printBackground:true});const pdf=fs.readFileSync('artifacts/newspaper-multipage-print.pdf').toString('latin1');const sheets=(pdf.match(/[/]Type\s*[/]Page\b/g)||[]).length;assert.equal(sheets,6,'the six rendered sheets must be exactly six physical PDF pages');}
  await page.close();
 }
 } finally {await browser.close()}
 console.log('Six-sheet paper, mobile/desktop, source citations, page turn, video privacy, and print passed');
})().catch(e=>{console.error(e);process.exitCode=1});
