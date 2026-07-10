require('dotenv').config()
const sql = require('mssql')

const target = {
  server: process.env.GT_ANTOJADOS_SERVER,
  port: Number(process.env.GT_ANTOJADOS_PORT),
  database: process.env.GT_ANTOJADOS_NAME,
  user: process.env.GT_ANTOJADOS_USER,
  password: process.env.GT_ANTOJADOS_PASS,
  tables: [
    'antojados_core.biz_posts',
    'antojados_core.biz_tenant_users',
    'antojados_core.sys_instancia',
    'antojados_core.biz_tenant_user_components',
  ],
}

const query = `
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @schema
  AND TABLE_NAME = @table
ORDER BY ORDINAL_POSITION
`

async function main() {
  const conn = await sql.connect({
    server: target.server,
    port: target.port,
    database: target.database,
    user: target.user,
    password: target.password,
    options: { encrypt: false, trustServerCertificate: true },
  })

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

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
