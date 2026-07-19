'use strict';
/**
 * db.js — Pool Manager de Bases de Datos
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      Infraestructura — Conexiones a bases de datos SQL Server
 * RESPONSABLE:  Administrar 5 pools de conexión (GT_APP, GT_ANALYTICS,
 *               GT_INTEGRATION, GT_ANTOJADOS, GT_EXPLORER_APP) y
 *               exponerlos mediante getPool(name).
 *
 * NO HACE:
 *   - No implementa lógica de negocio
 *   - No define schemas ni modelos de datos
 *   - No migra esquemas
 *
 * POOLS:
 *   getPool('antojados')   → antojados_core (biz_posts, soc_posts, etc.)
 *   getPool('integration') → integración analítica (eventos, ingesta)
 *   getPool('analytics')   → datos analíticos (reportes, dashboards)
 *   getPool('explorerApp') → ATLX_EXPLORER_APP
 *   getPool() default      → GT_APP (pool genérico)
 *
 * REGLAS:
 *   - Feed de AntojadosMX usa getPool('antojados') exclusivamente.
 *   - Eventos analíticos (likes, views) usan getPool('integration').
 *
 * REFERENCIAS:
 *   - antojadosmx/docs/feed.md (Sección 11: dependencias de pool)
 *   - apps-antojados/Api_getaway_antojadosmx/.env (config de pools)
 * ══════════════════════════════════════════════════════════════════════════════
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const sql = require('mssql');

function poolConfig(server, port, database, user, password, trustCert) {
  return {
    server,
    port: parseInt(port, 10),
    database,
    user,
    password,
        options: {
      encrypt: process.env.GT_APP_ENCRYPT === 'true',
      trustServerCertificate: trustCert === 'true' || trustCert === true,
      enableQuotedIdentifier: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
}

let poolApp, poolAnalytics, poolIntegration, poolAntojados, poolExplorerApp;

async function connectAll() {
  poolApp = await new sql.ConnectionPool(
    poolConfig(
      process.env.GT_APP_SERVER,
      process.env.GT_APP_PORT || 1433,
      process.env.GT_APP_NAME,
      process.env.GT_APP_USER,
      process.env.GT_APP_PASS,
      process.env.GT_APP_TRUST_CERT
    )
  ).connect();

  poolAnalytics = await new sql.ConnectionPool(
    poolConfig(
      process.env.GT_ANALYTICS_SERVER,
      process.env.GT_ANALYTICS_PORT || 1433,
      process.env.GT_ANALYTICS_NAME,
      process.env.GT_ANALYTICS_USER,
      process.env.GT_ANALYTICS_PASS,
      process.env.GT_ANALYTICS_TRUST_CERT
    )
  ).connect();

  poolIntegration = await new sql.ConnectionPool(
    poolConfig(
      process.env.GT_INTEGRATION_SERVER,
      process.env.GT_INTEGRATION_PORT || 1433,
      process.env.GT_INTEGRATION_NAME,
      process.env.GT_INTEGRATION_USER,
      process.env.GT_INTEGRATION_PASS,
      process.env.GT_INTEGRATION_TRUST_CERT
    )
  ).connect();

  poolAntojados = await new sql.ConnectionPool(
    poolConfig(
      process.env.GT_ANTOJADOS_SERVER,
      process.env.GT_ANTOJADOS_PORT || 1433,
      process.env.GT_ANTOJADOS_NAME,
      process.env.GT_ANTOJADOS_USER,
      process.env.GT_ANTOJADOS_PASS,
      process.env.GT_ANTOJADOS_TRUST_CERT
    )
  ).connect();

    // Explorer App comparte servidor y credenciales con Antojados, apunta a DB distinta
  poolExplorerApp = await new sql.ConnectionPool(
    poolConfig(
      process.env.GT_EXPLORER_APP_SERVER || process.env.GT_ANTOJADOS_SERVER,
      process.env.GT_EXPLORER_APP_PORT || process.env.GT_ANTOJADOS_PORT || 1433,
      process.env.GT_EXPLORER_APP_NAME || 'ATLX_EXPLORER_APP',
      process.env.GT_EXPLORER_APP_USER || process.env.GT_ANTOJADOS_USER || 'sa',
      process.env.GT_EXPLORER_APP_PASS || process.env.GT_ANTOJADOS_PASS,
      process.env.GT_EXPLORER_APP_TRUST_CERT || process.env.GT_ANTOJADOS_TRUST_CERT
    )
  ).connect();

  console.log('[db] Pools conectados: GT_APP, GT_ANALYTICS, GT_INTEGRATION, GT_ANTOJADOS, GT_EXPLORER_APP');
}

function getPool(name) {
  if (name === 'analytics') return poolAnalytics;
  if (name === 'integration') return poolIntegration;
  if (name === 'antojados') return poolAntojados;
  if (name === 'explorerApp') return poolExplorerApp;
  return poolApp;
}

module.exports = { connectAll, getPool, sql };
