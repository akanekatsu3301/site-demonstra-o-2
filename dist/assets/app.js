document.documentElement.classList.add('js-enabled');
const site=window.VORTEK_SITE, templates=site.templates;
let favorites=[];try{const saved=JSON.parse(localStorage.getItem('vortek-favorites')||localStorage.getItem('forma-favorites')||'[]');if(Array.isArray(saved))favorites=saved.filter(id=>templates.some(t=>t.id===id))}catch{}let category='Todos';const categories=['Todos',...new Set(templates.map(t=>t.category))];
function card(t){return window.VORTEK_RENDER.card(t,favorites)}
function render(){const visible=templates.filter(t=>category==='Todos'||t.category===category);if(document.getElementById('featuredGrid'))document.getElementById('featuredGrid').innerHTML=templates.filter(t=>['essencial','perspectiva','studio'].includes(t.id)).map(card).join('');['allGrid'].forEach(id=>document.getElementById(id) && (document.getElementById(id).innerHTML=visible.map(card).join('')));['allFilters'].forEach(id=>document.getElementById(id) && (document.getElementById(id).innerHTML=categories.map(c=>`<button class="filter ${category===c?'active':''}" data-category="${c}" aria-pressed="${category===c}">${c}</button>`).join('')));if(document.getElementById('favoritesGrid'))document.getElementById('favoritesGrid').innerHTML=templates.filter(t=>favorites.includes(t.id)).map(card).join('');if(document.getElementById('empty'))document.getElementById('empty').hidden=favorites.length>0}render();
document.addEventListener('click',e=>{const filter=e.target.closest('[data-category]');if(filter){const filterGroup=filter.parentElement.id;category=filter.dataset.category;render();const updated=document.querySelector(`#${filterGroup} [data-category="${category}"]`);updated?.focus()}const fav=e.target.closest('[data-favorite]');if(fav){const id=fav.dataset.favorite;favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];try{localStorage.setItem('vortek-favorites',JSON.stringify(favorites))}catch{}const gridId=fav.closest('.grid').id;render();document.querySelector(`#${gridId} [data-favorite="${id}"]`)?.focus()}const open=e.target.closest('[data-preview]');if(open){const t=templates.find(t=>t.id===open.dataset.preview);document.getElementById('previewTitle').textContent=t.name+' / '+t.category;const demo=document.getElementById('demo');demo.className='demo '+t.style;demo.innerHTML=`<div class="eyebrow">${t.brand}</div><h2>${t.title}</h2><p>${t.description}</p><div class="demoboxes">${t.items.map(i=>`<div class="demobox">${i} ↗</div>`).join('')}</div>`;document.getElementById('preview').showModal()}});
const dialog=document.getElementById('preview');document.getElementById('closePreview')?.addEventListener('click',()=>dialog?.close());dialog?.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
const stage = document.getElementById('stage');
const cube = document.getElementById('cube');
let rx = -22, ry = 35;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
// O mesmo conteúdo é pré-renderizado no build para permanecer disponível sem JS.
document.querySelectorAll('[data-content]').forEach(el=>{
  const renderer=window.VORTEK_RENDER?.[el.dataset.content];
  if(renderer)el.innerHTML=renderer(site);
});
const contact=window.VORTEK_CONTACT;
document.querySelectorAll('[data-whatsapp]').forEach(a=>{
  a.href=contact.link(site.whatsapp,site.message);a.target='_blank';a.rel='noopener noreferrer';
});
document.querySelectorAll('[data-contact-label]').forEach(el=>el.textContent=site.whatsappLabel);
const menu=document.querySelector('.menu-toggle'),nav=document.getElementById('site-nav');
function closeMenu(){menu?.setAttribute('aria-expanded','false');nav?.classList.remove('open');}
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);});
nav?.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape' && menu?.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
const quoteForm=document.getElementById('quote-form');
if(quoteForm){
  const select=quoteForm.elements.service;
  for(const service of site.services){if(![...select.options].some(o=>o.value===service.name)){const option=document.createElement('option');option.value=option.textContent=service.name;select.append(option);}}
  if(![...select.options].some(o=>o.value==='Ainda preciso de orientação')){const option=document.createElement('option');option.value=option.textContent='Ainda preciso de orientação';select.append(option);}
  let quote='';
  quoteForm.addEventListener('input',()=>{document.getElementById('quote-result').hidden=true;});
  quoteForm.addEventListener('submit',e=>{
    e.preventDefault();if(!quoteForm.reportValidity())return;
    try{
      quote=contact.quote(Object.fromEntries(new FormData(quoteForm)),templates.filter(t=>favorites.includes(t.id)).map(t=>t.name));
      document.getElementById('quote-whatsapp').href=contact.link(site.whatsapp,quote);
      document.getElementById('quote-status').textContent='Seu pedido está pronto. Abra o WhatsApp para revisar e enviar a mensagem à Vortek.';
      document.getElementById('copy-status').textContent='';document.getElementById('quote-result').hidden=false;
    }catch(error){document.getElementById('quote-result').hidden=false;document.getElementById('quote-status').textContent=error.message;document.getElementById('quote-whatsapp').removeAttribute('href');}
  });
  document.getElementById('copy-quote')?.addEventListener('click',async()=>{
    try{if(!quote)return;await navigator.clipboard.writeText(quote);document.getElementById('copy-status').textContent='Mensagem copiada. Você pode colar na conversa com a Vortek.';}
    catch{document.getElementById('copy-status').textContent='A cópia não está disponível neste navegador. Use o botão para abrir o WhatsApp.';}
  });
  document.addEventListener('click',e=>{const a=e.target.closest('[data-service]');if(a){select.value=a.dataset.service;document.getElementById('quote-result').hidden=true;}});
}
dialog?.addEventListener('close',()=>document.getElementById('previewQuote')?.remove());
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-preview]');if(!button)return;
  document.getElementById('previewQuote')?.remove();
  const a=document.createElement('a');a.id='previewQuote';a.className='btn primary demo-cta';a.href='index.html#orcamento';a.textContent='Quero conversar sobre meu site ↗';document.getElementById('demo').append(a);
});
function rotate(x, y) {
  rx = x; ry = y;
  cube.style.setProperty('--rx', x + 'deg');
  cube.style.setProperty('--ry', y + 'deg');
  document.getElementById('coords').textContent = `X ${Math.round(x)} / Y ${Math.round(y)}`;
}
if (stage && cube) {
  let drag = null;
  let suppressClick = false;
  const hint = stage.querySelector('.stage-label');
  if (matchMedia('(pointer: coarse)').matches) {
    hint.textContent = 'ARRASTE O DEDO. MUDE A PERSPECTIVA. ↗';
  }
  // Touch events keep finger movement independent of pointer-event support.
  let lastTouchTime = 0;
  stage.addEventListener('touchstart', e => {
    if (drag || e.touches.length !== 1) return;
    if (e.cancelable) e.preventDefault();
    const touch = e.changedTouches[0];
    lastTouchTime = Date.now();
    suppressClick = false;
    drag = { id: touch.identifier, x: touch.clientX, y: touch.clientY, rx, ry, touch: true, moved: false };
    stage.classList.add('dragging');
  }, { passive: false });
  stage.addEventListener('touchmove', e => {
    if (!drag || !drag.touch) return;
    if (e.cancelable) e.preventDefault();
    const touch = Array.from(e.touches).find(t => t.identifier === drag.id);
    if (!touch) return;
    const dx = touch.clientX - drag.x, dy = touch.clientY - drag.y;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    rotate(drag.rx - dy * 0.4, drag.ry + dx * 0.4);
  }, { passive: false });
  function finishTouch(e) {
    if (!drag || !drag.touch) return;
    if (!Array.from(e.changedTouches).some(t => t.identifier === drag.id)) return;
    if (e.cancelable) e.preventDefault();
    const tap = !drag.moved && e.type === 'touchend';
    drag = null;
    lastTouchTime = Date.now();
    stage.classList.remove('dragging');
    if (tap) rotate(rx, ry + 90);
  }
  stage.addEventListener('touchend', finishTouch, { passive: false });
  stage.addEventListener('touchcancel', finishTouch, { passive: false });
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'pen' || !e.isPrimary || drag) return;
    suppressClick = false;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, rx, ry };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove', e => {
    if (drag && !drag.touch && drag.id === e.pointerId) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 5) suppressClick = true;
      rotate(drag.rx - dy * 0.4, drag.ry + dx * 0.4);
      return;
    }
    if (e.pointerType !== 'mouse' || reduced.matches || drag) return;
    const r = stage.getBoundingClientRect();
    rotate(-22 - (e.clientY - r.top - r.height / 2) / 9,
      35 + (e.clientX - r.left - r.width / 2) / 7);
  });
  function finishDrag(e) {
    if (!drag || drag.touch || drag.id !== e.pointerId) return;
    if (e.type === 'pointercancel') suppressClick = true;
    drag = null;
    stage.classList.remove('dragging');
    if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
  }
  stage.addEventListener('pointerup', finishDrag);
  stage.addEventListener('pointercancel', finishDrag);
  stage.addEventListener('lostpointercapture', finishDrag);
  stage.addEventListener('pointerleave', e => {
    if (e.pointerType === 'mouse' && !drag) rotate(-22, 35);
  });
  stage.addEventListener('click', e => {
    if (e.detail !== 0 && Date.now() - lastTouchTime < 800) return;
    if (suppressClick && e.detail !== 0) { suppressClick = false; return; }
    rotate(rx, ry + 90);
  });
  stage.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      rotate(rx + (e.key === 'ArrowUp' ? -15 : e.key === 'ArrowDown' ? 15 : 0),
        ry + (e.key === 'ArrowLeft' ? -15 : e.key === 'ArrowRight' ? 15 : 0));
    }
  });
}

