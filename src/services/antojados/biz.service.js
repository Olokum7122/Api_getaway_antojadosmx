'use strict';
/**
 * biz.service.js — Servicio de biz_posts (Negocios / Sponsors)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      Feed de AntojadosMX — Posts de Negocios (biz)
 * RESPONSABLE:  Orquestar llamadas a bizResolver con mapeo/validación
 *               de datos a través de bizMapper.
 *
 * NO HACE:
 *   - No consulta BD directamente (lo hace bizResolver)
 *   - No contiene lógica de negocio (solo orquestación)
 *
 * ⚠️ CONTAMINACIÓN (DEUDA DOCUMENTADA):
 *   Exporta funciones de SPONSOR MANAGEMENT (tiles, setup, expediente)
 *   que NO pertenecen al modelo feed.md. Dependen de bizResolver
 *   que también está contaminado.
 *   Ver docs/feed.auditoria.md (Deuda #2)
 *
 * FUNCIONES DEL MODELO (feed.md):
 *   createBizPost, listBizPosts, getBizPost, getBizPostMedia,
 *   likeBizPost, unlikeBizPost, deleteBizPost, addBizComment,
 *   listBizComments, tapBizPost, shareBizPost, clickBizCta
 *
 * FUNCIONES FUERA DEL MODELO (contaminación):
 *   getTenantTilesForUser, createTile, deleteTile,
 *   setupSponsorBusiness, setupSponsorRepresentative,
 *   setupSponsorBilling, uploadSponsorExpedienteDocument,
 *   listSponsorExpediente
 *
 * REFERENCIAS:
 *   - antojadosmx/docs/feed.md (Sección 1, 2, 5)
 *   - bizResolver.js, bizMapper.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const bizResolver = require('./bizResolver');
const {
  mapBizPost,
  mapBizPostList,
  mapBizCommentList,
  mapBizTileList,
  mapToggleResult,
  mapSponsorSetupResult,
  mapSponsorRepresentativeResult,
  mapSponsorExpedienteDocument,
  mapSponsorExpedienteList,
  mapContractResult,
} = require('./bizMapper');

async function createBizPost(payload) { return bizResolver.createBizPost(payload); }
async function listBizPosts(payload) { return mapBizPostList(await bizResolver.listBizPosts(payload)); }
async function getBizPost(biz_post_id, user_id = null) { return mapBizPost(await bizResolver.getBizPost(biz_post_id, user_id)); }
async function getBizPostMedia(biz_post_id) { return bizResolver.getBizPostMedia(biz_post_id); }
async function likeBizPost(payload) { return mapToggleResult(await bizResolver.likeBizPost(payload)); }
async function unlikeBizPost(payload) { return mapToggleResult(await bizResolver.unlikeBizPost(payload)); }
async function deleteBizPost(biz_post_id) { return mapToggleResult(await bizResolver.deleteBizPost(biz_post_id)); }
async function addBizComment(payload) { return bizResolver.addBizComment(payload); }
async function listBizComments(biz_post_id, options) { return mapBizCommentList(await bizResolver.listBizComments(biz_post_id, options)); }
async function tapBizPost(payload) { return mapToggleResult(await bizResolver.tapBizPost(payload)); }
async function shareBizPost(payload) { return mapToggleResult(await bizResolver.shareBizPost(payload)); }
async function clickBizCta(payload) { return mapToggleResult(await bizResolver.clickBizCta(payload)); }
async function getTenantTilesForUser(userId, options) { return mapBizTileList(await bizResolver.getTenantTilesForUser(userId, options)); }
async function createTile(userId, payload) { return bizResolver.createTile(userId, payload); }
async function deleteTile(tileId, userId) { return mapToggleResult(await bizResolver.deleteTile(tileId, userId)); }
async function setupSponsorBusiness(instanceId, userId, payload) {
  return mapSponsorSetupResult(await bizResolver.setupSponsorBusiness(instanceId, userId, payload));
}
async function setupSponsorRepresentative(instanceId, userId, payload) {
  return mapSponsorRepresentativeResult(await bizResolver.setupSponsorRepresentative(instanceId, userId, payload));
}
async function setupSponsorBilling(instanceId, userId, payload) {
  return mapSponsorSetupResult(await bizResolver.setupSponsorBilling(instanceId, userId, payload));
}
async function uploadSponsorExpedienteDocument(instanceId, userId, payload) {
  return mapSponsorExpedienteDocument(await bizResolver.uploadSponsorExpedienteDocument(instanceId, userId, payload));
}
async function listSponsorExpediente(instanceId, userId) {
  return mapSponsorExpedienteList(await bizResolver.listSponsorExpediente(instanceId, userId));
}
async function getSponsorRegistrationForGt(instanceId) {
  return mapContractResult(await bizResolver.getSponsorRegistrationForGt(instanceId));
}
async function reviewSponsorRegistration(instanceId, payload) {
  return mapContractResult(await bizResolver.reviewSponsorRegistration(instanceId, payload));
}

module.exports = {
  createBizPost,
  listBizPosts,
  getBizPost,
  getBizPostMedia,
  likeBizPost,
  unlikeBizPost,
    deleteBizPost,
  addBizComment,
  listBizComments,
  tapBizPost,
  shareBizPost,
  clickBizCta,
  getTenantTilesForUser,
  createTile,
  deleteTile,
  setupSponsorBusiness,
  setupSponsorRepresentative,
  setupSponsorBilling,
  uploadSponsorExpedienteDocument,
  listSponsorExpediente,
  getSponsorRegistrationForGt,
  reviewSponsorRegistration,
};
