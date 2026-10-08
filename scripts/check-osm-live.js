// Teste opt-in: busca pública pequena, sem salvar leads ou gerar tráfego recorrente.
import { openDatabase } from '../server/database.js';
import { createOSMProvider } from '../server/osm.js';
const db=openDatabase(':memory:');
try {
 const osm=createOSMProvider(db,{userAgent:process.env.OSM_USER_AGENT,nominatimUrl:process.env.NOMINATIM_URL,overpassUrl:process.env.OVERPASS_URL,resultLimit:5});
 const data=await osm.search({city:'Santos',state:'SP',segment:'padarias'});
 console.log(JSON.stringify({ok:true,count:data.results.length,region:data.region,limited:data.limited,origin:data.attribution,example:data.results[0]?{source_id:data.results[0].source_id,name:data.results[0].name,website_status:data.results[0].website_status}:null},null,2));
}catch(e){console.error(JSON.stringify({ok:false,status:e.status,message:e.message}));process.exitCode=1;}finally{db.close();}
