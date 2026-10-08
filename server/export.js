const columns = ['name','phone','address','city','state','segment','website','website_status','permission_url','stage','source_url','license','attribution'];
const labels = ['Empresa','Telefone','Endereço','Cidade','UF','Segmento','Website','Situação do website','Fonte / permissão','Etapa','Registro na fonte','Licença','Atribuição'];
export const isExportable = l => (l.source==='authorized' || (l.source==='osm' && l.license==='ODbL-1.0')) && l.export_allowed===1;
export function safeCell(value) { const s=String(value ?? ''); return /^[\s]*[=+@-]/.test(s) ? "'"+s : s; }
export function exportLeads(leads, format) {
  const statuses={present:'Com website',unidentified:'Website não informado',absent:'Ausência confirmada',unknown:'Indisponível'};
  const rows=[labels,...leads.filter(isExportable).map(l=>columns.map(k=>safeCell(k==='attribution' && l.source==='osm'?'© OpenStreetMap contributors':k==='website_status'?statuses[l[k]] || l[k]:l[k])))];
  if(format==='csv') return '\uFEFF'+rows.map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(';')).join('\r\n');
  const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
  return '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Leads"><Table>'+rows.map(row=>'<Row>'+row.map(v=>'<Cell><Data ss:Type="String">'+xml(v)+'</Data></Cell>').join('')+'</Row>').join('')+'</Table></Worksheet></Workbook>';
}
