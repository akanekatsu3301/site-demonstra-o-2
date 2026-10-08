import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const pages=['index.html','templates.html','experiencia.html','favoritos.html','prospeccao.html'];
let links=0;
for(const page of pages){
 const html=await readFile(join('dist',page),'utf8');
 assert.ok(!/\bFORMA\b|\bForma\b|Vortekto|Vorteks/.test(html),'Identidade ou texto incorreto em '+page);
 assert.equal((html.match(/<title>/g) || []).length,1);
 assert.equal((html.match(/<meta name="description"/g) || []).length,1);
 assert.equal((html.match(/<h1(?:\s|>)/g) || []).length,1);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'IDs duplicados em '+page);
 for(const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){
  const link=match[1];if(/^(https?:|data:)/.test(link))continue;
  const [file,fragment]=link.split('#');const target=file.split('?')[0] || page;
  if(target==='/')continue;
  await access(join('dist',target));
  if(fragment){const content=target===page?html:await readFile(join('dist',target),'utf8');assert.ok(content.includes(`id="${fragment}"`),'Âncora ausente: '+link);}
  links++;
 }
}
const home=await readFile('dist/index.html','utf8');
assert.ok(home.includes('Sites institucionais'));assert.ok(home.includes('Quanto custa desenvolver um site?'));
assert.equal((home.match(/property="og:image"/g)||[]).length,1);
console.log(`Vortek: ${pages.length} páginas e ${links} referências locais verificadas; títulos, metadados e âncoras válidos.`);
