'use strict';
/**
 * socialMapper.js — Mappers de Interacciones Sociales
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Interacciones Sociales (likes, comments,
 *               follows, saves, shares)
 * RESPONSABLE:  Transformar/validar datos de interacciones sociales
 *               antes de exponerlos al service layer.
 *
 * NO HACE:
 *   - No consulta BD (lo hacen los resolvers)
 *   - No contiene lógica de negocio (solo validación de presencia)
 *
 * MAPEADORES:
 *   mapComment        → valida interaction_id en comentarios
 *   mapCommentList    → array de comentarios
 *   mapFollowingItem  → valida follow_id
 *   mapFollowingList  → array de follows
 *   mapFollowerItem   → valida follow_id
 *   mapFollowerList   → array de followers
 *   mapSaveItem       → valida save_id
 *   mapSaveList       → array de saves
 *   mapFeedList       → array de feed items
 *   mapToggleResult   → valida acción toggle presente
 *
 * REFERENCIAS:
 *   - antojadosmx/docs/feed.md
 *   - socialResolver.js, social.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

function assertArray(rows, name) {
  if (!Array.isArray(rows)) {
    throw new Error(`${name}: se esperaba array — ${typeof rows}`);
  }
  return rows;
}

function mapComment(raw) {
  if (!raw?.interaction_id) {
    throw new Error(`socialMapper.mapComment: interaction_id faltante — ${JSON.stringify(raw)}`);
  }
  return raw;
}

function mapCommentList(rows) {
  return assertArray(rows, 'socialMapper.mapCommentList').map(mapComment);
}

function mapFollowingItem(raw) {
  if (!raw?.follow_id) {
    throw new Error(`socialMapper.mapFollowingItem: follow_id faltante — ${JSON.stringify(raw)}`);
  }
  return raw;
}

function mapFollowingList(rows) {
  return assertArray(rows, 'socialMapper.mapFollowingList').map(mapFollowingItem);
}

function mapFollowerItem(raw) {
  if (!raw?.follow_id) {
    throw new Error(`socialMapper.mapFollowerItem: follow_id faltante — ${JSON.stringify(raw)}`);
  }
  return raw;
}

function mapFollowerList(rows) {
  return assertArray(rows, 'socialMapper.mapFollowerList').map(mapFollowerItem);
}

function mapSaveItem(raw) {
  if (!raw?.save_id) {
    throw new Error(`socialMapper.mapSaveItem: save_id faltante — ${JSON.stringify(raw)}`);
  }
  return raw;
}

function mapSaveList(rows) {
  return assertArray(rows, 'socialMapper.mapSaveList').map(mapSaveItem);
}

function mapFeedList(rows) {
  return assertArray(rows, 'socialMapper.mapFeedList');
}

function mapToggleResult(raw) {
  if (!raw || typeof raw.action !== 'string') {
    throw new Error(`socialMapper.mapToggleResult: action faltante — ${JSON.stringify(raw)}`);
  }
  return raw;
}

module.exports = {
  mapComment,
  mapCommentList,
  mapFollowingItem,
  mapFollowingList,
  mapFollowerItem,
  mapFollowerList,
  mapSaveItem,
  mapSaveList,
  mapFeedList,
  mapToggleResult,
};