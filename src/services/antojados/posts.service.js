'use strict';
/**
 * posts.service.js — Servicio de soc_posts (Sociales / Usuarios)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      Feed de AntojadosMX — Posts Sociales (soc)
 * RESPONSABLE:  Orquestar llamadas a postsResolver con mapeo/validación
 *               de datos a través de postsMapper.
 *
 * NO HACE:
 *   - No consulta BD directamente (lo hace postsResolver)
 *   - No contiene lógica de negocio (solo orquestación)
 *
 * FUNCIONES DEL MODELO (feed.md):
 *   listPosts, createPost, getPost, deletePost,
 *   likePost, unlikePost, commentPost, viewPost,
 *   getPostInteractionsSummary
 *
 * FUNCIONES FUERA DEL MODELO:
 *   ratePost — usa soc_post_ratings (no documentado en feed.md)
 *
 * REFERENCIAS:
 *   - apps-antojados/docs/feed.md (Sección 3: soc_posts)
 *   - apps-antojados/docs/feed.md (Sección 5: SPs Soc)
 *   - postsResolver.js, postsMapper.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const postsResolver = require('./postsResolver');
const {
  mapPostList,
  mapCreatePostResult,
  mapPostDetail,
  mapDeletePostResult,
  mapRatePostResult,
} = require('./postsMapper');

async function listPosts(payload) {
  return mapPostList(await postsResolver.listPosts(payload));
}

async function createPost(payload) {
  return mapCreatePostResult(await postsResolver.createPost(payload));
}

async function getPost(postId, userId = null) {
  return mapPostDetail(await postsResolver.getPost(postId, userId));
}

async function deletePost(postId, userId, payload) {
  return mapDeletePostResult(await postsResolver.deletePost(postId, userId, payload));
}

async function ratePost(payload) {
  return mapRatePostResult(await postsResolver.ratePost(payload));
}

async function likePost({ post_id, user_id }) {
  return await postsResolver.likeSocPost({ post_id, user_id });
}

async function unlikePost({ post_id, user_id }) {
  return await postsResolver.unlikeSocPost({ post_id, user_id });
}

async function commentPost({ post_id, user_id, content_text, parent_comment_id, created_at_client }) {
  return await postsResolver.commentSocPost({ post_id, user_id, content_text, parent_comment_id, created_at_client });
}

async function viewPost({ post_id, user_id }) {
  return await postsResolver.viewSocPost({ post_id, user_id });
}

async function getPostInteractionsSummary({ post_id, user_id }) {
  return await postsResolver.getSocPostInteractionsSummary({ post_id, user_id });
}

module.exports = { listPosts, createPost, getPost, deletePost, ratePost, likePost, unlikePost, commentPost, viewPost, getPostInteractionsSummary };

