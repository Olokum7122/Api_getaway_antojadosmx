require('dotenv').config()
const sql = require('mssql')

const targets = [
  {
    label: 'ANTOJADOS',
    database: process.env.GT_ANTOJADOS_NAME,
    server: process.env.GT_ANTOJADOS_SERVER,
    port: Number(process.env.GT_ANTOJADOS_PORT),
    user: process.env.GT_ANTOJADOS_USER,
    password: process.env.GT_ANTOJADOS_PASS,
    tables: [
      'antojados_core.soc_places',
      'antojados_core.biz_tenants',
      'antojados_feed.feed_top_places',
      'antojados_feed.feed_items',
      'antojados_feed.feed_biz_items',
    ],
  },
  {
    label: 'ANALYTICS',
    database: process.env.GT_ANALYTICS_NAME,
    server: process.env.GT_ANALYTICS_SERVER,
    port: Number(process.env.GT_ANALYTICS_PORT),
    user: process.env.GT_ANALYTICS_USER,
    password: process.env.GT_ANALYTICS_PASS,
    tables: [
      'gt_antojados.analytics_antojados_tenant_summary',
      'gt_antojados.food_biz_post_engagement_pmonth',
      'gt_antojados.food_place_score_pmonth',
      'gt_antojados.food_city_activity_pmonth',
      'gt_antojados.food_territorial_activity',
    ],
  },
  {
    label: 'INTEGRATION',
    database: process.env.GT_INTEGRATION_NAME,
    server: process.env.GT_INTEGRATION_SERVER,
    port: Number(process.env.GT_INTEGRATION_PORT),
    user: process.env.GT_INTEGRATION_USER,
    password: process.env.GT_INTEGRATION_PASS,
    tables: [
      'gt_antojados.food_event_ingesta',
      'gt_antojados.food_place_event_stream',
      'gt_antojados.food_city_event_stream',
    ],
  },
]

const query = `
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @schema
  AND TABLE_NAME = @table
ORDER BY ORDINAL_POSITION
`

async function inspectTarget(target) {
  const conn = await sql.connect({
    server: target.server,
    port: target.port,
    database: target.database,
    user: target.user,
    password: target.password,
    options: { encrypt: false, trustServerCertificate: true },
  })

  console.log('\n=== ' + target.label + ' :: ' + target.database + ' ===')

  for (const fqName of target.tables) {
    const [schema, table] = fqName.split('.')
    const rs = await conn.request()
      .input('schema', sql.NVarChar, schema)
      .input('table', sql.NVarChar, table)
      .query(query)

    console.log('-- ' + fqName + ' --')
    for (const row of rs.recordset) {
      console.log(row.COLUMN_NAME + ' | ' + row.DATA_TYPE)
    }
  }

  await conn.close()
}

async function main() {
  for (const target of targets) {
    await inspectTarget(target)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
