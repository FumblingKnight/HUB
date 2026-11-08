const byId=id=>document.getElementById(id);
let current;
async function recall(q=''){
 current?.abort();current=new AbortController();
 byId('status').textContent='Loading fictional memory…';
 byId('profile').replaceChildren();byId('memories').replaceChildren();
 try{
  const r=await fetch('/api/mira/memory?'+new URLSearchParams({q}),{credentials:'same-origin',cache:'no-store',signal:current.signal});
  if(r.status===401){byId('status').textContent='Sign in to Mira to open this page.';return;}
  if(!r.ok)throw Error('Unavailable');
  const data=await r.json();
  for(const [target,rows] of [['profile',data.profile],['memories',data.memories]]){
   for(const row of rows){
    const li=document.createElement('li');
    li.textContent=row.text??'Contested assertion — withheld.';
    const detail=document.createElement('small');
    detail.textContent=[row.status,row.at,row.path?.join(' → ')].filter(Boolean).join(' · ');
    li.append(detail);
    // Render source as plain text: fictional provenance, not a trusted instruction or destination.
    const source=document.createElement('small');source.textContent=row.source?.url??'';
    li.append(source);byId(target).append(li);
   }
  }
  byId('status').textContent=data.memories.length?'Fictional recall loaded.':'No episodic match. The explicit compact profile is shown separately.';
 }catch(e){if(e.name!=='AbortError')byId('status').textContent='Memory source unavailable. No details were exposed.';}
}
byId('search').addEventListener('submit',e=>{e.preventDefault();recall(byId('query').value);});
recall();
