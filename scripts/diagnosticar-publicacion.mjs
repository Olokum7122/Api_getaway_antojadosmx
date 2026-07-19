#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════════════════
 * diagnosticar-publicacion.mjs — Script de diagnóstico de publicación de posts
 *
 * DOMINIO:      AntojadosMX — Diagnóstico en Producción
 * RESPONSABLE:  Probar el flujo completo de publicación de un post social
 *               desde el servidor (Contabo) para aislar dónde falla:
 *
 *   FASE 1: Conexión a BD y pool
 *   FASE 2: Llamada directa al SP usp_publish_soc_post
 *   FASE 3: Verificar el post insertado
 *   FASE 4: Probar con media_url larga
 *   FASE 5: Verificar logs de la API
 *
 * USO:
 *   node diagnosticar-publicacion.mjs [--user=USER_ID] [--channel=pachanga]
 *
 * ══════════════════════════════════════════════════════════════════════════════
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const path = require('path');
const fs = require('fs');

// ─── Config ──────────────────────────────────────────────────────────────
const API_DIR = path.resolve(process.cwd(), '.');
const LOG_FILE = path.join(API_DIR, 'diagnostico-publicar.log');
const ERR_FILE = path.join(API_DIR, 'diagnostico-publicar.err.log');

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function elog(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ERROR: ${msg}`;
  console.error(line);
  fs.appendFileSync(ERR_FILE, line + '\n');
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ─── Parse args ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const TEST_USER = args.find(a => a.startsWith('--user='))?.split('=')[1] || 'test-user-id';
const TEST_CHANNEL = args.find(a => a.startsWith('--channel='))?.split('=')[1] || 'pachanga';

// ─── Cargar .env ────────────────────────────────────────────────────────
const envPath = path.join(API_DIR, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

// ─── FASE 0: Verificar entorno ──────────────────────────────────────────
log('');
log('═══════════════════════════════════════════════════════════════');
log(' DIAGNÓSTICO DE PUBLICACIÓN DE POSTS SOCIALES');
log(` Iniciado: ${new Date().toLocaleString()}`);
log(` Directorio: ${API_DIR}`);
log(` User ID test: ${TEST_USER}`);
log(` Channel test: ${TEST_CHANNEL}`);
log('═══════════════════════════════════════════════════════════════');

// ─── FASE 1: Verificar conexión a BD ──────────────────────────────────
log('');
log('─── FASE 1: Conexión a Base de Datos ───────────────────────────');

let sql, poolAntojados;
try {
  sql = require('mssql');

  const config = {
    server: process.env.GT_ANTOJADOS_SERVER,
    port: parseInt(process.env.GT_ANTOJADOS_PORT || '1433', 10),
    database: process.env.GT_ANTOJADOS_NAME,
    user: process.env.GT_ANTOJADOS_USER,
    password: process.env.GT_ANTOJADOS_PASS,
    options: {
      encrypt: process.env.GT_APP_ENCRYPT === 'true',
      trustServerCertificate: true,
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };

  log(` Conectando a ${config.server}:${config.port}/${config.database}...`);
  poolAntojados = await new sql.ConnectionPool(config).connect();
  log(' ✅ Pool conectado exitosamente');
} catch (err) {
  elog(`Error conectando pool Antojados: ${err.message}`);
  process.exit(1);
}

// ─── FASE 2: Verificar que el SP existe ──────────────────────────────
log('');
log('─── FASE 2: Verificar SP usp_publish_soc_post ──────────────────');

try {
  const spCheck = await poolAntojados.request()
    .query(`
      SELECT OBJECT_ID('antojados_core.usp_publish_soc_post') AS sp_id,
             OBJECTPROPERTY(OBJECT_ID('antojados_core.usp_publish_soc_post'), 'IsProcedure') AS is_proc
    `);
  const spRow = spCheck.recordset[0];
  if (spRow?.is_proc) {
    log(` ✅ SP usp_publish_soc_post existe (object_id: ${spRow.sp_id})`);
  } else {
    elog(' ❌ SP usp_publish_soc_post NO EXISTE');

    // Buscar si existe en otro schema
    const search = await poolAntojados.request()
      .query(`
        SELECT SPECIFIC_SCHEMA, SPECIFIC_NAME, ROUTINE_TYPE
        FROM INFORMATION_SCHEMA.ROUTINES
        WHERE ROUTINE_NAME = 'usp_publish_soc_post'
      `);
    if (search.recordset.length > 0) {
      log(`  Encontrado en: ${search.recordset[0].SPECIFIC_SCHEMA}.${search.recordset[0].SPECIFIC_NAME}`);
    } else {
      elog('  No encontrado en ningún schema');
    }
  }
} catch (err) {
  elog(`Error verificando SP: ${err.message}`);
}

// ─── FASE 3: Verificar columnas de soc_posts ───────────────────────────
log('');
log('─── FASE 3: Verificar estructura de soc_posts ──────────────────');

try {
  const cols = await poolAntojados.request()
    .query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'antojados_core' AND TABLE_NAME = 'soc_posts'
      ORDER BY ORDINAL_POSITION
    `);
  log(` Columnas de soc_posts (${cols.recordset.length}):`);
  for (const col of cols.recordset) {
    const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
    const len = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
    log(`   ${col.COLUMN_NAME.padEnd(25)} ${col.DATA_TYPE}${len} ${nullable}`);
  }
} catch (err) {
  elog(`Error obteniendo columnas: ${err.message}`);
}

// ─── FASE 4: Probar el SP con datos reales ──────────────────────────
log('');
log('─── FASE 4: Ejecutar SP usp_publish_soc_post ──────────────────');

const testDocJson = JSON.stringify({
  badge: 'SOCIAL',
  titulo: 'Test diagnóstico',
  descripcion: 'Publicación de prueba desde script diagnóstico',
  descripciones: ['Test diagnóstico', 'Publicación de prueba']
});

// Test 1: Sin media_url (mínimo)
let testPostId1 = null;
log(' Test 4.1: Sin media_url (campos mínimos)');
try {
  const req1 = poolAntojados.request()
    .input('user_id', sql.NVarChar(64), TEST_USER)
    .input('channel', sql.NVarChar(30), TEST_CHANNEL)
    .input('feed_type', sql.NVarChar(30), 'default')
    .input('city_code', sql.NVarChar(20), null)
    .input('zone_code', sql.NVarChar(20), null)
    .input('media_url', sql.NVarChar(500), null)
    .input('doc_json', sql.NVarChar(sql.MAX), testDocJson)
    .output('post_id', sql.NVarChar(64));

  await req1.execute('antojados_core.usp_publish_soc_post');
  testPostId1 = req1.output.post_id;
  log(`  ✅ Post creado: post_id = ${testPostId1}`);
} catch (err) {
  elog(`  ❌ Error en Test 4.1: ${err.message}`);
  if (err.number) elog(`     SQL Error #${err.number}: ${err.message}`);
}

// Test 2: Con media_url normal
let testPostId2 = null;
log(' Test 4.2: Con media_url normal');
try {
  const req2 = poolAntojados.request()
    .input('user_id', sql.NVarChar(64), TEST_USER)
    .input('channel', sql.NVarChar(30), TEST_CHANNEL)
    .input('feed_type', sql.NVarChar(30), 'default')
    .input('city_code', sql.NVarChar(20), null)
    .input('zone_code', sql.NVarChar(20), null)
    .input('media_url', sql.NVarChar(500), 'https://media.antojadosmx.mx/media/2024/07/test-image.webp')
    .input('doc_json', sql.NVarChar(sql.MAX), testDocJson)
    .output('post_id', sql.NVarChar(64));

  await req2.execute('antojados_core.usp_publish_soc_post');
  testPostId2 = req2.output.post_id;
  log(`  ✅ Post creado: post_id = ${testPostId2}`);
} catch (err) {
  elog(`  ❌ Error en Test 4.2: ${err.message}`);
}

// Test 3: Con media_url larga (>500 chars)
let testPostId3 = null;
log(' Test 4.3: Con media_url larga (>500 chars)');
try {
  const longUrl = 'https://media.antojadosmx.mx/media/2024/07/' + 'a'.repeat(480) + '.webp';
  const req3 = poolAntojados.request()
    .input('user_id', sql.NVarChar(64), TEST_USER)
    .input('channel', sql.NVarChar(30), TEST_CHANNEL)
    .input('feed_type', sql.NVarChar(30), 'default')
    .input('city_code', sql.NVarChar(20), null)
    .input('zone_code', sql.NVarChar(20), null)
    .input('media_url', sql.NVarChar(500), longUrl)
    .input('doc_json', sql.NVarChar(sql.MAX), testDocJson)
    .output('post_id', sql.NVarChar(64));

  await req3.execute('antojados_core.usp_publish_soc_post');
  testPostId3 = req3.output.post_id;
  log(`  ✅ Post creado con URL larga: post_id = ${testPostId3}`);
} catch (err) {
  elog(`  ❌ Error en Test 4.3 (URL larga): ${err.message}`);
  if (err.number === 8152) elog('     → ERROR DE TRUNCATION! La URL excede NVARCHAR(500)');
}

// ─── FASE 5: Probar con el mismo flow que el API Gateway ──────────
log('');
log('─── FASE 5: Simular flujo completo del Gateway ────────────────');

log(' Test 5.1: Simular postsResolver.createPost (sin asset_id)');
try {
  // Simular publishSocPost del resolver
  const resolvedMediaUrl = 'https://media.antojadosmx.mx/media/2024/07/test-from-gateway.webp';

  const req5 = poolAntojados.request()
    .input('user_id', sql.NVarChar(64), TEST_USER)
    .input('channel', sql.NVarChar(30), TEST_CHANNEL)
    .input('feed_type', sql.NVarChar(30), 'default')
    .input('media_url', sql.NVarChar(500), resolvedMediaUrl)
    .input('doc_json', sql.NVarChar(sql.MAX), testDocJson)
    .input('city_code', sql.NVarChar(20), null)
    .input('zone_code', sql.NVarChar(20), null)
    .output('post_id', sql.NVarChar(64));

  await req5.execute('antojados_core.usp_publish_soc_post');

  const postId = req5.output.post_id;
  log(`  ✅ Post creado con ID: ${postId}`);

  // Verificar que se insertó correctamente
  const verify = await poolAntojados.request()
    .input('pid', sql.NVarChar(64), postId)
    .query('SELECT post_id, user_id, channel, media_url, doc_json, status, created_at FROM antojados_core.soc_posts WHERE post_id = @pid');

  if (verify.recordset.length > 0) {
    const p = verify.recordset[0];
    log(`  ✅ Verificación exitosa:`);
    log(`     post_id:   ${p.post_id}`);
    log(`     user_id:   ${p.user_id}`);
    log(`     channel:   ${p.channel}`);
    log(`     media_url: ${p.media_url?.substring(0, 80)}...`);
    log(`     doc_json:  ${p.doc_json?.substring(0, 80)}...`);
    log(`     status:    ${p.status}`);
    log(`     created:   ${p.created_at}`);
  } else {
    elog('  ❌ El post no se encontró después de insertar!');
  }
} catch (err) {
  elog(`  ❌ Error en Test 5.1: ${err.message}`);
  if (err.number) elog(`     SQL Error #${err.number}`);
}

// ─── FASE 6: Verificar logs de la API ──────────────────────────
log('');
log('─── FASE 6: Verificar logs de PM2 ───────────────────────────');

try {
  const pm2Log = require('child_process').execSync('pm2 logs api_antojados --lines 50 --nostream 2>/dev/null || echo "PM2 no disponible"');
  log(' Últimas líneas de PM2:');
  log(pm2Log.toString().substring(0, 2000));
} catch (err) {
  log(' (PM2 no disponible o no es el proceso correcto)');
}

// ─── FASE 7: Verificar tamaño de media_url del Engine ──────────
log('');
log('─── FASE 7: URLs que devuelve el Media Engine ──────────────');

// Esto es informativo - muestra las URLs típicas
log(' URLs típicas del Engine (para verificar longitud):');
const sampleUrls = [
  'https://media.antojadosmx.mx/media/2024/07/550e8400-e29b-41d4-a716-446655440000/thumb-400.webp',
  'https://media.antojadosmx.mx/media/2024/07/550e8400-e29b-41d4-a716-446655440000/feed-1080.webp',
  'https://media.antojadosmx.mx/media/2024/07/550e8400-e29b-41d4-a716-446655440000/full-1920.webp',
  'https://media.antojadosmx.mx/media/2024/07/550e8400-e29b-41d4-a716-446655440000/video-720.mp4',
];
for (const url of sampleUrls) {
  log(`  [${url.length} chars] ${url}`);
}

// ─── FASE 8: Limpiar posts de prueba (opcional) ────────────────
log('');
log('─── FASE 8: Limpieza ────────────────────────────────────────');

const idsToDelete = [testPostId1, testPostId2, testPostId3].filter(Boolean);
if (idsToDelete.length > 0) {
  log(` Eliminando ${idsToDelete.length} posts de prueba...`);
  try {
    for (const id of idsToDelete) {
      if (id) {
        await poolAntojados.request()
          .input('pid', sql.NVarChar(64), id)
          .query("UPDATE antojados_core.soc_posts SET status = 'deleted' WHERE post_id = @pid");
        log(`  ✅ Post ${id} marcado como deleted`);
      }
    }
  } catch (err) {
    elog(` Error limpiando posts: ${err.message}`);
  }
} else {
  log(' No hay posts de prueba para limpiar');
}

// ─── Cierre ────────────────────────────────────────────────────
log('');
log('═══════════════════════════════════════════════════════════════');
log(' DIAGNÓSTICO COMPLETADO');
log(` Log guardado en: ${LOG_FILE}`);
log(` Errores en: ${ERR_FILE}`);
log('═══════════════════════════════════════════════════════════════');

await poolAntojados.close();
log(' Conexión cerrada.');
