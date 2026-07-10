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
    pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
  };
}

async function main() {
  const pool = await sql.connect(getConfig());
  try {
    const summary = await pool.request().query(`
      SELECT
        COUNT(CASE WHEN city.scope_level = N'ciudad' AND city.status = N'active' THEN 1 END) AS catalog_cities,
        COUNT(CASE WHEN detection.detection_id IS NOT NULL THEN 1 END) AS detected_cities
      FROM antojados_core.geo_scope_catalog AS city
      LEFT JOIN antojados_core.geo_scope_detection_map AS detection
        ON detection.city_scope_code = city.scope_code
       AND detection.status = N'active'
      WHERE city.scope_level = N'ciudad'
        AND city.status = N'active';
    `);

    const missing = await pool.request().query(`
      SELECT
        city.scope_code AS city_scope_code,
        city.scope_label AS city_label,
        zone.scope_code AS zone_scope_code,
        zone.scope_label AS zone_label
      FROM antojados_core.geo_scope_catalog AS city
      INNER JOIN antojados_core.geo_scope_catalog AS zone
        ON zone.scope_code = city.parent_scope_code
       AND zone.status = N'active'
      LEFT JOIN antojados_core.geo_scope_detection_map AS detection
        ON detection.city_scope_code = city.scope_code
       AND detection.status = N'active'
      WHERE city.scope_level = N'ciudad'
        AND city.status = N'active'
        AND detection.detection_id IS NULL
      ORDER BY city.scope_label, city.scope_code;
    `);

    console.log(JSON.stringify({
      summary: summary.recordset[0],
      missing: missing.recordset,
    }, null, 2));
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
