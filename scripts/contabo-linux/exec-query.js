'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const sql = require('mssql');

const [, , database, query] = process.argv;
if (!database || !query) {
  console.error('Usage: node exec-query.js <database> <query>');
  process.exit(1);
}

const config = {
  server: process.env.GT_ANTOJADOS_SERVER,
  port: parseInt(process.env.GT_ANTOJADOS_PORT || '1433', 10),
  database,
  user: process.env.GT_ANTOJADOS_USER,
  password: process.env.GT_ANTOJADOS_PASS,
  options: {
    encrypt: String(process.env.GT_ANTOJADOS_ENCRYPT || 'false') === 'true',
    trustServerCertificate: String(process.env.GT_ANTOJADOS_TRUST_CERT || 'true') === 'true',
  },
};

async function main() {
  let pool;
  try {
    pool = await sql.connect(config);
    const result = await pool.request().query(query);
    console.log(JSON.stringify(result.recordset, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    if (pool) await pool.close();
  }
}

main();
