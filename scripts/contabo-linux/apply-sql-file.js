'use strict';

require('dotenv').config();
const fs = require('fs');
const sql = require('mssql');

const [, , dbKey, filePath] = process.argv;

if (!dbKey || !filePath) {
  console.error('Usage: node apply-sql-file.js <APP|ANALYTICS|INTEGRATION> <file.sql>');
  process.exit(1);
}

const prefixes = {
  APP: 'GT_APP',
  ANALYTICS: 'GT_ANALYTICS',
  INTEGRATION: 'GT_INTEGRATION',
  ANTOJADOS: 'GT_ANTOJADOS',
  EXPLORER: 'GT_EXPLORER_APP',
};

const prefix = prefixes[String(dbKey || '').toUpperCase()];
if (!prefix) {
  console.error('Unknown db key: ' + dbKey);
  process.exit(1);
}

const query = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
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
    await pool.request().batch(query);
    console.log('Applied ' + filePath + ' on ' + config.database);
  } finally {
    if (pool) await pool.close();
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
