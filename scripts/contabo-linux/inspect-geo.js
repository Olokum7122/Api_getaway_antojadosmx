require('dotenv').config()
const sql = require('mssql')

const pools = [
  {
    label: 'ANTOJADOS',
    server: process.env.GT_ANTOJADOS_SERVER,
    port: Number(process.env.GT_ANTOJADOS_PORT),
    database: process.env.GT_ANTOJADOS_NAME,
    user: process.env.GT_ANTOJADOS_USER,
    password: process.env.GT_ANTOJADOS_PASS,
  },
  {
    label: 'ANALYTICS',
    server: process.env.GT_ANALYTICS_SERVER,
    port: Number(process.env.GT_ANALYTICS_PORT),
    database: process.env.GT_ANALYTICS_NAME,
    user: process.env.GT_ANALYTICS_USER,
    password: process.env.GT_ANALYTICS_PASS,
  },
  {
    label: 'INTEGRATION',
    server: process.env.GT_INTEGRATION_SERVER,
    port: Number(process.env.GT_INTEGRATION_PORT),
    database: process.env.GT_INTEGRATION_NAME,
    user: process.env.GT_INTEGRATION_USER,
    password: process.env.GT_INTEGRATION_PASS,
  },
]

const tableScanQuery = `
SELECT
  TABLE_SCHEMA,
  TABLE_NAME,
  SUM(CASE WHEN COLUMN_NAME = 'city_code' THEN 1 ELSE 0 END) AS has_city_code,
  SUM(CASE WHEN COLUMN_NAME = 'place_id' THEN 1 ELSE 0 END) AS has_place_id,
  SUM(CASE WHEN COLUMN_NAME IN ('lat', 'latitude') THEN 1 ELSE 0 END) AS has_lat,
  SUM(CASE WHEN COLUMN_NAME IN ('lng', 'longitude', 'lon') THEN 1 ELSE 0 END) AS has_lng
FROM INFORMATION_SCHEMA.COLUMNS
GROUP BY TABLE_SCHEMA, TABLE_NAME
HAVING SUM(
  CASE
    WHEN COLUMN_NAME IN ('city_code', 'place_id', 'lat', 'latitude', 'lng', 'longitude', 'lon')
    THEN 1 ELSE 0
  END
) > 0
ORDER BY TABLE_SCHEMA, TABLE_NAME
`

const geoNamedTablesQuery = `
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
  AND (
    TABLE_NAME LIKE '%city%'
    OR TABLE_NAME LIKE '%metro%'
    OR TABLE_NAME LIKE '%geo%'
    OR TABLE_NAME LIKE '%localit%'
    OR TABLE_NAME LIKE '%municip%'
    OR TABLE_NAME LIKE '%place%'
  )
ORDER BY TABLE_SCHEMA, TABLE_NAME
`

async function inspectPool(cfg) {
  const conn = await sql.connect({
    server: cfg.server,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    options: { encrypt: false, trustServerCertificate: true },
  })

  console.log('\n=== ' + cfg.label + ' :: ' + cfg.database + ' ===')

  const scan = await conn.request().query(tableScanQuery)
  console.log('-- tables with city_code/place_id/lat/lng --')
  for (const row of scan.recordset) {
    console.log(
      row.TABLE_SCHEMA +
        '.' +
        row.TABLE_NAME +
        ' | city:' +
        row.has_city_code +
        ' place:' +
        row.has_place_id +
        ' lat:' +
        row.has_lat +
        ' lng:' +
        row.has_lng,
    )
  }

  const geoNames = await conn.request().query(geoNamedTablesQuery)
  console.log('-- geo-named tables --')
  for (const row of geoNames.recordset) {
    console.log(row.TABLE_SCHEMA + '.' + row.TABLE_NAME)
  }

  await conn.close()
}

async function main() {
  for (const pool of pools) {
    await inspectPool(pool)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
