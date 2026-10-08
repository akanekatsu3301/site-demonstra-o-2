import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { segmentTag } from './osm.js';

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY, source TEXT NOT NULL, source_id TEXT NOT NULL,
      name TEXT, phone TEXT, address TEXT, city TEXT, state TEXT, segment TEXT,
      website TEXT, website_status TEXT NOT NULL DEFAULT 'unknown',
      permission_url TEXT, export_allowed INTEGER NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'Novo', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source,source_id));
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY, query TEXT NOT NULL, source TEXT NOT NULL,
      count INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS source_cache(cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS service_limits(service TEXT PRIMARY KEY, next_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS source_records(source_id TEXT PRIMARY KEY, payload TEXT NOT NULL);`);
  const columns = new Set(db.prepare('PRAGMA table_info(leads)').all().map(c=>c.name));
  for(const column of ['source_url','license']) if(!columns.has(column)) db.exec(`ALTER TABLE leads ADD COLUMN ${column} TEXT`);
  return db;
}
export function selectLeads(db, filters = {}) {
  let segmentValue='';try{segmentValue=segmentTag(filters.segment)?.[1] || '';}catch{}
  return db.prepare('SELECT * FROM leads ORDER BY id DESC').all().filter(l => {
    const text = [l.name,l.phone,l.address,l.city,l.state,l.segment,l.source_id].join(' ').toLocaleLowerCase('pt-BR');
    return (!filters.q || text.includes(filters.q.toLocaleLowerCase('pt-BR')))
      && (!filters.city || (l.city || '').toLowerCase().includes(filters.city.toLowerCase()))
      && (!filters.state || (l.state || '').toLowerCase() === filters.state.toLowerCase())
      && (!filters.segment || (l.segment || '').toLowerCase().includes(filters.segment.toLowerCase()) || (l.source==='osm' && segmentValue===l.segment))
      && (!filters.website_status || l.website_status === filters.website_status)
      && (!filters.contact || (filters.contact === 'yes' ? !!l.phone : !l.phone));
  });
}
export function saveLead(db, input) {
  if (input.source === 'osm') {
    if(!/^(node|way|relation)\/\d+$/.test(input.source_id || '')) throw new Error('Identificador OpenStreetMap inválido.');
    const record=db.prepare('SELECT payload FROM source_records WHERE source_id=?').get(input.source_id);
    if(!record) throw new Error('Este estabelecimento não consta em uma pesquisa. Consulte a fonte antes de salvar.');
    const row=JSON.parse(record.payload);
    db.prepare(`INSERT INTO leads(source,source_id,name,phone,address,city,state,segment,website,website_status,permission_url,export_allowed,source_url,license)
      VALUES('osm',?,?,?,?,?,?,?,?,?,?,1,?,?) ON CONFLICT(source,source_id) DO UPDATE SET
      name=excluded.name,phone=excluded.phone,address=excluded.address,city=excluded.city,state=excluded.state,
      segment=excluded.segment,website=excluded.website,website_status=excluded.website_status,
      permission_url=excluded.permission_url,export_allowed=1,source_url=excluded.source_url,license=excluded.license`).run(
      ...['source_id','name','phone','address','city','state','segment','website','website_status','permission_url','source_url','license'].map(k=>row[k] || null));
  } else {
    if (input.source !== 'authorized' || input.authorized !== true) throw new Error('Confirme a autorização da fonte.');
    if (!input.name?.trim() || !input.source_id?.trim()) throw new Error('Nome e identificador são obrigatórios.');
    if (!/^https?:\/\//i.test(input.permission_url || '')) throw new Error('Informe a URL da fonte e de sua permissão.');
    for (const key of ['website','permission_url']) if (input[key]) {
      const u = new URL(input[key]); if (!['https:','http:'].includes(u.protocol)) throw new Error('URL inválida.');
    }
    const status = input.website ? 'present' : input.website_status === 'absent' ? 'absent' : 'unknown';
    db.prepare(`INSERT INTO leads(source,source_id,name,phone,address,city,state,segment,website,website_status,permission_url,export_allowed)
      VALUES('authorized',?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source,source_id) DO UPDATE SET
      name=excluded.name,phone=excluded.phone,address=excluded.address,city=excluded.city,state=excluded.state,
      segment=excluded.segment,website=excluded.website,website_status=excluded.website_status,
      permission_url=excluded.permission_url,export_allowed=excluded.export_allowed`).run(
      ...['source_id','name','phone','address','city','state','segment','website'].map(k=>input[k]?.trim() || null),status,input.permission_url,input.export_allowed === true ? 1 : 0);
  }
  return db.prepare('SELECT * FROM leads WHERE source=? AND source_id=?').get(input.source,input.source_id.trim());
}
