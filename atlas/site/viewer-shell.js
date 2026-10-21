// Viewer-only navigation. No private API calls, no write permission, no external fonts.
(() => {
  if (document.querySelector('.mira-rail')) return;
  const path = location.pathname;
  const landing = path === '/' || path === '/index.html';
  const destinations = [
    {label:'Home',href:'/home.html',tag:'home'},
    {label:'Signals',href:'/mira.html',tag:'signals'},
    {label:'Memory',href:'/context.html',tag:'memory'},
    {label:'Project',href:'/status.html',tag:'project'},
    {label:'Library',href:'/',tag:'library'}
  ];
  document.body.classList.add('viewer-ui');
  if (landing) document.body.classList.add('atlas-page');
  const rail=document.createElement('header');rail.className='mira-rail';
  const brand=document.createElement('a');brand.className='mira-logo';brand.href='/home.html';brand.setAttribute('aria-label','Mira Home');
  const symbol=document.createElement('span');symbol.className='mira-mark';symbol.textContent='✳';symbol.setAttribute('aria-hidden','true');
  const lettering=document.createElement('span');lettering.className='mira-logo-name';lettering.textContent='mira'; 
  const edition=document.createElement('span');edition.className='mira-logo-caption';edition.textContent='PRIVATE SPACE';
  const markText=document.createElement('span');markText.className='mira-brand-type';markText.append(lettering,edition);
  brand.append(symbol,markText);rail.append(brand);
  const marker=document.createElement('span');marker.className='mira-nav-caption';marker.textContent='YOUR SPACE';rail.append(marker);
  const nav=document.createElement('nav');nav.className='mira-nav';nav.setAttribute('aria-label','Mira sections');
  for (const item of destinations) {
    const a=document.createElement('a');a.href=item.href;a.className='mira-nav-item';
    if ((item.tag==='library'&&landing)||(item.tag==='signals'&&path==='/story.html')||(item.tag!=='library'&&path===item.href)) {a.setAttribute('aria-current','page');a.classList.add('selected');}
    const shape=document.createElement('span');shape.className='mira-nav-shape mira-nav-'+item.tag;shape.setAttribute('aria-hidden','true');
    shape.textContent={home:'⌂',signals:'✦',memory:'▤',project:'◫',library:'▦'}[item.tag];
    const label=document.createElement('span');label.textContent=item.label;a.append(shape,label);nav.append(a);
  }
  rail.append(nav);
  const foot=document.createElement('div');foot.className='mira-rail-footer';
  const icon=document.createElement('span');icon.className='mira-secure-dot';icon.setAttribute('aria-hidden','true');
  const msg=document.createElement('span');msg.textContent='Private workspace';
  foot.append(icon,msg);rail.append(foot);
  document.body.prepend(rail);
  // Keep the existing ATLAS status/logout functionality intact in its original header.
})();