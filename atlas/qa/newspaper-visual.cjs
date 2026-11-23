const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const headline='A telescope gets a sharper view of the night sky';
const lead={title:headline,url:'https://example.org/fictional/observatory',category:'Science',
 summary:'The fictional Example Observatory is testing a new mirror on a demonstration telescope.',
 why:'Finer detail could help distinguish fainter targets.',
 claims:[{text:'The mirror was installed on the demonstration instrument.',source_urls:['https://example.org/fictional/observatory','https://example.net/fictional/data']}]};
const newsroom={version:1,editor_note:'This fictional edition checks the morning paper’s layout. Nothing on this page is real news.',
 stages:[{role:'critique',note:'Two fictional source links are shown alongside the claim.'}],
 illustration:{motif:'orbit',caption:'Sample house engraving',alt:'Illustrated planet ring.'}};
const edition={edition_date:'2026-11-24',title:'The day in focus',dek:'Sample data only.',lead,newsroom,
 sections:[{name:'Field notes',description:'What we know so far',stories:[lead,
  {title:'A greenhouse rethinks how to use less water',category:'Design',url:'https://example.org/fictional/greenhouse',summary:'A synthetic example about water use.'},
  {title:'A museum makes room for a new instrument',category:'Culture',url:'https://example.org/fictional/museum',summary:'A fictional exhibit example.'}]}]};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 fs.mkdirSync('artifacts',{recursive:true});
 try {
  for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   const page=await browser.newPage({viewport:{width,height}});
   await page.route('**/api/mira/newspaper',route=>route.fulfill({json:{morning:edition,
    stories:[{id:'synthetic',title:'Radio telescope',category:'Science',url:'https://example.org/fictional/radio',lane:'core'}],stats:{}}}));
   await page.goto('http://127.0.0.1:8765/newspaper.html');
   await page.getByRole('heading',{name:headline,exact:true}).waitFor();
   assert.equal(await page.getByRole('heading',{name:headline,exact:true}).count(),1);
   assert.equal(await page.getByRole('link',{name:/Source 2/}).getAttribute('href'),'https://example.net/fictional/data');
   assert.ok(await page.getByRole('img',{name:'Illustrated planet ring.'}).isVisible());
   const geometry=await page.evaluate(()=>{
    const art=document.querySelector('.press-art').getBoundingClientRect();
    const copy=document.querySelector('.press-lead .press-story-copy').getBoundingClientRect();
    return {overflow:document.documentElement.scrollWidth>innerWidth,artLeft:art.right<=copy.left,artBelow:art.top>=copy.bottom};
   });
   assert.deepEqual(geometry,{overflow:false,artLeft:label==='desktop',artBelow:label==='mobile'});
   await page.getByText('How this edition was made',{exact:true}).click();
   assert.ok(await page.getByText('Two fictional source links',{exact:false}).isVisible());
   await page.screenshot({path:'artifacts/newspaper-'+label+'.png',fullPage:true});
   await page.getByRole('button',{name:'Live desk',exact:true}).click();
   const search=page.getByLabel('Find in the live desk');
   await search.fill('geology');
   assert.ok(await page.getByText('No matching stories.').isVisible());
   await search.fill('radio');
   assert.ok(await page.getByRole('button',{name:'Follow updates'}).isVisible());
   await page.getByRole('button',{name:'Morning edition',exact:true}).click();
   await page.emulateMedia({media:'print'});
   assert.equal(await page.getByRole('navigation',{name:'Newspaper sections'}).isVisible(),false);
   assert.ok(await page.getByRole('heading',{name:headline,exact:true}).isVisible());
   assert.ok(await page.getByRole('link',{name:/Source 1/}).isVisible());
   if(label==='desktop')await page.pdf({path:'artifacts/newspaper-print.pdf',format:'A4'});
   await page.close();
  }
 } finally {await browser.close()}
 console.log('Synthetic newspaper desktop, mobile, search, citation and print checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
