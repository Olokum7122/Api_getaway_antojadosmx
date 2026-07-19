/**
 * inject-post-logging.js — Inyecta logging en postsResolver.js para diagnosticar
 *
 * Agrega console.log al inicio de publishSocPost() para trackear
 * qué parámetros recibe y qué devuelve el SP.
 *
 * USO:
 *   node inject-post-logging.js           # Inyecta logs
 *   node inject-post-logging.js --remove  # Remueve logs
 *   node inject-post-logging.js --check   # Verifica si están inyectados
 *
 * ══════════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

const RESOLVER_PATH = '/opt/api_antojados/src/services/antojados/postsResolver.js';
const BACKUP_PATH = RESOLVER_PATH + '.bak.diag';

const LOG_MARKER_START = '// === DIAG LOG START ===';
const LOG_MARKER_END = '// === DIAG LOG END ===';

const DIAG_BLOCK = `
  // === DIAG LOG START ===
  console.log('[DIAG:publishSocPost] ENTER', JSON.stringify({
    user_id, channel, feed_type, city_code, zone_code,
    media_url: (media_url || '').substring(0, 100) + '...len=' + (media_url || '').length,
    doc_json: (doc_json ? JSON.stringify(doc_json).substring(0, 100) : null),
    has_asset_id: !!asset_id,
  }));
  // === DIAG LOG END ===
`;

const DIAG_BLOCK_AFTER = `
  // === DIAG LOG START ===
  console.log('[DIAG:publishSocPost] SP result', JSON.stringify({
    output_post_id: req.output.post_id,
  }));
  // === DIAG LOG END ===
`;

function hasDiagLogging(content) {
  return content.includes(LOG_MARKER_START);
}

function inject(content) {
  if (hasDiagLogging(content)) {
    console.log('⚠️  Logging ya está inyectado. Nada que hacer.');
    return content;
  }

  // Inyectar después de la línea que valida channel
  let modified = content.replace(
    'if (!channel) throw Object.assign(new Error(\'channel requerido\'), { status: 400 });',
    'if (!channel) throw Object.assign(new Error(\'channel requerido\'), { status: 400 });' + DIAG_BLOCK
  );

  // Inyectar después de req.execute
  modified = modified.replace(
    'await req.execute(\'antojados_core.usp_publish_soc_post\');',
    'await req.execute(\'antojados_core.usp_publish_soc_post\');\n' + DIAG_BLOCK_AFTER
  );

  return modified;
}

function remove(content) {
  if (!hasDiagLogging(content)) {
    console.log('⚠️  No hay logging inyectado. Nada que remover.');
    return content;
  }

  let modified = content;

  // Remover bloques de log
  const startIdx = modified.indexOf(LOG_MARKER_START);
  while (startIdx !== -1) {
    const endIdx = modified.indexOf(LOG_MARKER_END, startIdx);
    if (endIdx === -1) break;

    const beforeBlock = modified.substring(0, startIdx);
    const afterBlock = modified.substring(endIdx + LOG_MARKER_END.length);

    // También remover la línea en blanco después
    const cleanedAfter = afterBlock.startsWith('\n') ? afterBlock.substring(1) : afterBlock;
    modified = beforeBlock + cleanedAfter;

    const nextStart = modified.indexOf(LOG_MARKER_START);
    if (nextStart === -1) break;
  }

  return modified;
}

function main() {
  const mode = process.argv[2] || '--inject';

  if (!fs.existsSync(RESOLVER_PATH)) {
    console.error(`❌ No se encuentra ${RESOLVER_PATH}`);
    console.error('   Asegúrate de ejecutar esto en Contabo.');
    process.exit(1);
  }

  const content = fs.readFileSync(RESOLVER_PATH, 'utf-8');

  switch (mode) {
    case '--check': {
      if (hasDiagLogging(content)) {
        console.log('✅ Logging de diagnóstico está ACTIVO en postsResolver.js');
      } else {
        console.log('ℹ️  No hay logging de diagnóstico en postsResolver.js');
      }
      break;
    }

    case '--remove': {
      // Restaurar backup si existe
      if (fs.existsSync(BACKUP_PATH)) {
        fs.copyFileSync(BACKUP_PATH, RESOLVER_PATH);
        fs.unlinkSync(BACKUP_PATH);
        console.log('✅ Backup restaurado. Logging removido.');
      } else {
        const cleaned = remove(content);
        if (cleaned !== content) {
          fs.writeFileSync(RESOLVER_PATH, cleaned, 'utf-8');
          console.log('✅ Logging removido manualmente.');
        } else {
          console.log('ℹ️  No había logging que remover.');
        }
      }
      break;
    }

    case '--inject':
    default: {
      // Crear backup
      fs.copyFileSync(RESOLVER_PATH, BACKUP_PATH);
      console.log(`✅ Backup creado: ${BACKUP_PATH}`);

      const modified = inject(content);
      fs.writeFileSync(RESOLVER_PATH, modified, 'utf-8');
      console.log('✅ Logging de diagnóstico INYECTADO en postsResolver.js');
      console.log('   Para remover: node inject-post-logging.js --remove');
      console.log('   Para verificar: node inject-post-logging.js --check');
      console.log('');
      console.log('📋 Después de reiniciar PM2, busca en logs:');
      console.log('   pm2 logs api_antojados --lines 100 | grep "\\[DIAG"');
      break;
    }
  }
}

main();
