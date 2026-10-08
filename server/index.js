import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { openDatabase, selectLeads, saveLead } from './database.js';
import { ServiceError } from './errors.js';
import { createOSMProvider } from './osm.js';
import { exportLeads, isExportable } from './export.js';
const root=resolve('dist'), host=process.env.HOST || '127.0.0.1', port=Number(process.env.PORT || 3000);
const token=process.env.APP_TOKEN || '';
if(!['127.0.0.1','localhost','::1'].includes(host) && token.length<24) throw new Error('Configure APP_TOKEN com pelo menos 24 caracteres para acesso remoto.');
const db=openDatabase(process.env.DATABASE_PATH || 'data/prospect.sqlite');
const osm=createOSMProvider(db,{nominatimUrl:process.env.NOMINATIM_URL,overpassUrl:process.env.OVERPASS_URL,userAgent:process.env.OSM_USER_AGENT,resultLimit:process.env.OSM_RESULT_LIMIT});
let searchTimes=[];
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req) {
  let raw=''; for await (const chunk of req) {raw+=chunk;if(Buffer.byteLength(raw)>65536) throw new ServiceError('Requisição muito grande.',413);}
  try { const value=JSON.parse(raw); if(!value || typeof value!=='object' || Array.isArray(value)) throw Error(); return value; } catch {throw new ServiceError('JSON inválido.',400);}
}
export const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  try {
    const url=new URL(req.url,'http://localhost');
    if(['127.0.0.1','localhost','::1'].includes(host) && !['127.0.0.1','localhost','[::1]'].includes(new URL('http://'+req.headers.host).hostname)) return json(res,403,{error:'Host não autorizado.'});
    if(url.pathname.startsWith('/api/')) {
      if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}` && req.headers.origin!==`https://${req.headers.host}`) return json(res,403,{error:'Origem não autorizada.'});
      if(token) {const provided=Buffer.from((req.headers.authorization || '').replace(/^Bearer /,''));const expected=Buffer.from(token);if(provided.length!==expected.length || !timingSafeEqual(provided,expected)) return json(res,401,{error:'Informe o token de acesso nas configurações.'});}
      const filters=Object.fromEntries(url.searchParams);
      if(req.method==='GET' && url.pathname==='/api/status') return json(res,200,{provider:'osm',credentials_required:false,result_limit:osm.limit,endpoints:osm.endpoints});
      if(req.method==='GET' && url.pathname==='/api/stats') {const leads=selectLeads(db);return json(res,200,{leads:leads.length,opportunities:leads.filter(l=>l.website_status==='unidentified').length,contacts:leads.filter(l=>l.phone).length,searches:db.prepare('SELECT COUNT(*) AS n FROM history').get().n});}
      if(req.method==='GET' && url.pathname==='/api/leads') return json(res,200,selectLeads(db,filters));
      if(req.method==='GET' && url.pathname==='/api/history') return json(res,200,db.prepare('SELECT * FROM history ORDER BY id DESC LIMIT 100').all());
      if(req.method==='POST' && url.pathname==='/api/search') {
        const input=await body(req);for(const k of ['q','city','state','segment']) if(input[k]!==undefined && (typeof input[k]!=='string' || input[k].length>200)) throw new ServiceError('Filtro inválido.',400);
        const query=[input.q,input.segment,input.city,input.state].filter(Boolean).join(' ').trim();if(query.length<2) throw new ServiceError('Informe ao menos dois caracteres para pesquisar.',400);
        if(!['osm','authorized'].includes(input.source)) throw new ServiceError('Fonte inválida. Utilize OpenStreetMap ou sua base autorizada.',400);
        const now=Date.now();searchTimes=searchTimes.filter(t=>now-t<60000);if(searchTimes.length>=Number(process.env.SEARCHES_PER_MINUTE || 6)) throw new ServiceError('Limite de pesquisas por minuto atingido. Aguarde.',429);searchTimes.push(now);
        let result;try {result=input.source==='osm'?await osm.search(input):{results:selectLeads(db,input),limited:false,cached:false};} catch(e) {db.prepare('INSERT INTO history(query,source,count,status) VALUES(?,?,0,?)').run(query,input.source,'error');throw e;}
        db.prepare('INSERT INTO history(query,source,count,status) VALUES(?,?,?,?)').run(query,input.source,result.results.length,'success');return json(res,200,{...result,query});
      }
      if(req.method==='POST' && url.pathname==='/api/leads') {const input=await body(req);for(const v of Object.values(input)) if(typeof v==='string' && v.length>2000) throw new ServiceError('Campo muito longo.',400);try{return json(res,201,saveLead(db,input));}catch(e){throw new ServiceError(e.message,400);}}
      const match=url.pathname.match(/^\/api\/leads\/(\d+)$/);
      if(match && req.method==='DELETE') {const result=db.prepare('DELETE FROM leads WHERE id=?').run(Number(match[1]));return json(res,result.changes?200:404,{deleted:!!result.changes});}
      if(match && req.method==='PATCH') {const input=await body(req);if(!['Novo','Em contato','Qualificado','Arquivado'].includes(input.stage)) throw new ServiceError('Etapa inválida.',400);const result=db.prepare('UPDATE leads SET stage=? WHERE id=?').run(input.stage,Number(match[1]));return json(res,result.changes?200:404,{updated:!!result.changes});}
      if(req.method==='GET' && url.pathname==='/api/export') {const format=filters.format || 'csv';if(!['csv','xml'].includes(format)) throw new ServiceError('Formato inválido.',400);const rows=selectLeads(db,filters);if(!rows.some(isExportable)) throw new ServiceError('Nenhum registro elegível para exportação nestes filtros.',400);res.writeHead(200,{'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/xml; charset=utf-8','Content-Disposition':`attachment; filename="leads.${format}"`,'Cache-Control':'no-store'});return res.end(exportLeads(rows,format));}
      return json(res,404,{error:'Rota não encontrada.'});
    }
    if(!['GET','HEAD'].includes(req.method)) return json(res,405,{error:'Método não permitido.'});
    const pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    if(pathname.includes('..') || pathname.includes('\\') || !/\.(html|css|js|svg|png|ico)$/.test(pathname)) return json(res,404,{error:'Página não encontrada.'});
    const file=await readFile(resolve(root,'.'+pathname));res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'})[extname(pathname)] || 'application/octet-stream');res.end(req.method==='HEAD'?undefined:file);
  } catch(e) {if(e.code==='ENOENT') return json(res,404,{error:'Página não encontrada.'});json(res,e.status || 500,{error:e.status?e.message:'Erro interno. Tente novamente.'});}
});
server.listen(port,host,()=>console.log(`VORTEK Prospect: http://${host}:${server.address().port}`));
