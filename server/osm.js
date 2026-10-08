import { createHash } from 'node:crypto';
import { ServiceError } from './errors.js';

export const OSM_LICENSE = 'ODbL-1.0';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
export const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';
const STATES = {AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const groups = [
  ['restaurante restaurantes restaurant','amenity','restaurant'], ['cafe cafes cafeteria cafeterias coffee','amenity','cafe'],
  ['bar bares','amenity','bar'], ['lanchonete lanchonetes fast_food','amenity','fast_food'],
  ['dentista dentistas odontologia','amenity','dentist'], ['clinica clinicas clinic','amenity','clinic'],
  ['medico medicos consultorio consultorios','amenity','doctors'], ['farmacia farmacias pharmacy','amenity','pharmacy'],
  ['hospital hospitais','amenity','hospital'], ['banco bancos','amenity','bank'],
  ['escola escolas','amenity','school'], ['creche creches','amenity','kindergarten'],
  ['combustivel posto postos','amenity','fuel'], ['padaria padarias bakery','shop','bakery'],
  ['supermercado supermercados supermarket','shop','supermarket'], ['mercado mercados conveniencia','shop','convenience'],
  ['roupa roupas moda vestuario','shop','clothes'], ['salao saloes cabeleireiro cabeleireiros hairdresser','shop','hairdresser'],
  ['beleza estetica beauty','shop','beauty'], ['oficina oficinas mecanica mecanicas car_repair','shop','car_repair'],
  ['pet petshop petshops','shop','pet'], ['florista floricultura floriculturas','shop','florist'],
  ['livraria livrarias','shop','books'], ['eletronicos eletronica','shop','electronics'],
  ['hotel hoteis','tourism','hotel'], ['pousada pousadas','tourism','guest_house'],
  ['academia academias','leisure','fitness_centre'], ['advogado advogados advocacia','office','lawyer'],
  ['contador contadores contabilidade','office','accountant'], ['imobiliaria imobiliarias','office','estate_agent']
];
const segments = new Map(groups.flatMap(([aliases,key,value])=>aliases.split(' ').map(alias=>[alias,[key,value]])));
for(const [alias,target] of [['clinicas odontologicas','dentista'],['clinica odontologica','dentista'],['salao de beleza','salao'],['posto de combustivel','posto'],['loja de roupas','roupas'],['pet shop','petshop']]) segments.set(alias,segments.get(target));
const literal = s => JSON.stringify(String(s));
const regexLiteral = s => String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function segmentTag(segment) {
  const value=normalize(segment); if(!value) return null;
  if(segments.has(value)) return segments.get(value);
  const match=value.match(/^(shop|amenity|office|craft|tourism|leisure)=([a-z0-9_]{1,60})$/);
  if(match) return [match[1],match[2]];
  throw new ServiceError('Segmento não reconhecido. Use restaurantes, cafés, dentistas, clínicas, oficinas, padarias, hotéis, academias ou uma tag OSM, como shop=bakery.',400);
}
export function buildQuery(input,bbox,limit=100) {
  let name=input.q?.trim() || '', tag=segmentTag(input.segment);
  if(!tag && segments.has(normalize(name))) {tag=segments.get(normalize(name));name='';}
  if(!tag && !name) throw new ServiceError('Informe o nome, uma palavra-chave ou um segmento para limitar a busca.',400);
  if(!Array.isArray(bbox) || bbox.length!==4 || !bbox.every(Number.isFinite)) throw new ServiceError('Região de pesquisa inválida.',400);
  const selectors=tag?[`[${literal(tag[0])}=${literal(tag[1])}]`]:['[shop]','[amenity~"^(restaurant|cafe|bar|pub|fast_food|dentist|clinic|doctors|pharmacy|hospital|bank|school|kindergarten|fuel)$"]','[office]','[craft]','[tourism~"^(hotel|motel|guest_house|hostel)$"]','[leisure="fitness_centre"]'];
  const names=name?[`[name~${literal(regexLiteral(name))},i]`,`[brand~${literal(regexLiteral(name))},i]`]:['[name]'];
  const statements=selectors.flatMap(selector=>names.map(filter=>`nwr${selector}${filter}(${bbox.join(',')});`));
  return `[out:json][timeout:25][maxsize:33554432];(${statements.join('')});out tags center ${limit+1};`;
}
function websiteUrl(value) {
  const raw=String(value || '').split(';')[0].trim();if(!raw) return '';
  try {const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(raw)?raw:'https://'+raw);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}
}
export function mapElement(element) {
  if(!['node','way','relation'].includes(element.type) || !Number.isSafeInteger(element.id)) return null;
  const t=element.tags || {}, name=t.name || t.brand;if(!name) return null;
  const rawWebsite=t['contact:website'] || t.website || t.url || '';
  const website=websiteUrl(rawWebsite);
  const source_id=`${element.type}/${element.id}`;
  const state=t['addr:state'] || '';
  const uf=Object.entries(STATES).find(([key,label])=>normalize(key)===normalize(state)||normalize(label)===normalize(state))?.[0] || state;
  return {source:'osm',source_id,name,phone:t['contact:phone'] || t.phone || '',
    address:[t['addr:full'] || [t['addr:street'],t['addr:housenumber']].filter(Boolean).join(', '),t['addr:suburb'],t['addr:city'],uf,t['addr:postcode']].filter(Boolean).join(' · '),
    city:t['addr:city'] || '',state:uf,segment:t.shop || t.amenity || t.office || t.craft || t.tourism || t.leisure || '',
    website,website_status:rawWebsite?'present':'unidentified',website_raw:rawWebsite,
    source_url:`https://www.openstreetmap.org/${source_id}`,maps_url:`https://www.openstreetmap.org/${source_id}`,
    permission_url:OSM_COPYRIGHT,license:OSM_LICENSE,attribution:OSM_ATTRIBUTION,export_allowed:1};
}
function cacheGet(db,key,now) {
  const row=db.prepare('SELECT payload FROM source_cache WHERE cache_key=? AND expires_at>?').get(key,now);
  if(!row) return null;try{return JSON.parse(row.payload);}catch{return null;}
}
function cacheSet(db,key,value,ttl,now) {
  db.prepare('INSERT INTO source_cache(cache_key,payload,expires_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at').run(key,JSON.stringify(value),now+ttl);
  db.prepare('DELETE FROM source_cache WHERE expires_at<=?').run(now);
}
export function createOSMProvider(db,config={},request=fetch) {
  const endpoints={nominatim:config.nominatimUrl || 'https://nominatim.openstreetmap.org/search',overpass:config.overpassUrl || 'https://overpass-api.de/api/interpreter'};
  for(const endpoint of Object.values(endpoints)) if(!['http:','https:'].includes(new URL(endpoint).protocol)) throw new Error('Endpoint OSM deve usar HTTP ou HTTPS.');
  const userAgent=config.userAgent || 'VORTEK-Prospect/1.0 (local interactive business research)';
  const clock=config.now || Date.now;
  const limit=Math.min(100,Math.max(1,Number(config.resultLimit) || 100));
  const pending=new Map();
  let busy=false;
  function key(type,value) {return type+':'+createHash('sha256').update(JSON.stringify(value)).digest('hex');}
  async function getJSON(service,url,options={}) {
    const now=clock(), minGap=service==='nominatim'?1100:10000;
    const gate=db.prepare('SELECT next_at FROM service_limits WHERE service=?').get(service);
    if(gate && gate.next_at>now) throw new ServiceError(`Aguarde ${Math.ceil((gate.next_at-now)/1000)} segundos antes de uma nova consulta a ${service==='nominatim'?'geocodificação':'Overpass'}.`,429);
    db.prepare('INSERT INTO service_limits(service,next_at) VALUES(?,?) ON CONFLICT(service) DO UPDATE SET next_at=excluded.next_at').run(service,now+minGap);
    let response;
    try {response=await request(url,{...options,signal:AbortSignal.timeout(service==='overpass'?35000:15000),headers:{'User-Agent':userAgent,Accept:'application/json',...options.headers}});}catch{throw new ServiceError(`Não foi possível conectar a ${service==='nominatim'?'geocodificação':'Overpass'}. O serviço gratuito pode estar indisponível; tente novamente mais tarde.`,504);}
    if(!response.ok) {
      if([429,503,504].includes(response.status)) {
        const header=response.headers?.get('Retry-After');const seconds=Number(header);
        const retryDate=Date.parse(header || '');
        const cooldown=header && Number.isFinite(seconds)?Math.max(60000,seconds*1000):Number.isFinite(retryDate)?Math.max(60000,retryDate-clock()):60000;
        db.prepare('UPDATE service_limits SET next_at=? WHERE service=?').run(clock()+cooldown,service);
      }
      throw new ServiceError(response.status===429?'O serviço gratuito atingiu seu limite. Aguarde o período de pausa antes de tentar novamente.':`O serviço ${service==='nominatim'?'de geocodificação':'Overpass'} está indisponível ou recusou a consulta. Tente novamente mais tarde.`,response.status===429?429:502);
    }
    const contentLength=Number(response.headers?.get('Content-Length') || 0);
    if(contentLength>8*1024*1024) {await response.body?.cancel();throw new ServiceError('A resposta é muito grande. Restrinja o nome ou segmento.',502);}
    let result;try{const raw=await response.text();if(Buffer.byteLength(raw)>8*1024*1024) throw Error();result=JSON.parse(raw);}catch{throw new ServiceError('A fonte retornou uma resposta inválida ou muito grande. Tente restringir a pesquisa.',502);}
    return result;
  }
  async function geocode(input) {
    if(!input.city?.trim()) throw new ServiceError('Informe uma cidade ou região para pesquisar no OpenStreetMap.',400);
    const uf=input.state?.trim().toUpperCase() || '';
    if(uf && !STATES[uf]) throw new ServiceError('Estado inválido. Informe uma UF brasileira, como SP ou PE.',400);
    const search=[input.city.trim(),STATES[uf],'Brasil'].filter(Boolean).join(', ');
    const cacheKey=key('geocode',[endpoints.nominatim,normalize(search)]),cached=cacheGet(db,cacheKey,clock());if(cached) return cached;
    const url=new URL(endpoints.nominatim);url.search=new URLSearchParams({q:search,format:'jsonv2',addressdetails:'1',countrycodes:'br',limit:'3','accept-language':'pt-BR'}).toString();
    const places=await getJSON('nominatim',url);
    if(!Array.isArray(places)) throw new ServiceError('Resposta de geocodificação inválida.',502);
    const suitable=places.filter(p=>p.addresstype && ['city','town','village','municipality','county','state','suburb','quarter','borough','neighbourhood','administrative'].includes(p.addresstype));
    if(!suitable.length) throw new ServiceError('Cidade ou região não encontrada. Revise o nome e a UF.',404);
    if(suitable.length>1 && !uf) throw new ServiceError('A localização é ambígua. Informe a UF ou um nome de região mais específico.',400);
    const place=suitable[0],lat=Number(place.lat),lon=Number(place.lon), box=(place.boundingbox || []).map(Number);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||box.length!==4||!box.every(Number.isFinite)) throw new ServiceError('A geocodificação não retornou uma região válida.',502);
    const iso=place.address?.['ISO3166-2-lvl4'];if(uf && iso && iso!==`BR-${uf}`) throw new ServiceError('A região encontrada não corresponde à UF informada.',404);
    // Intersection with a 20 km-wide window keeps public queries bounded.
    const dy=10/111.32,dx=10/(111.32*Math.cos(lat*Math.PI/180));
    const bbox=[Math.max(box[0],lat-dy),Math.max(box[2],lon-dx),Math.min(box[1],lat+dy),Math.min(box[3],lon+dx)];
    const region={name:place.display_name,bbox,clipped:bbox[0]>box[0]||bbox[1]>box[2]||bbox[2]<box[1]||bbox[3]<box[3]};
    cacheSet(db,cacheKey,region,30*86400000,clock());return region;
  }
  function remember(rows) {
    const stmt=db.prepare('INSERT INTO source_records(source_id,payload) VALUES(?,?) ON CONFLICT(source_id) DO UPDATE SET payload=excluded.payload');
    db.exec('BEGIN');try{for(const row of rows) stmt.run(row.source_id,JSON.stringify(row));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  }
  async function search(input) {
    if(!input.city?.trim()) throw new ServiceError('Informe uma cidade ou região para pesquisar no OpenStreetMap.',400);
    buildQuery(input,[0,0,0,0],limit); // Validate before using an external service.
    const cacheKey=key('search',[endpoints,input.q?.trim()||'',normalize(input.segment),normalize(input.city),normalize(input.state),limit]);
    const cached=cacheGet(db,cacheKey,clock());if(cached){remember(cached.results);return {...cached,cached:true};}
    if(pending.has(cacheKey)) return pending.get(cacheKey);
    if(busy) throw new ServiceError('Outra consulta à fonte está em andamento. Aguarde sua conclusão.',429);
    busy=true;
    const task=(async()=>{
      const region=await geocode(input);
      const query=buildQuery(input,region.bbox,limit);
      const data=await getJSON('overpass',endpoints.overpass,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}).toString()});
      if(data.remark) throw new ServiceError('O Overpass interrompeu a consulta por tempo ou recursos. Nenhum resultado parcial foi salvo. Restrinja sua pesquisa e tente mais tarde.',502);
      if(!Array.isArray(data.elements)) throw new ServiceError('O Overpass retornou dados inválidos.',502);
      const unique=new Map();for(const element of data.elements){const row=mapElement(element);if(row)unique.set(row.source_id,row);}
      const all=[...unique.values()], results=all.slice(0,limit);
      const result={results,limited:all.length>limit,region,cached:false,attribution:OSM_ATTRIBUTION,license:OSM_LICENSE,license_url:OSM_COPYRIGHT};
      remember(results);cacheSet(db,cacheKey,result,15*60000,clock());return result;
    })();
    pending.set(cacheKey,task);
    try{return await task;}finally{pending.delete(cacheKey);busy=false;}
  }
  return {search,endpoints,limit};
}
