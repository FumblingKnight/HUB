const byId=id=>document.getElementById(id);
const node=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=String(text);return x;};
let current;
function card(row,association){
 const article=node('article');article.className='example-card';
 article.append(node('p',row.text??'Conflicting accounts — this statement is withheld.'));
 const details=node('details'),summary=node('summary','Evidence and connection');
 details.append(summary);
 const list=node('dl');
 for(const [label,value] of [
  ['Status',row.status],['Recorded',row.at],['Source',row.source?.url],
  ['Source note',row.source?.observation],['Record',row.id],
  ['Connection',association?.path?.length>1?'Shared entity · '+association.path.join(' → '):'Direct tag or entity match'],
 ]){
  if(value){list.append(node('dt',label),node('dd',value));}
 }
 details.append(list);article.append(details);return article;
}
async function recall(q=''){
 current?.abort();const controller=new AbortController();current=controller;
 byId('status').textContent='Finding connections…';
 byId('profile').replaceChildren();byId('memories').replaceChildren();
 try{
  const r=await fetch('/api/mira/memory?'+new URLSearchParams({q}),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
  if(r.status===401){byId('status').textContent='Sign in to Mira to open this example.';return;}
  if(!r.ok)throw Error('Unavailable');
  const data=await r.json();if(current!==controller)return;
  const profiles=Array.isArray(data.profile)?data.profile:[],memories=Array.isArray(data.memories)?data.memories:[];
  const seen=new Set();
  for(const row of profiles){
   if(seen.has(row.id)||seen.has(row.text))continue;
   seen.add(row.id);if(row.text)seen.add(row.text);
   byId('profile').append(card(row,memories.find(x=>x.id===row.id)));
  }
  let count=0;
  for(const row of memories){
   if(seen.has(row.id)||(row.text&&seen.has(row.text)))continue;
   seen.add(row.id);if(row.text)seen.add(row.text);
   byId('memories').append(card(row,row));count++;
  }
  if(!profiles.length)byId('profile').append(node('p','No example profile available.'));
  if(!count){const p=node('p',q?'No connections for this query. Try “coaching” or “save”.':'Enter a topic to explore the example.');p.className='example-empty';byId('memories').append(p);}
  byId('status').textContent=count?'Connected examples found. Open evidence for the source and link.':'Fictional example only — your saved memory is separate.';
 }catch(e){if(e.name!=='AbortError'&&current===controller)byId('status').textContent='The example is temporarily unavailable. Your saved memory is separate.';}
}
byId('search').addEventListener('submit',e=>{e.preventDefault();recall(byId('query').value.trim());});
recall();
