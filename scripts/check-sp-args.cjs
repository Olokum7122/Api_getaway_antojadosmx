const sql = require('mssql');
async function main() {
  const pool = await sql.connect({
    server: '185.187.235.253', port: 1433, database: 'ATLX_EXPLORER_APP',
    user: 'sa', password: 'Olokum681228$',
    options: { encrypt: false, trustServerCertificate: true },
  });
  
  // Ver definición del SP
  const def = await pool.request().query(`
    SELECT OBJECT_DEFINITION(OBJECT_ID('explorer_core.usp_content_list_by_sponsor')) AS sp_definition
  `);
  if (def.recordset[0]?.sp_definition) {
    // Mostrar solo la cabecera (primeras líneas)
    const lines = def.recordset[0].sp_definition.split('\n');
    console.log('=== DEFINICIÓN SP ===');
    console.log(lines.slice(0, 10).join('\n'));
    console.log('...');
    console.log(lines.slice(-5).join('\n'));
    console.log(`\nTotal líneas: ${lines.length}`);
    
    // Buscar parámetros
    const params = lines.filter(l => l.includes('@'));
    console.log('\n=== PARÁMETROS ===');
    params.forEach(p => console.log(p.trim()));
  } else {
    console.log('SP no encontrado');
  }

  // Ver el SP de by_channel para comparar
  const def2 = await pool.request().query(`
    SELECT OBJECT_DEFINITION(OBJECT_ID('explorer_core.usp_content_list_by_channel')) AS sp_definition
  `);
  if (def2.recordset[0]?.sp_definition) {
    const lines2 = def2.recordset[0].sp_definition.split('\n');
    console.log('\n=== SP BY_CHANNEL PARÁMETROS ===');
    lines2.filter(l => l.includes('@')).forEach(p => console.log(p.trim()));
  }
  
  await pool.close();
}
main().catch(e => { console.error(e); process.exit(1); });
