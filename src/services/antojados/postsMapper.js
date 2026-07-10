'use strict';
/**
 * postsMapper.js — Mappers de soc_posts (Sociales)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      Feed de AntojadosMX — Posts Sociales (soc)
 * RESPONSABLE:  Transformar/validar datos de soc_posts, soc_post_media,
 *               soc_post_interactions antes de exponerlos al service layer.
 *
 * NO HACE:
 *   - No consulta BD (lo hacen los resolvers)
 *   - No escribe en BD
 *   - No contiene lógica de negocio (solo validación de presencia)
 *
 * MAPEADORES DEL MODELO (feed.md):
 *   mapPostList         → valida array de soc_posts (§3)
 *   mapCreatePostResult → valida post_id presente (§5)
 *   mapPostDetail       → valida post_id presente en detalle (§3)
 *   mapDeletePostResult → valida post_id presente (§5)
 *   mapRatePostResult   → valida rating_id (fuera del modelo feed.md)
 *
 * REFERENCIAS:
 *   - apps-antojados/docs/feed.md (Sección 3: soc_posts)
 *   - apps-antojados/docs/feed.md (Sección 5: SPs)
 * ══════════════════════════════════════════════════════════════════════════════
 */

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name}: se esperaba array`);
  }
  return value;
}

function mapPostList(rows) { return assertArray(rows, 'postsMapper.mapPostList'); }

function mapCreatePostResult(raw) {
  if (raw == null) return null;
  if (!raw.post_id) throw new Error('postsMapper.mapCreatePostResult: post_id faltante');
  return raw;
}

function mapPostDetail(raw) {
  if (raw == null) return null;
  if (!raw.post_id) throw new Error('postsMapper.mapPostDetail: post_id faltante');
  return raw;
}

function mapDeletePostResult(raw) {
  if (raw == null) return null;
  if (!raw.post_id) throw new Error('postsMapper.mapDeletePostResult: post_id faltante');
  return raw;
}

function mapRatePostResult(raw) {
  if (raw == null) return null;
  if (!raw.rating_id) throw new Error('postsMapper.mapRatePostResult: rating_id faltante');
  return raw;
}

module.exports = {
  mapPostList,
  mapCreatePostResult,
  mapPostDetail,
  mapDeletePostResult,
  mapRatePostResult,
};