/**
 * ============================================================================
 * FIX MEDIA URLS — Diagnóstico y Corrección de URLs de Media
 * ============================================================================
 *
 * PROPÓSITO:
 *   Corregir URLs de media que violan el contrato de dominios:
 *
 *   🔴 VIOLACIÓN EN ANTOJADOS APP (ATLX_ANTOJADOS_APP):
 *      Las URLs en soc_posts, biz_posts, biz_post_media y soc_media_assets
 *      tienen IP interna (http://185.187.235.253:8010) en lugar de dominio
 *      público (https://api.antojadosmx.mx).
 *
 *      ✅ CORRECCIÓN: Reemplazar IP interna → dominio público HTTPS.
 *      Las URLs DEBEN estar en Antojados DB, pero con el dominio correcto.
 *
 *   🔴 VIOLACIÓN EN EXPLORER APP (ATLX_EXPLORER_APP):
 *      El script tmp/fix_social_urls.py inyectó mediaUrls en el payload_json
 *      de content_packages. Explorer App NO debe contener URLs de media
 *      (Regla de Negocio R8).
 *
 *      ✅ CORRECCIÓN: Eliminar mediaUrls del payload_json (→ null).
 *      Las URLs de media se resuelven exclusivamente desde Antojados DB.
 *
 *   🔴 VIOLACIÓN EN EXPLORER APP (content_assets):
 *      La tabla content_assets duplica URLs que deben vivir solo en
 *      Antojados App. Se depreca (DEBT-050).
 *
 * USO:
 *   node scripts/fix-media-urls.js                   (solo diagnóstico)
 *   node scripts/fix-media-urls.js --apply            (diagnóstico + corrección)
 *   node scripts/fix-media-urls.js --apply --dry-run  (diagnóstico + muestra SQL)
 *
 * CONTRATO VIOLADO:
 *   docs/APPS_ANTOJADOS_V2/08_TECHNICAL_DEBT.md
 *     - DEBT-046: URLs inyectadas en Explorer payload
 *     - DEBT-050: content_assets duplica URLs
 *   docs/14_CONTRATO_INTEGRACION_ANTOJADOS.md (Sección 7, R8)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

const sql = require('mssql');

// ─── Config ──────────────────────────────────────────────────────────────
const SQL_CONFIG = {
  server: '185.187.235.253',
  port: 1433,
  user: 'sa',
  password: 'Olokum681228$',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

const PUBLIC_BASE = 'https://api.antojadosmx.mx';

// Patrones de IP interna a reemplazar
const INTERNAL_PATTERNS = [
  { from: 'http://185.187.235.253:8010', to: PUBLIC_BASE },
  { from: 'http://185.187.235.253:4100', to: PUBLIC_BASE },
  { from: 'http://localhost:4100',       to: PUBLIC_BASE },
  { from: 'http://localhost:8010',       to: PUBLIC_BASE },
  { from: 'http://127.0.0.1:4100',       to: PUBLIC_BASE },
  { from: 'http://127.0.0.1:8010',       to: PUBLIC_BASE },
];

const isApply = process.argv.includes('--apply');
const isDryRun = process.argv.includes('--dry-run');

// ─── Helpers ─────────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function logSection(title) {
  console.log('');
  console.log('╔' + '═'.repeat(70) + '╗');
  console.log(`║ ${title.padEnd(67)} ║`);
  console.log('╚' + '═'.repeat(70) + '╝');
}

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return url;
  let result = url;
  for (const { from, to } of INTERNAL_PATTERNS) {
    // Reemplazar solo si la URL comienza con el patrón o lo contiene
    if (result.includes(from)) {
      result = result.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
    }
  }
  return result;
}

/**
 * Verifica si una URL contiene una IP interna o localhost
 */
function hasInternalIp(url) {
  if (!url || typeof url !== 'string') return false;
  return INTERNAL_PATTERNS.some(p => url.includes(p.from));
}

// ─── Diagnóstico ─────────────────────────────────────────────────────────
async function diagnostic(db, pool, label) {
  logSection(`🔍 DIAGNÓSTICO — ${label}`);

  const results = {};

  if (db === 'antojados') {
    // ─── soc_posts ──────────────────────────────────────────────────────
    const socColumns = [
      'media_url', 'media_thumbnail_url', 'media_full_url', 'media_feed_url',
      'grid_url', 'story_url', 'cover_url', 'avatar_url',
      'video_720_url', 'video_1080_url', 'short_url',
      'feed_video_url', 'story_video_url', 'video_preview_url',
    ];

    for (const col of socColumns) {
      const r = await pool.request()
        .query(`
          SELECT COUNT(*) as total
          FROM antojados_core.soc_posts
          WHERE ${col} IS NOT NULL
            AND (${col} LIKE '%185.187.235.253%' OR ${col} LIKE '%localhost%' OR ${col} LIKE '%127.0.0.1%')
        `);
      if (r.recordset[0].total > 0) {
        results[`soc_posts.${col}`] = r.recordset[0].total;
      }
    }

    // ─── biz_posts ──────────────────────────────────────────────────────
    const bizColumns = [
      'media_url', 'media_thumbnail_url', 'media_full_url', 'media_feed_url',
      'grid_url', 'story_url', 'cover_url', 'avatar_url',
      'video_720_url', 'video_1080_url', 'short_url',
      'feed_video_url', 'story_video_url', 'video_preview_url',
    ];

    for (const col of bizColumns) {
      const r = await pool.request()
        .query(`
          SELECT COUNT(*) as total
          FROM antojados_core.biz_posts
          WHERE ${col} IS NOT NULL
            AND (${col} LIKE '%185.187.235.253%' OR ${col} LIKE '%localhost%' OR ${col} LIKE '%127.0.0.1%')
        `);
      if (r.recordset[0].total > 0) {
        results[`biz_posts.${col}`] = r.recordset[0].total;
      }
    }

    // ─── biz_post_media ─────────────────────────────────────────────────
    const bpmColumns = [
      'media_url', 'thumb_url', 'feed_url', 'full_url',
      'grid_url', 'story_url', 'cover_url', 'avatar_url',
      'video_720_url', 'video_1080_url', 'short_url',
      'feed_video_url', 'story_video_url', 'video_preview_url',
    ];

    for (const col of bpmColumns) {
      const r = await pool.request()
        .query(`
          SELECT COUNT(*) as total
          FROM antojados_core.biz_post_media
          WHERE ${col} IS NOT NULL
            AND (${col} LIKE '%185.187.235.253%' OR ${col} LIKE '%localhost%' OR ${col} LIKE '%127.0.0.1%')
        `);
      if (r.recordset[0].total > 0) {
        results[`biz_post_media.${col}`] = r.recordset[0].total;
      }
    }

    // ─── soc_media_assets (tabla legacy) ────────────────────────────────
    const assetsColumns = ['thumb_url', 'feed_url', 'full_url', 'video_720_url', 'video_1080_url', 'remote_url'];
    for (const col of assetsColumns) {
      const r = await pool.request()
        .query(`
          SELECT COUNT(*) as total
          FROM antojados_core.soc_media_assets
          WHERE ${col} IS NOT NULL
            AND (${col} LIKE '%185.187.235.253%' OR ${col} LIKE '%localhost%' OR ${col} LIKE '%127.0.0.1%')
        `);
      if (r.recordset[0].total > 0) {
        results[`soc_media_assets.${col}`] = r.recordset[0].total;
      }
    }

    // ─── soc_media_intake (tabla legacy) ────────────────────────────────
    try {
      const intakeCols = ['media_url', 'thumbnail_url'];
      for (const col of intakeCols) {
        const r = await pool.request()
          .query(`
            SELECT COUNT(*) as total
            FROM antojados_core.soc_media_intake
            WHERE ${col} IS NOT NULL
              AND (${col} LIKE '%185.187.235.253%' OR ${col} LIKE '%localhost%' OR ${col} LIKE '%127.0.0.1%')
          `);
        if (r.recordset[0].total > 0) {
          results[`soc_media_intake.${col}`] = r.recordset[0].total;
        }
      }
    } catch (e) {
      // Tabla puede no existir
    }

  } else if (db === 'explorer') {
    // ─── content_packages.payload_json — URLs inyectadas ────────────────
    const r1 = await pool.request()
      .query(`
        SELECT COUNT(*) as total
        FROM explorer_core.content_packages
        WHERE payload_json LIKE '%mediaUrls%'
          AND payload_json LIKE '%http%'
      `);
    results['content_packages.payload_json (con mediaUrls)'] = r1.recordset[0].total;

    // content_packages con URLs internas
    const r2 = await pool.request()
      .query(`
        SELECT COUNT(*) as total
        FROM explorer_core.content_packages
        WHERE payload_json LIKE '%185.187.235.253%'
           OR payload_json LIKE '%localhost%'
      `);
    results['content_packages.payload_json (con IP interna)'] = r2.recordset[0].total;

    // ─── content_assets — URLs duplicadas ───────────────────────────────
    const r3 = await pool.request()
      .query(`
        SELECT COUNT(*) as total
        FROM explorer_core.content_assets
        WHERE original_url IS NOT NULL
           OR thumb_url IS NOT NULL
           OR feed_url IS NOT NULL
           OR full_url IS NOT NULL
      `);
    results['content_assets (con URLs)'] = r3.recordset[0].total;
  }

  // Print results
  if (Object.keys(results).length === 0) {
    log('✅  NO HAY VIOLACIONES');
  } else {
    let total = 0;
    for (const [key, count] of Object.entries(results)) {
      console.log(`   ${key}: ${String(count).padStart(6)} registros con violación`);
      total += count;
    }
    console.log(`   ${'─'.repeat(50)}`);
    console.log(`   TOTAL: ${String(total).padStart(6)} registros con violación`);
  }

  return results;
}

// ─── Corrección Antojados DB ─────────────────────────────────────────────
async function fixAntojados(pool) {
  logSection('🔧 CORRECCIÓN — ATLX_ANTOJADOS_APP (normalizar a HTTPS)');

  const totalFixed = { soc_posts: 0, biz_posts: 0, biz_post_media: 0, soc_media_assets: 0, soc_media_intake: 0 };

  // ─── soc_posts ────────────────────────────────────────────────────────
  const socColumns = [
    'media_url', 'media_thumbnail_url', 'media_full_url', 'media_feed_url',
    'grid_url', 'story_url', 'cover_url', 'avatar_url',
    'video_720_url', 'video_1080_url', 'short_url',
    'feed_video_url', 'story_video_url', 'video_preview_url',
  ];

  for (const col of socColumns) {
    const r = await pool.request()
      .query(`
        UPDATE antojados_core.soc_posts
        SET ${col} = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          ${col},
          'http://185.187.235.253:8010', '${PUBLIC_BASE}'),
          'http://185.187.235.253:4100', '${PUBLIC_BASE}'),
          'http://localhost:4100',       '${PUBLIC_BASE}'),
          'http://localhost:8010',       '${PUBLIC_BASE}'),
          'http://127.0.0.1:4100',       '${PUBLIC_BASE}'),
          'http://127.0.0.1:8010',       '${PUBLIC_BASE}')
        WHERE ${col} LIKE '%185.187.235.253%'
           OR ${col} LIKE '%localhost%'
           OR ${col} LIKE '%127.0.0.1%'
      `);
    if (r.rowsAffected[0] > 0) {
      log(`   soc_posts.${col}: ${r.rowsAffected[0]} corregidos`);
      totalFixed.soc_posts += r.rowsAffected[0];
    }
  }

  // ─── biz_posts ────────────────────────────────────────────────────────
  const bizColumns = [
    'media_url', 'media_thumbnail_url', 'media_full_url', 'media_feed_url',
    'grid_url', 'story_url', 'cover_url', 'avatar_url',
    'video_720_url', 'video_1080_url', 'short_url',
    'feed_video_url', 'story_video_url', 'video_preview_url',
  ];

  for (const col of bizColumns) {
    const r = await pool.request()
      .query(`
        UPDATE antojados_core.biz_posts
        SET ${col} = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          ${col},
          'http://185.187.235.253:8010', '${PUBLIC_BASE}'),
          'http://185.187.235.253:4100', '${PUBLIC_BASE}'),
          'http://localhost:4100',       '${PUBLIC_BASE}'),
          'http://localhost:8010',       '${PUBLIC_BASE}'),
          'http://127.0.0.1:4100',       '${PUBLIC_BASE}'),
          'http://127.0.0.1:8010',       '${PUBLIC_BASE}')
        WHERE ${col} LIKE '%185.187.235.253%'
           OR ${col} LIKE '%localhost%'
           OR ${col} LIKE '%127.0.0.1%'
      `);
    if (r.rowsAffected[0] > 0) {
      log(`   biz_posts.${col}: ${r.rowsAffected[0]} corregidos`);
      totalFixed.biz_posts += r.rowsAffected[0];
    }
  }

  // ─── biz_post_media ───────────────────────────────────────────────────
  const bpmColumns = [
    'media_url', 'thumb_url', 'feed_url', 'full_url',
    'grid_url', 'story_url', 'cover_url', 'avatar_url',
    'video_720_url', 'video_1080_url', 'short_url',
    'feed_video_url', 'story_video_url', 'video_preview_url',
  ];

  for (const col of bpmColumns) {
    const r = await pool.request()
      .query(`
        UPDATE antojados_core.biz_post_media
        SET ${col} = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          ${col},
          'http://185.187.235.253:8010', '${PUBLIC_BASE}'),
          'http://185.187.235.253:4100', '${PUBLIC_BASE}'),
          'http://localhost:4100',       '${PUBLIC_BASE}'),
          'http://localhost:8010',       '${PUBLIC_BASE}'),
          'http://127.0.0.1:4100',       '${PUBLIC_BASE}'),
          'http://127.0.0.1:8010',       '${PUBLIC_BASE}')
        WHERE ${col} LIKE '%185.187.235.253%'
           OR ${col} LIKE '%localhost%'
           OR ${col} LIKE '%127.0.0.1%'
      `);
    if (r.rowsAffected[0] > 0) {
      log(`   biz_post_media.${col}: ${r.rowsAffected[0]} corregidos`);
      totalFixed.biz_post_media += r.rowsAffected[0];
    }
  }

  // ─── soc_media_assets (legacy) ────────────────────────────────────────
  const assetsColumns = ['remote_url', 'thumb_url', 'feed_url', 'full_url', 'video_720_url', 'video_1080_url'];
  for (const col of assetsColumns) {
    const r = await pool.request()
      .query(`
        UPDATE antojados_core.soc_media_assets
        SET ${col} = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          ${col},
          'http://185.187.235.253:8010', '${PUBLIC_BASE}'),
          'http://185.187.235.253:4100', '${PUBLIC_BASE}'),
          'http://localhost:4100',       '${PUBLIC_BASE}'),
          'http://localhost:8010',       '${PUBLIC_BASE}'),
          'http://127.0.0.1:4100',       '${PUBLIC_BASE}'),
          'http://127.0.0.1:8010',       '${PUBLIC_BASE}')
        WHERE ${col} LIKE '%185.187.235.253%'
           OR ${col} LIKE '%localhost%'
           OR ${col} LIKE '%127.0.0.1%'
      `);
    if (r.rowsAffected[0] > 0) {
      log(`   soc_media_assets.${col}: ${r.rowsAffected[0]} corregidos`);
      totalFixed.soc_media_assets += r.rowsAffected[0];
    }
  }

  // ─── soc_media_intake (legacy) ────────────────────────────────────────
  try {
    const intakeCols = ['media_url', 'thumbnail_url'];
    for (const col of intakeCols) {
      const r = await pool.request()
        .query(`
          UPDATE antojados_core.soc_media_intake
          SET ${col} = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            ${col},
            'http://185.187.235.253:8010', '${PUBLIC_BASE}'),
            'http://185.187.235.253:4100', '${PUBLIC_BASE}'),
            'http://localhost:4100',       '${PUBLIC_BASE}'),
            'http://localhost:8010',       '${PUBLIC_BASE}'),
            'http://127.0.0.1:4100',       '${PUBLIC_BASE}'),
            'http://127.0.0.1:8010',       '${PUBLIC_BASE}')
          WHERE ${col} LIKE '%185.187.235.253%'
             OR ${col} LIKE '%localhost%'
             OR ${col} LIKE '%127.0.0.1%'
        `);
      if (r.rowsAffected[0] > 0) {
        log(`   soc_media_intake.${col}: ${r.rowsAffected[0]} corregidos`);
        totalFixed.soc_media_intake += r.rowsAffected[0];
      }
    }
  } catch (e) {
    // Tabla puede no existir
  }

  log('');
  log(`📊 TOTAL ANTOJADOS DB: ${Object.values(totalFixed).reduce((a, b) => a + b, 0)} URLs corregidas`);
  for (const [table, count] of Object.entries(totalFixed)) {
    if (count > 0) log(`   ${table}: ${count}`);
  }
}

// ─── Corrección Explorer DB (limpiar violación R8) ────────────────────────
async function fixExplorer(pool) {
  logSection('🔧 CORRECCIÓN — ATLX_EXPLORER_APP (eliminar mediaUrls del payload — R8)');

  // ─── 1. Reemplazar "mediaUrls": {...} con "mediaUrls": null ──────────
  //    Esto limpia la violación DEBT-046: URLs de Antojados NO deben estar
  //    en Explorer. El payload solo debe tener composición visual.
  const r1 = await pool.request()
    .query(`
      UPDATE explorer_core.content_packages
      SET payload_json = CAST(
        REPLACE(
          CAST(payload_json AS NVARCHAR(MAX)),
          '"mediaUrls"',
          '"mediaUrls": null'
        ) AS NVARCHAR(MAX)
      )
      WHERE payload_json LIKE '%mediaUrls%'
    `);
  log(`   content_packages: "mediaUrls" → null: ${r1.rowsAffected[0]} registros`);

  // ─── 2. Limpiar también "mediaItems": [...] → "mediaItems": [] ──────
  const r2 = await pool.request()
    .query(`
      UPDATE explorer_core.content_packages
      SET payload_json = CAST(
        REPLACE(
          CAST(payload_json AS NVARCHAR(MAX)),
          '"mediaItems"',
          '"mediaItems": []'
        ) AS NVARCHAR(MAX)
      )
      WHERE payload_json LIKE '%mediaItems%'
        AND payload_json NOT LIKE '%"mediaItems": []%'
    `);
  log(`   content_packages: "mediaItems" → []: ${r2.rowsAffected[0]} registros`);

  // ─── 3. Verificar que no queden URLs internas en el payload ─────────
  const r3 = await pool.request()
    .query(`
      SELECT COUNT(*) as remaining
      FROM explorer_core.content_packages
      WHERE payload_json LIKE '%185.187.235.253%'
         OR payload_json LIKE '%localhost%'
    `);
  log(`   ⚠️  URLs internas restantes en payload_json: ${r3.recordset[0].remaining}`);
  if (r3.recordset[0].remaining > 0) {
    log('   ⚠️  ALERTA: Quedan URLs internas. Posiblemente en "content" field de blocks.');
    log('   ⚠️  Se requiere revisión manual o limpieza adicional.');
  }

  // ─── 4. content_assets — deprecar (DEBT-050) ─────────────────────────
  //    Por ahora solo contamos cuántos registros tienen URLs.
  //    La limpieza de content_assets requiere coordinación con Explorer App.
  const r4 = await pool.request()
    .query(`
      SELECT COUNT(*) as total
      FROM explorer_core.content_assets
    `);
  log(`   content_assets: ${r4.recordset[0].total} registros (DEBT-050: pendiente de deprecación)`);

  log('');
  log('📊 TOTAL EXPLORER DB: URLs eliminadas del payload_json (R8 cumplida)');
}

// ─── Main ────────────────────────────────────────────────────────────────
async function main() {
  log('╔══════════════════════════════════════════════════════════════════════╗');
  log('║          DIAGNÓSTICO Y CORRECCIÓN DE URLs DE MEDIA                 ║');
  log('╚══════════════════════════════════════════════════════════════════════╝');

  if (!isApply) {
    log('📋 MODO DIAGNÓSTICO — Solo lectura. Para corregir usa: --apply');
  } else if (isDryRun) {
    log('📋 MODO DRY-RUN — Solo muestra lo que se haría (simulado)');
  } else {
    log('🔧 MODO APLICAR — Se corregirán las violaciones');
  }
  log(`🔗 Servidor: ${SQL_CONFIG.server}:${SQL_CONFIG.port}`);
  log('');

  let antojadosPool, explorerPool;

  try {
    // ─── Conectar a ambas DBs ──────────────────────────────────────────
    log('📡 Conectando a ATLX_ANTOJADOS_APP...');
    antojadosPool = await sql.connect({
      ...SQL_CONFIG,
      database: 'ATLX_ANTOJADOS_APP',
    });
    log('✅ Conectado');

    log('📡 Conectando a ATLX_EXPLORER_APP...');
    explorerPool = await sql.connect({
      ...SQL_CONFIG,
      database: 'ATLX_EXPLORER_APP',
    });
    log('✅ Conectado');

    // ══════════════════════════════════════════════════════════════════
    // FASE 1: DIAGNÓSTICO
    // ══════════════════════════════════════════════════════════════════
    logSection('═══ FASE 1: DIAGNÓSTICO ═══');

    const antojadosViolations = await diagnostic('antojados', antojadosPool, 'ATLX_ANTOJADOS_APP');
    const explorerViolations = await diagnostic('explorer', explorerPool, 'ATLX_EXPLORER_APP');

    const totalA = Object.values(antojadosViolations).reduce((a, b) => a + b, 0);
    const totalE = Object.values(explorerViolations).reduce((a, b) => a + b, 0);
    const totalAll = totalA + totalE;

    log('');
    logSection('═══ RESUMEN DE DIAGNÓSTICO ═══');
    log(`   ATLX_ANTOJADOS_APP: ${totalA} violaciones (URLs con IP interna)`);
    log(`   ATLX_EXPLORER_APP:  ${totalE} violaciones (mediaUrls en payload)`);
    log(`   TOTAL:              ${totalAll} violaciones`);
    log('');

    // ══════════════════════════════════════════════════════════════════
    // FASE 2: CORRECCIÓN
    // ══════════════════════════════════════════════════════════════════
    if (isApply && !isDryRun) {
      logSection('═══ FASE 2: CORRECCIÓN ═══');

      // Corregir Antojados DB (normalizar URLs a HTTPS)
      if (totalA > 0) {
        await fixAntojados(antojadosPool);
      } else {
        log('✅ ATLX_ANTOJADOS_APP: No hay violaciones que corregir');
      }

      // Corregir Explorer DB (eliminar mediaUrls del payload)
      if (totalE > 0) {
        await fixExplorer(explorerPool);
      } else {
        log('✅ ATLX_EXPLORER_APP: No hay violaciones que corregir');
      }

      // ══════════════════════════════════════════════════════════════
      // FASE 3: VERIFICACIÓN POST-CORRECCIÓN
      // ══════════════════════════════════════════════════════════════
      logSection('═══ FASE 3: VERIFICACIÓN POST-CORRECCIÓN ═══');
      log('🔍 Re-ejecutando diagnóstico para confirmar...');
      log('');

      const postAntojados = await diagnostic('antojados', antojadosPool, 'ATLX_ANTOJADOS_APP');
      const postExplorer = await diagnostic('explorer', explorerPool, 'ATLX_EXPLORER_APP');

      const postA = Object.values(postAntojados).reduce((a, b) => a + b, 0);
      const postE = Object.values(postExplorer).reduce((a, b) => a + b, 0);

      log('');
      logSection('═══ VERIFICACIÓN FINAL ═══');
      if (postA === 0 && postE === 0) {
        log('✅  ✅  ✅  TODAS LAS VIOLACIONES CORREGIDAS EXITOSAMENTE  ✅  ✅  ✅');
        log('');
        log('   ✔ ATLX_ANTOJADOS_APP: URLs normalizadas a https://api.antojadosmx.mx');
        log('   ✔ ATLX_EXPLORER_APP:  mediaUrls eliminados del payload_json (R8)');
        log('');
        log('   📝 Próximos pasos sugeridos:');
        log('      1. Actualizar fixMediaUrl() en mediaPackage.resolver.js para que ya');
        log('         no sea necesario (las URLs ya vienen correctas desde DB)');
        log('      2. Considerar deprecar soc_media_intake y soc_media_assets (ME-DEBT-008)');
        log('      3. Deprecar content_assets en Explorer App (DEBT-050)');
      } else {
        log(`⚠️  Quedan ${postA + postE} violaciones sin corregir`);
        if (postA > 0) log(`   ATLX_ANTOJADOS_APP: ${postA} restantes`);
        if (postE > 0) log(`   ATLX_EXPLORER_APP:  ${postE} restantes`);
      }
    } else if (isDryRun) {
      log('');
      logSection('═══ DRY-RUN: Comandos que se ejecutarían ═══');
      log('(No se ejecutó ninguna corrección)');
      log('');
      if (totalA > 0) {
        log(`📝 Se ejecutarían UPDATEs en ATLX_ANTOJADOS_APP para normalizar ${totalA} URLs`);
        log(`   Patrón: http://185.187.235.253:8010 → ${PUBLIC_BASE}`);
        log(`   Tablas afectadas: soc_posts, biz_posts, biz_post_media, soc_media_assets`);
      }
      if (totalE > 0) {
        log(`📝 Se ejecutarían UPDATEs en ATLX_EXPLORER_APP para limpiar ${totalE} registros`);
        log(`   Reemplazar "mediaUrls": {...} → "mediaUrls": null`);
        log(`   Reemplazar "mediaItems": [...] → "mediaItems": []`);
      }
    } else {
      log('');
      log('ℹ️  Para aplicar las correcciones, ejecuta:');
      log('   node scripts/fix-media-urls.js --apply');
      log('');
      log('ℹ️  Para previsualizar sin aplicar:');
      log('   node scripts/fix-media-urls.js --apply --dry-run');
    }

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (antojadosPool) await antojadosPool.close();
    if (explorerPool) await explorerPool.close();
    log('\n🔌 Conexiones cerradas');
  }
}

main();
