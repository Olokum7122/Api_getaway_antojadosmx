'use strict';
/**
 * social.service.js — Servicio de Interacciones Sociales
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Interacciones Sociales (likes, comments,
 *               follows, saves, shares)
 * RESPONSABLE:  Orquestar llamadas a socialResolver con mapeo/validación
 *               de datos a través de socialMapper.
 *
 * NO HACE:
 *   - No consulta BD directamente (lo hace socialResolver)
 *   - No contiene lógica de negocio (solo orquestación)
 *
 * FUNCIONES:
 *   likePost, unlikePost, addComment, listComments, sharePost,
 *   followToggle, saveToggle, listFollowing, listFollowers,
 *   listSaves, getSavesFeed
 *
 * REFERENCIAS:
 *   - apps-antojados/docs/feed.md (Sección 5: Interacciones)
 *   - socialResolver.js, socialMapper.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const resolver = require('./socialResolver');
const {
  mapCommentList,
  mapFollowingList,
  mapFollowerList,
  mapSaveList,
  mapFeedList,
  mapToggleResult,
} = require('./socialMapper');

async function likePost(post_id, user_id, options = {}) {
  return resolver.likePost(post_id, user_id, options);
}

async function unlikePost(post_id, user_id) {
  return resolver.unlikePost(post_id, user_id);
}

async function addComment(payload) {
  return resolver.addComment(payload);
}

async function listComments(post_id, options) {
  const rows = await resolver.listComments(post_id, options);
  return mapCommentList(rows);
}

async function sharePost(post_id, user_id, options = {}) {
  return resolver.sharePost(post_id, user_id, options);
}

async function followToggle(payload) {
  const result = await resolver.followToggle(payload);
  return mapToggleResult(result);
}

async function saveToggle(payload) {
  const result = await resolver.saveToggle(payload);
  return mapToggleResult(result);
}

async function listFollowing(options) {
  const rows = await resolver.listFollowing(options);
  return mapFollowingList(rows);
}

async function listFollowers(options) {
  const rows = await resolver.listFollowers(options);
  return mapFollowerList(rows);
}

async function listSaves(options) {
  const rows = await resolver.listSaves(options);
  return mapSaveList(rows);
}

async function getSavesFeed(options) {
  const rows = await resolver.getSavesFeed(options);
  return mapFeedList(rows);
}

module.exports = {
  likePost,
  unlikePost,
  addComment,
  listComments,
  sharePost,
  followToggle,
  saveToggle,
  listFollowing,
  listFollowers,
  listSaves,
  getSavesFeed,
};
