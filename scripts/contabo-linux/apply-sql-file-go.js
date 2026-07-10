'use strict';

require('dotenv').config();
const fs = require('fs');
const sql = require('mssql');

const [, , dbKey, filePath] = process.argv;

if (!dbKey || !filePath) {
  console.error('Usage: node apply-sql-file-go.js <APP|ANTOJADOS|ANALYTICS|INTEGRATION> <file.sql>');
  process.exit(1);
}

const prefixes = {
  APP: 'GT_APP',
  ANTOJADOS: 'GT_ANTOJADOS',
  ANALYTICS: 'GT_ANALYTICS',
  INTEGRATION: 'GT_INTEGRATION',
};

const prefix = prefixes[String(dbKey).toUpperCase()];
if (!prefix) {
  console.error('Unknown db key: ' + dbKey);
  process.exit(1);
}

function splitGoBatches(query) {
  return query
    .replace(/^\uFEFF/, '')
    .split(/\r?\nGO\s*(?:--.*)?\r?\n/gi)
    .map((batch) => batch.trim())
    .filter(Boolean);
}

const query = fs.readFileSync(filePath, 'utf8');
const batches = splitGoBatches(query);
const config = {
  server: process.env[prefix + '_SERVER'],
  port: parseInt(process.env[prefix + '_PORT'] || '1433', 10),
  database: process.env[prefix + '_NAME'],
  user: process.env[prefix + '_USER'],
  password: process.env[prefix + '_PASS'],
  options: {
    encrypt: String(process.env[prefix + '_ENCRYPT'] || 'false') === 'true',
    trustServerCertificate: String(process.env[prefix + '_TRUST_CERT'] || 'true') === 'true',
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
    }
    console.log(JSON.stringify({
      applied: filePath,
      database: config.database,
      batches: batches.length,
    }, null, 2));
  } finally {
    if (pool) await pool.close();
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
