import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase, saveLead, selectLeads } from '../server/database.js';
import { createOSMProvider, mapElement, buildQuery } from '../server/osm.js';
import { exportLeads } from '../server/export.js';

const fixture={source:'authorized',source_id:'test-only-1',name:'Registro exclusivo de teste',city:'Recife',state:'PE',segment:'Teste',phone:'123',website_status:'absent',permission_url:'https://example.org/permission',authorized:true,export_allowed:true};
const location=[{lat:'-8.06',lon:'-34.88',boundingbox:['-8.07','-8.05','-34.89','-34.87'],addresstype:'city',display_name:'Região exclusiva de teste',address:{'ISO3166-2-lvl4':'BR-PE'}}];
const elements=[{type:'node',id:100,tags:{name:'Padaria de teste',shop:'bakery','addr:city':'Recife','addr:state':'PE',phone:'123'}},{type:'way',id:101,tags:{name:'Segunda padaria de teste',shop:'bakery','contact:website':'example.org'}}];
const input={source:'osm',city:'Recife',state:'PE',segment:'padarias'};
const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
function legacy(db){db.prepare("INSERT INTO leads(source,source_id) VALUES('google','ChIJ_legacy_reference')").run();}

test('Migração de um arquivo SQLite antigo preserva leads e é idempotente',()=>{
 const path=join(tmpdir(),'vortek-migration-'+randomUUID()+'.sqlite');let db;
 try {
  db=new DatabaseSync(path);
  db.exec(`CREATE TABLE leads(id INTEGER PRIMARY KEY, source TEXT NOT NULL, source_id TEXT NOT NULL,
    name TEXT, phone TEXT, address TEXT, city TEXT, state TEXT, segment TEXT, website TEXT,
    website_status TEXT NOT NULL DEFAULT 'unknown', permission_url TEXT, export_allowed INTEGER NOT NULL DEFAULT 0,
    stage TEXT NOT NULL DEFAULT 'Novo', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(source,source_id));`);
  db.prepare("INSERT INTO leads(source,source_id,name,stage) VALUES('authorized','existing','Preservado','Qualificado')").run();db.close();db=null;
  for(let i=0;i<2;i++) {db=openDatabase(path);const lead=selectLeads(db)[0];assert.equal(lead.name,'Preservado');assert.equal(lead.stage,'Qualificado');assert.ok(Object.hasOwn(lead,'license'));assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='source_cache'").get());db.close();db=null;}
 }finally{db?.close();unlinkSync(path);}
});

test('SQLite: dados legados, autorização, salvar OSM verificado e deduplicação',async()=>{
 const db=openDatabase(':memory:');saveLead(db,fixture);saveLead(db,{...fixture,name:'Atualizado'});legacy(db);
 assert.equal(selectLeads(db).length,2);
 assert.equal(selectLeads(db,{city:'recife',state:'pe',segment:'teste',website_status:'absent',contact:'yes'}).length,1);
 assert.throws(()=>saveLead(db,{...fixture,authorized:false}),/autorização/);
 assert.throws(()=>saveLead(db,{...fixture,website:'javascript:alert(1)'}),/URL/);
 assert.throws(()=>saveLead(db,{source:'osm',source_id:'node/9999',name:'Inventado'}),/não consta/);
 const provider=createOSMProvider(db,{},async url=>response(String(url).includes('/search?')?location:{elements}));await provider.search(input);
 const saved=saveLead(db,{source:'osm',source_id:'node/100',name:'FORJADO',export_allowed:false});
 assert.equal(saved.name,'Padaria de teste');assert.equal(saved.export_allowed,1);assert.equal(saved.license,'ODbL-1.0');
 db.prepare('UPDATE leads SET stage=? WHERE id=?').run('Qualificado',saved.id);saveLead(db,{source:'osm',source_id:'node/100'});
 assert.equal(selectLeads(db).length,3);assert.equal(selectLeads(db,{segment:'padarias',website_status:'unidentified'}).length,1);
 assert.equal(selectLeads(db).find(l=>l.id===saved.id).stage,'Qualificado');assert.ok(selectLeads(db).some(l=>l.source==='google'));db.close();
});
test('CSV e Excel XML: licença OSM, elegibilidade e prevenção de fórmulas',()=>{
 const db=openDatabase(':memory:');saveLead(db,{...fixture,name:'=HYPERLINK("test")'});saveLead(db,{...fixture,source_id:'not-exportable',export_allowed:false,name:'PROIBIDO'});legacy(db);
 const osm=mapElement(elements[0]);db.prepare('INSERT INTO source_records(source_id,payload) VALUES(?,?)').run(osm.source_id,JSON.stringify(osm));saveLead(db,osm);
 const csv=exportLeads(selectLeads(db),'csv');for(const text of ["'=HYPERLINK",'Website não informado','ODbL-1.0','© OpenStreetMap contributors','https://www.openstreetmap.org/node/100'])assert.ok(csv.includes(text));assert.ok(!csv.includes('PROIBIDO'));assert.ok(!csv.includes('ChIJ'));
 const xml=exportLeads(selectLeads(db),'xml');assert.ok(xml.includes('Excel.Sheet'));assert.ok(xml.includes('&quot;test&quot;'));assert.ok(xml.includes('OpenStreetMap'));assert.ok(!xml.includes('PROIBIDO'));db.close();
});
test('Overpass: segmentos, escape, ausência de website e campos indisponíveis',()=>{
 const query=buildQuery({...input,q:'Loja " ; ); .*'},[-8,-35,-7,-34]);assert.ok(query.includes('["shop"="bakery"]'));assert.ok(query.includes('out tags center 101'));assert.ok(query.includes('\\"'));assert.ok(query.includes('\\\\.\\\\*'));
 assert.throws(()=>buildQuery({segment:'desconhecido'},[0,0,0,0]),/Segmento/);assert.throws(()=>buildQuery({},[0,0,0,0]),/Informe/);
 assert.equal(mapElement(elements[0]).website_status,'unidentified');const mapped=mapElement(elements[1]);assert.equal(mapped.website,'https://example.org/');assert.equal(mapped.city,'');assert.equal(mapped.phone,'');assert.equal(mapped.address,'');assert.equal(mapElement({type:'node',id:1,tags:{}}),null);assert.equal(mapElement({...elements[1],tags:{name:'Teste',website:'javascript:alert(1)'}}).website,'');
});
test('Cache persistente, buscas simultâneas, intervalos, limite e expiração',async()=>{
 const db=openDatabase(':memory:');let calls=0,now=100000;
 const provider=createOSMProvider(db,{now:()=>now,resultLimit:1},async(url,options)=>{calls++;assert.ok(options.headers['User-Agent'].includes('VORTEK'));if(String(url).includes('/search?'))return response(location);assert.equal(options.method,'POST');assert.ok(new URLSearchParams(options.body).get('data').includes('["shop"="bakery"]'));return response({elements});});
 const [first,parallel]=await Promise.all([provider.search(input),provider.search(input)]);assert.equal(calls,2);assert.equal(first.results.length,1);assert.equal(parallel.results[0].source_id,first.results[0].source_id);assert.equal(first.limited,true);
 assert.equal((await provider.search(input)).cached,true);assert.equal(calls,2);await assert.rejects(()=>provider.search({...input,q:'Outra'}),e=>e.status===429);
 now+=11000;await provider.search({...input,q:'Outra'});assert.equal(calls,3);
 const restarted=createOSMProvider(db,{now:()=>now,resultLimit:1},()=>{throw Error('não deveria consultar');});assert.equal((await restarted.search(input)).cached,true);
 now+=16*60000;await provider.search(input);assert.equal(calls,4);db.close();
});
test('Falhas: 429/Retry-After, rede, JSON inválido, resultado parcial e região ausente',async()=>{
 for(const kind of ['429','timeout','invalid','partial','empty']) {
  const db=openDatabase(':memory:');let calls=0;
  const provider=createOSMProvider(db,{now:()=>100000},async url=>{calls++;if(String(url).includes('/search?'))return response(kind==='empty'?[]:location);if(kind==='429')return new Response('',{status:429,headers:{'Retry-After':'120'}});if(kind==='timeout')throw Error('timeout');if(kind==='invalid')return new Response('<html>falha</html>');return response({elements,remark:'runtime error: Query timed out'});});
  await assert.rejects(()=>provider.search(input),e=>[429,504,502,404].includes(e.status));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM source_records').get().n,0);
  if(kind==='429'){assert.equal(db.prepare("SELECT next_at FROM service_limits WHERE service='overpass'").get().next_at,220000);await assert.rejects(()=>provider.search({...input,q:'Outro'}),e=>e.status===429);assert.equal(calls,2);}
  await assert.rejects(()=>provider.search({...input,city:''}),e=>e.status===400);db.close();
 }
});
test('HTTP ponta a ponta: pesquisa OSM, cache, CRUD, filtros, histórico e exportação',async()=>{
 let upstreamCalls=0;
 const upstream=http.createServer(async(req,res)=>{upstreamCalls++;for await(const _ of req){}res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url.startsWith('/search')?location:{elements}));});
 await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));const upstreamPort=upstream.address().port,token='test-token-abcdefghijklmnopqrstuvwxyz';
 const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:'0',DATABASE_PATH:':memory:',APP_TOKEN:token,NOMINATIM_URL:`http://127.0.0.1:${upstreamPort}/search`,OVERPASS_URL:`http://127.0.0.1:${upstreamPort}/interpreter`,SEARCHES_PER_MINUTE:'100'},stdio:['ignore','pipe','pipe']});
 try {
 const address=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Servidor não iniciou')),10000);child.stdout.once('data',chunk=>{clearTimeout(timeout);resolve(String(chunk).match(/http:\/\/\S+/)[0]);});child.once('exit',code=>{clearTimeout(timeout);reject(Error('Servidor encerrou: '+code));});});
 const call=(path,options={})=>fetch(address+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...options.headers}});
 const home=await (await call('/')).text();assert.ok(home.includes('Vortek'));assert.ok(home.includes('id="orcamento"'));
 const html=await (await call('/prospeccao.html')).text();assert.ok(html.includes('value="osm"'));assert.ok(html.includes('Website não informado'));assert.ok(!html.includes('GOOGLE_PLACES_API_KEY'));assert.equal((await call('/assets/prospect.js')).status,200);assert.equal((await fetch(address+'/api/leads')).status,401);assert.equal((await (await call('/api/status')).json()).credentials_required,false);
 assert.equal((await call('/api/leads',{method:'POST',body:'invalid'})).status,400);assert.equal((await call('/api/leads',{method:'POST',body:JSON.stringify(fixture),headers:{Origin:'https://untrusted.example'}})).status,403);
 const created=await (await call('/api/leads',{method:'POST',body:JSON.stringify(fixture)})).json();assert.ok(created.id);
 const local=await (await call('/api/search',{method:'POST',body:JSON.stringify({source:'authorized',q:'Registro'})})).json();assert.equal(local.results.length,1);
 const searched=await (await call('/api/search',{method:'POST',body:JSON.stringify(input)})).json();assert.equal(searched.results.length,2);assert.equal(upstreamCalls,2);
 assert.equal((await (await call('/api/search',{method:'POST',body:JSON.stringify(input)})).json()).cached,true);assert.equal(upstreamCalls,2);
 const osm=await (await call('/api/leads',{method:'POST',body:JSON.stringify({source:'osm',source_id:searched.results[0].source_id})})).json();assert.equal(osm.name,'Padaria de teste');assert.equal((await (await call('/api/leads?website_status=unidentified&contact=yes')).json()).length,1);
 assert.equal((await call('/api/leads/'+osm.id,{method:'PATCH',body:JSON.stringify({stage:'Qualificado'})})).status,200);assert.equal((await (await call('/api/stats')).json()).opportunities,1);
 assert.ok((await (await call('/api/export?format=csv&website_status=unidentified')).text()).includes('ODbL-1.0'));assert.ok((await (await call('/api/export?format=xml')).text()).includes('Excel.Sheet'));assert.equal((await call('/api/export?city=missing')).status,400);
 assert.equal((await call('/api/search',{method:'POST',body:JSON.stringify({source:'osm',q:'padarias'})})).status,400);assert.equal((await (await call('/api/history')).json()).length,4);
 assert.equal((await call('/api/leads/'+osm.id,{method:'DELETE'})).status,200);assert.equal((await call('/api/search',{method:'POST',body:JSON.stringify({source:'google',q:'teste'})})).status,400);assert.equal((await call('/api/not-found')).status,404);
 }finally{child.kill();upstream.closeAllConnections();await new Promise(resolve=>upstream.close(resolve));}
});
