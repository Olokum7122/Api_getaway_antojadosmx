'use strict';
/**
 * bizMapper.js — Mappers de biz_posts (Negocios)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      Feed de AntojadosMX — Posts de Negocios (biz)
 * RESPONSABLE:  Transformar/validar datos de biz_posts, biz_post_media,
 *               biz_post_interactions antes de exponerlos al service layer.
 *
 * NO HACE:
 *   - No consulta BD (lo hacen los resolvers)
 *   - No escribe en BD
 *   - No contiene lógica de negocio (solo transformación de datos)
 *
 * ⚠️ CONTAMINACIÓN (DEUDA DOCUMENTADA):
 *   mapBizTileList, mapSponsorSetupResult, mapSponsorRepresentativeResult,
 *   mapSponsorExpedienteDocument, mapSponsorExpedienteList
 *   manejan datos de SPONSOR MANAGEMENT (biz_tenants, tiles, expediente)
 *   que NO pertenecen al modelo feed.md.
 *   Ver docs/feed.auditoria.md (Deuda #2)
 *
 * MAPEADORES DEL MODELO (feed.md):
 *   mapBizPost         → valida biz_post_id de biz_posts (§1)
 *   mapBizPostList     → mapea array de biz_posts
 *   mapBizCommentList  → valida array de comentarios (§5)
 *   mapToggleResult    → pasa resultado de like/unlike/share (§5)
 *   mapContractResult  → pasa resultado contractual (sin uso en feed)
 *
 * MAPEADORES FUERA DEL MODELO (contaminación):
 *   mapSponsorSetupResult         → sponsorManager
 *   mapSponsorRepresentativeResult → sponsorManager
 *   mapSponsorExpedienteDocument   → sponsorManager
 *   mapSponsorExpedienteList       → sponsorManager
 *   mapBizTileList                  → sponsorManager
 *
 * REFERENCIAS:
 *   - apps-antojados/docs/feed.md (Sección 1, 2, 5)
 * ══════════════════════════════════════════════════════════════════════════════
 */

function assertArray(rows, name) {
  if (!Array.isArray(rows)) {
    throw new Error(`${name}: se esperaba array — ${typeof rows}`);
  }
  return rows;
}

function mapBizPost(raw) {
  if (!raw?.biz_post_id && !raw?.id) {
    throw new Error(`bizMapper.mapBizPost: biz_post_id faltante — ${JSON.stringify(raw)}`);
  }
  return raw;
}

function mapBizPostList(rows) {
  return assertArray(rows, 'bizMapper.mapBizPostList').map(mapBizPost);
}

function mapBizCommentList(rows) {
  return assertArray(rows, 'bizMapper.mapBizCommentList');
}

function mapBizTileList(rows) {
  return assertArray(rows, 'bizMapper.mapBizTileList');
}

function mapToggleResult(raw) {
  if (raw == null) return raw;
  return raw;
}

function mapContractResult(raw) {
  if (raw == null) return raw;
  return raw;
}

function mapSponsorSetupResult(raw) {
  if (!raw || !raw.instance_id || !raw.status) {
    throw new Error(`bizMapper.mapSponsorSetupResult: payload incompleto — ${JSON.stringify(raw)}`);
  }
  return raw;
}

function mapSponsorRepresentativeResult(raw) {
  if (!raw || !raw.instance_id || !raw.tenant_user_id || !raw.user_id) {
    throw new Error(`bizMapper.mapSponsorRepresentativeResult: payload incompleto — ${JSON.stringify(raw)}`);
  }
  return raw;
}

function mapSponsorExpedienteDocument(raw) {
  if (!raw || !raw.id || !raw.instance_id || !raw.doc_type) {
    throw new Error(`bizMapper.mapSponsorExpedienteDocument: payload incompleto — ${JSON.stringify(raw)}`);
  }
  return raw;
}

function mapSponsorExpedienteList(rows) {
  return assertArray(rows, 'bizMapper.mapSponsorExpedienteList').map(mapSponsorExpedienteDocument);
}

module.exports = {
  mapBizPost,
  mapBizPostList,
  mapBizCommentList,
  mapBizTileList,
  mapToggleResult,
  mapContractResult,
  mapSponsorSetupResult,
  mapSponsorRepresentativeResult,
  mapSponsorExpedienteDocument,
  mapSponsorExpedienteList,
};