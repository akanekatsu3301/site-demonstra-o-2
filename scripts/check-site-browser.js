// QA local opcional com Chrome/Edge instalado; não requer pacotes de automação.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import assert from 'node:assert/strict';
const browserPath=process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if(!browserPath)throw Error('Chrome/Edge não encontrado. Configure BROWSER_PATH.');
const base=process.argv[2] || 'http://127.0.0.1:3031';
const profile=mkdtempSync(join(tmpdir(),'vortek-browser-'));
const browser=spawn(browserPath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let socket;const pageErrors=[];
try {
 let port;for(let i=0;i<100;i++){await delay(100);const file=join(profile,'DevToolsActivePort');if(existsSync(file)){port=readFileSync(file,'utf8').split('\n')[0];break;}}
 if(!port)throw Error('O navegador não iniciou a depuração local.');
 const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
 let id=0;const calls=new Map();
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id && calls.has(m.id)){const item=calls.get(m.id);calls.delete(m.id);clearTimeout(item.timer);m.error?item.reject(Error(m.error.message)):item.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')pageErrors.push(m.params.exceptionDetails.text+': '+(m.params.exceptionDetails.exception?.description || ''));});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{calls.delete(key);reject(Error('Timeout CDP: '+method));},10000);calls.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description || 'Erro de avaliação');return result.result.value;};
 const navigate=async path=>{await send('Page.navigate',{url:base+path});for(let i=0;i<100;i++){await delay(50);if(await evaluate("document.readyState==='complete' && !!window.VORTEK_SITE"))return;}throw Error('Página não ficou pronta.');};
 await send('Runtime.enable');await send('Page.enable');
 mkdirSync('.qa',{recursive:true});
 for(const [name,width,height] of [['desktop',1440,1000],['tablet',820,1100],['mobile',390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:name==='mobile'});await navigate('/');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'Overflow em '+name);
  assert.equal(await evaluate("document.querySelectorAll('.service-row').length"),5);
  assert.equal(await evaluate("document.querySelectorAll('.faq-list details').length"),7);
  if(name==='mobile'){
    assert.equal(await evaluate("getComputedStyle(document.getElementById('site-nav')).display"),'none');
    await evaluate("document.querySelector('.menu-toggle').click()");assert.equal(await evaluate("document.querySelector('.menu-toggle').getAttribute('aria-expanded')"),'true');
    await evaluate("document.querySelector('#site-nav a').click()");assert.equal(await evaluate("document.querySelector('.menu-toggle').getAttribute('aria-expanded')"),'false');
  }
  await evaluate("window.scrollTo({top:0,behavior:'instant'})");await delay(100);
  const screenshot=await send('Page.captureScreenshot',{format:'png'});writeFileSync('.qa/'+name+'.png',Buffer.from(screenshot.data,'base64'));
 }
 await evaluate("document.querySelector('.faq-list summary').click()");assert.equal(await evaluate("document.querySelector('.faq-list details').open"),true);
 await evaluate("document.querySelector('[data-preview]').click()");assert.equal(await evaluate("document.getElementById('preview').open"),true);assert.ok(await evaluate("document.getElementById('previewQuote').href.includes('#orcamento')"));await evaluate("document.getElementById('closePreview').click()");
 await evaluate("document.querySelector('[data-favorite=essencial]').click()");
 await evaluate("const f=document.getElementById('quote-form');f.elements.name.value='Visitante de teste';f.elements.company.value='Empresa exclusiva de QA';f.elements.service.value='Sites institucionais';f.elements.message.value='Gostaria de apresentar os serviços da empresa.';f.requestSubmit();");
 const quoteURL=await evaluate("document.getElementById('quote-whatsapp').href");assert.equal(new URL(quoteURL).hostname,'wa.me');assert.equal(new URL(quoteURL).pathname,'/5583993448767');assert.ok(new URL(quoteURL).searchParams.get('text').includes('Essencial'));assert.equal(await evaluate("document.getElementById('quote-result').hidden"),false);
 const mobileContact=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:await evaluate("document.getElementById('orcamento').offsetTop"),width:390,height:Math.min(1350,await evaluate("document.getElementById('orcamento').offsetHeight")),scale:1}});writeFileSync('.qa/mobile-contact.png',Buffer.from(mobileContact.data,'base64'));
 await navigate('/templates.html');await evaluate("document.querySelector('[data-category=Institucional]').click()");assert.equal(await evaluate("document.querySelectorAll('#allGrid .card').length"),1);
 await navigate('/favoritos.html');assert.equal(await evaluate("document.querySelectorAll('#favoritesGrid .card').length"),1);
 await navigate('/experiencia.html');assert.equal(await evaluate("document.querySelectorAll('[data-content=process] .step').length"),3);
 assert.deepEqual(pageErrors,[]);
 console.log(JSON.stringify({ok:true,viewports:['1440px','820px','390px'],checks:['overflow','menu móvel','FAQ','prévia','favoritos','filtros','formulário/WhatsApp','páginas secundárias'],errors:pageErrors,screenshots:'.qa/'},null,2));
}finally{
 socket?.close();browser.kill();await delay(400);
 // Remove somente o perfil temporário criado por esta execução, dentro do tmpdir.
 if(dirname(resolve(profile))===resolve(tmpdir()) && basename(profile).startsWith('vortek-browser-'))try{rmSync(profile,{recursive:true,force:true});}catch{}
}
