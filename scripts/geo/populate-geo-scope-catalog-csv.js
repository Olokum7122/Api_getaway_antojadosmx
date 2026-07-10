'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--apply');
const csvArg = process.argv.find((arg) => arg.startsWith('--csv='));
const csvPath = csvArg
  ? path.resolve(process.cwd(), csvArg.split('=').slice(1).join('='))
  : path.resolve(__dirname, '..', '..', '..', 'AntojadosMX_IOS', 'src', 'Docs', 'mexico_metro_inegi.csv');

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

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
  const lines = content.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
}

function required(value, field, row) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`CSV invalido: falta ${field} en fila ${JSON.stringify(row)}`);
  }
  return normalized;
}

function buildScopes(rows) {
  const scopes = new Map();

  for (const row of rows) {
    const countryAlpha = required(row.country_alpha, 'country_alpha', row);
    const countryCode = required(row.country_code, 'country_code', row);
    const countryName = required(row.country_name, 'country_name', row);
    const zoneCode = required(row.zone_code, 'zone_code', row);
    const zoneName = required(row.zone_name, 'zone_name', row);
    const cityCode = required(row.city_code, 'city_code', row);
    const cityName = required(row.city_name, 'city_name', row);
    const status = String(row.status || 'active').trim() || 'active';

    scopes.set(countryCode, {
      scope_code: countryCode,
      scope_level: 'mexico',
      scope_label: countryName,
      parent_scope_code: null,
      country_code: countryAlpha,
      city_code: null,
      zone_code: null,
      status,
    });

    if (!scopes.has(zoneCode)) {
      scopes.set(zoneCode, {
        scope_code: zoneCode,
        scope_level: 'metro',
        scope_label: zoneName,
        parent_scope_code: countryCode,
        country_code: countryAlpha,
        city_code: null,
        zone_code: zoneCode,
        status,
      });
    }

    scopes.set(cityCode, {
      scope_code: cityCode,
      scope_level: 'ciudad',
      scope_label: cityName,
      parent_scope_code: zoneCode,
      country_code: countryAlpha,
      city_code: cityCode,
      zone_code: zoneCode,
      status,
    });
  }

  return [...scopes.values()].sort((left, right) => (
    `${left.scope_level}:${left.scope_code}`.localeCompare(`${right.scope_level}:${right.scope_code}`)
  ));
}

async function ensureTable(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'antojados_core')
      EXEC(N'CREATE SCHEMA antojados_core');

    IF OBJECT_ID(N'antojados_core.geo_scope_catalog', N'U') IS NULL
    EXEC(N'
      CREATE TABLE antojados_core.geo_scope_catalog (
        scope_code        NVARCHAR(64)  NOT NULL CONSTRAINT PK_geo_scope_catalog PRIMARY KEY,
        scope_level       NVARCHAR(20)  NOT NULL,
        scope_label       NVARCHAR(120) NOT NULL,
        parent_scope_code NVARCHAR(64)  NULL,
        country_code      NVARCHAR(10)  NULL,
        city_code         NVARCHAR(30)  NULL,
        zone_code         NVARCHAR(30)  NULL,
        status            NVARCHAR(20)  NOT NULL CONSTRAINT DF_geo_scope_catalog_status DEFAULT (N''active''),
        created_at        DATETIME2(3)  NOT NULL CONSTRAINT DF_geo_scope_catalog_created DEFAULT SYSUTCDATETIME(),
        updated_at        DATETIME2(3)  NOT NULL CONSTRAINT DF_geo_scope_catalog_updated DEFAULT SYSUTCDATETIME()
      )
    ');
  `);
}

async function upsertScope(pool, scope) {
  await pool.request()
    .input('scopeCode', sql.NVarChar(64), scope.scope_code)
    .input('scopeLevel', sql.NVarChar(20), scope.scope_level)
    .input('scopeLabel', sql.NVarChar(120), scope.scope_label)
    .input('parentScopeCode', sql.NVarChar(64), scope.parent_scope_code)
    .input('countryCode', sql.NVarChar(10), scope.country_code)
    .input('cityCode', sql.NVarChar(30), scope.city_code)
    .input('zoneCode', sql.NVarChar(30), scope.zone_code)
    .input('status', sql.NVarChar(20), scope.status)
    .query(`
      MERGE antojados_core.geo_scope_catalog AS tgt
      USING (
        SELECT
          @scopeCode AS scope_code,
          @scopeLevel AS scope_level,
          @scopeLabel AS scope_label,
          @parentScopeCode AS parent_scope_code,
          @countryCode AS country_code,
          @cityCode AS city_code,
          @zoneCode AS zone_code,
          @status AS status
      ) AS src
      ON tgt.scope_code = src.scope_code
      WHEN MATCHED THEN UPDATE SET
        scope_level = src.scope_level,
        scope_label = src.scope_label,
        parent_scope_code = src.parent_scope_code,
        country_code = src.country_code,
        city_code = src.city_code,
        zone_code = src.zone_code,
        status = src.status,
        updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (scope_code, scope_level, scope_label, parent_scope_code, country_code, city_code, zone_code, status)
      VALUES
        (src.scope_code, src.scope_level, src.scope_label, src.parent_scope_code, src.country_code, src.city_code, src.zone_code, src.status);
    `);
}

async function main() {
  const rows = readCsv(csvPath);
  const scopes = buildScopes(rows);
  const summary = scopes.reduce((acc, scope) => {
    acc[scope.scope_level] = (acc[scope.scope_level] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    job: 'populate-geo-scope-catalog-csv',
    mode: dryRun ? 'dry-run' : 'apply',
    csvPath,
    csvRows: rows.length,
    scopes: scopes.length,
    summary,
    sample: scopes.slice(0, 10),
  }, null, 2));

  if (dryRun) return;

  const config = getConfig();
  if (!config.server || !config.database || !config.user) {
    throw new Error('Faltan variables GT_ANTOJADOS_* para conectar SQL.');
  }

  const pool = await sql.connect(config);
  try {
    await ensureTable(pool);
    for (const scope of scopes) {
      await upsertScope(pool, scope);
    }
  } finally {
    await pool.close();
  }

  console.log(JSON.stringify({ appliedScopes: scopes.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
