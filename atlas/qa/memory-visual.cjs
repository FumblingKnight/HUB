const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 fs.mkdirSync('artifacts',{recursive:true});const results=[];
 for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.goto('http://127.0.0.1:8765/memory.html');
  await page.getByLabel('What would you like to recall?').fill('coaching');
  await page.getByRole('button',{name:'Recall',exact:true}).click();
  await page.getByText('Connected examples found.',{exact:false}).waitFor();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow)throw Error('horizontal overflow '+label);
  if(await page.getByText('Neri now prefers written lessons.',{exact:true}).count()!==1)throw Error('duplicate profile');
  if(await page.getByText('https://example.org/fictional/e2',{exact:true}).isVisible())throw Error('expanded evidence');
  await page.screenshot({path:'artifacts/'+label+'.png',fullPage:true});
  await page.getByText('Evidence and connection',{exact:true}).last().press('Enter');
  if(!await page.getByText('https://example.org/fictional/e2',{exact:true}).isVisible())throw Error('evidence missing');
  await page.getByLabel('What would you like to recall?').fill('orbital mechanics');
  await page.getByRole('button',{name:'Recall',exact:true}).click();
  await page.getByText('No connections for this query.',{exact:false}).waitFor();
  await page.goto('http://127.0.0.1:8765/context.html?q=coaching');
  await page.getByText('Nothing saved for this topic yet.',{exact:false}).waitFor();
  await page.screenshot({path:'artifacts/context-'+label+'.png',fullPage:true});
  await page.goto('http://127.0.0.1:8765/home.html');
  if(await page.locator('a[href="/memory.html"]').count())throw Error('prominent demo');
  await page.screenshot({path:'artifacts/home-'+label+'.png',fullPage:true});
  results.push({viewport:label,overflow:false,profile_deduplicated:true,evidence_hidden_then_expanded:true,unrelated_empty_state:true,home_demo_removed:true});
  await page.close();
 }
 await browser.close();fs.writeFileSync('artifacts/visual.json',JSON.stringify({fixture:'Work-cloud static render; not live signed-in production',results},null,2));
 console.log(results);
})().catch(e=>{console.error(e);process.exitCode=1});
