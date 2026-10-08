import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import vm from 'node:vm';
const scope={window:{},URL};
vm.createContext(scope);
for(const file of ['assets/site-config.js','assets/content-render.js','assets/contact.js']) vm.runInContext(await readFile(file,'utf8'),scope);
const site=scope.window.VORTEK_SITE,render=scope.window.VORTEK_RENDER;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const publicSite=process.env.PUBLIC_SITE_URL;
let publicURL;
if(publicSite){publicURL=new URL(publicSite);if(!['http:','https:'].includes(publicURL.protocol))throw Error('PUBLIC_SITE_URL deve usar HTTP ou HTTPS.');}
await mkdir('dist',{recursive:true});
for(const file of ['index.html','templates.html','experiencia.html','favoritos.html','prospeccao.html']) {
  let html=await readFile(file,'utf8');
  html=html.replace(/(<div[^>]*data-content="(\w+)"[^>]*>)(<\/div>)/g,(_,open,name,close)=>open+(render[name]?.(site) || '')+close);
  html=html.replace('<div class="grid" id="featuredGrid"></div>','<div class="grid" id="featuredGrid">'+site.templates.filter(t=>['essencial','perspectiva','studio'].includes(t.id)).map(t=>render.card(t)).join('')+'</div>');
  html=html.replace('<div class="grid" id="allGrid"></div>','<div class="grid" id="allGrid">'+site.templates.map(t=>render.card(t)).join('')+'</div>');
  html=html.replace('<option value="">Selecione uma opção</option>','<option value="">Selecione uma opção</option>'+[...site.services.map(s=>s.name),'Ainda preciso de orientação'].map(s=>`<option value="${escape(s)}">${escape(s)}</option>`).join(''));
  html=html.replace(/(<a[^>]*data-whatsapp[^>]*href=")[^"]*(")/g,(_,start,end)=>start+escape(scope.window.VORTEK_CONTACT.link(site.whatsapp,site.message))+end);
  html=html.replace(/(<p[^>]*data-contact-label[^>]*>)[^<]*(<\/p>)/g,(_,open,close)=>open+escape(site.whatsappLabel)+close);
  if(publicURL && file!=='prospeccao.html'){
    const pageURL=new URL(file==='index.html'?'./':file,publicURL).href;
    html=html.replace('</head>',`<link rel="canonical" href="${escape(pageURL)}"><meta property="og:url" content="${escape(pageURL)}"></head>`);
    html=html.replace('content="assets/vortek-social.png"',`content="${escape(new URL('assets/vortek-social.png',publicURL).href)}"`);
  }
  await writeFile('dist/'+file,html);
}
await cp('assets','dist/assets',{recursive:true});
console.log('Vortek: páginas e conteúdo pré-renderizado sincronizados em dist/.');
