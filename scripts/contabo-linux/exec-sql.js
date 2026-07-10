'use strict';

const sql = require('/opt/api_antojados/node_modules/mssql');

const [, , database, query] = process.argv;

if (!database || !query) {
  console.error('Usage: node exec-sql.js <database> <query>');
  process.exit(1);
}

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
    await pool.request().batch(query);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
