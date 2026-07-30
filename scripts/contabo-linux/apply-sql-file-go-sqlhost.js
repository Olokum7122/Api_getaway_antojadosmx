'use strict';

require('dotenv').config();
const fs = require('fs');
const sql = require('mssql');

const [, , database, filePath] = process.argv;

if (!database || !filePath) {
  console.error('Usage: node apply-sql-file-go-sqlhost.js <database> <file.sql>');
  process.exit(1);
}

function splitGoBatches(query) {
  return query
    .replace(/^\uFEFF/, '')
    .split(/^\s*GO\s*(?:--.*)?\s*$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean);
}

const query = fs.readFileSync(filePath, 'utf8');
const batches = splitGoBatches(query);
const config = {
  server: process.env.SQL_HOST,
  port: parseInt(process.env.SQL_PORT || '1433', 10),
  database,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: String(process.env.SQL_TRUST_CERT || 'true') === 'true',
  },
  pool: {
    max: 1,
    min: 0,
    idleTimeoutMillis: 5000,
  },
};

async function main() {
  let pool;
  try {
    pool = await sql.connect(config);
    for (let index = 0; index < batches.length; index += 1) {
      await pool.request().batch(batches[index]);
      console.log(`batch ${index + 1}/${batches.length} ok`);
    }
    console.log(JSON.stringify({ applied: filePath, database, batches: batches.length }));
  } finally {
    if (pool) await pool.close();
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});