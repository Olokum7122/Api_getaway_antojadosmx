'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const sql = require('mssql');

function getConfig() {
  return {
    server: process.env.GT_ANTOJADOS_SERVER,
    port: parseInt(process.env.GT_ANTOJADOS_PORT || '1433', 10),
    database: process.env.GT_ANTOJADOS_NAME,
    user: process.env.GT_ANTOJADOS_USER,
    password: process.env.GT_ANTOJADOS_PASS,
    options: {
      encrypt: String(process.env.GT_ANTOJADOS_ENCRYPT || 'false') === 'true',
      trustServerCertificate: String(process.env.GT_ANTOJADOS_TRUST_CERT || 'true') === 'true',
    },
    pool: {
      max: 1,
      min: 0,
      idleTimeoutMillis: 5000,
    },
  };
}

async function main() {
  const config = getConfig();
  const missing = ['server', 'database', 'user', 'password'].filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error('Faltan variables GT_ANTOJADOS_* para conectar SQL.');
  }

  let pool;
  try {
    pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT scope_level, COUNT(*) AS total
      FROM antojados_core.geo_scope_catalog
      GROUP BY scope_level
      ORDER BY scope_level;

      SELECT COUNT(*) AS orphan_cities
      FROM antojados_core.geo_scope_catalog AS c
      LEFT JOIN antojados_core.geo_scope_catalog AS p
        ON p.scope_code = c.parent_scope_code
      WHERE c.scope_level = 'ciudad'
        AND p.scope_code IS NULL;

      SELECT COUNT(*) AS orphan_metros
      FROM antojados_core.geo_scope_catalog AS m
      LEFT JOIN antojados_core.geo_scope_catalog AS p
        ON p.scope_code = m.parent_scope_code
      WHERE m.scope_level = 'metro'
        AND p.scope_code IS NULL;
    `);

    console.log(JSON.stringify({
      levels: result.recordsets[0],
      orphanCities: result.recordsets[1][0].orphan_cities,
      orphanMetros: result.recordsets[2][0].orphan_metros,
    }, null, 2));
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
