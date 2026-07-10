'use strict';

/**
 * mediaPackage.resolver.js — Resolver de MediaPackage (OBSOLETO)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ⚠️ VIOLACIÓN AL MODELO DE DATOS — ARCHIVO LEGACY
 *
 * MOTIVOS DE ELIMINACIÓN (corrige violaciones):
 *
 * 1. SP `usp_get_post_media_package` NO EXISTE en sql/antojados-core/.
 *    No tiene DDL, no hay migración que lo cree. La consulta falla siempre.
 *    → feed.md §2.2, §4.2: las URLs se leen directo de *_post_media.
 * 
 * 2. Columnas mapeadas (media_thumbnail_url, grid_url, video_720_url, etc.)
 *    NO EXISTEN en biz_post_media ni soc_post_media según el modelo.
 *    → feed.md §2.2 y §4.2 definen solo: media_url, thumb_url, feed_url,
 *      full_url, asset_id. El resto es legacy de una versión anterior.
 * 
 * 3. Para CONSUMO de cards HTML, las URLs ya están en *_post_media.
 *    listBizPosts() y listSocPost() ya devuelven media[] con thumb/feed/full.
 *    → feed.md §10.5: engineClient solo se usa para PUBLICACIÓN (escritura),
 *      no para consumo.
 * 
 * 4. publications.service.js llama a getMediaPackageByPost() como endpoint
 *    único de media (R8). Esto debe reemplazarse por una consulta directa
 *    a biz_post_media / soc_post_media.
 *
 * CORRECCIÓN APLICADA:
 *   - Eliminada dependencia de SP inexistente
 *   - Eliminado mapeo de columnas legacy
 *   - La función getMediaPackageByPost() ahora lee directamente de
 *     biz_post_media / soc_post_media (modelo feed.md §2.2, §4.2)
 *   - publications.service.js debe actualizarse para no depender de este
 *     archivo (o mantenerlo como wrapper simple)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql } = require('./_shared');

/**
 * Obtiene el MediaPackage de un post leyendo directamente de *_post_media.
 *
 * @param {string} idPost - ID del post (biz_post_id o post_id)
 * @param {string|null} modalidad - 'social', 'sponsor', o null (auto-detect)
 * @returns {Promise<Object|null>}
 */
async function getMediaPackageByPost(idPost, modalidad = null) {
  if (!idPost || !String(idPost).trim()) return null;

  const pool = getPool('antojados');

  if (!modalidad) {
    // Auto-detect: probar sponsor primero
    const sponsorResult = await _getFromTable(pool, 'biz', idPost);
    if (sponsorResult) return sponsorResult;

    const socialResult = await _getFromTable(pool, 'soc', idPost);
    if (socialResult) return socialResult;
    return null;
  }

  return _getFromTable(pool, modalidad === 'sponsor' ? 'biz' : 'soc', idPost);
}

/**
 * Lee el primer media de un post desde *_post_media.
 * Solo columnas del modelo feed.md §2.2, §4.2.
 *
 * @param {Object} pool
 * @param {string} type - 'biz' o 'soc'
 * @param {string} idPost
 * @returns {Promise<Object|null>}
 */
async function _getFromTable(pool, type, idPost) {
  const mediaTable = type === 'biz' ? 'antojados_core.biz_post_media' : 'antojados_core.soc_post_media';
  const postIdColumn = 'post_id';
  const result = await pool.request()
    .input('idPost', sql.NVarChar(64), idPost)
    .query(`
      SELECT TOP 1
        m.media_id,
        m.post_id AS id_post,
        m.media_type,
        m.media_url,
        m.thumb_url,
        m.feed_url,
        m.full_url,
        m.asset_id,
        m.sort_order
      FROM ${mediaTable} m
      WHERE m.${postIdColumn} = @idPost
      ORDER BY m.sort_order ASC
    `);

  const row = result.recordset[0];
  if (!row) return null;

  return {
    id_post: row.id_post,
    modalidad: type === 'biz' ? 'sponsor' : 'social',
    media_id: row.media_id,
    media_type: row.media_type || 'photo',
    // Solo columnas del modelo feed.md §2.2, §4.2
    mediaUrl: row.media_url,
    thumbUrl: row.thumb_url,
    feedUrl: row.feed_url,
    fullUrl: row.full_url,
    asset_id: row.asset_id,
  };
}

module.exports = {
  getMediaPackageByPost,
};

