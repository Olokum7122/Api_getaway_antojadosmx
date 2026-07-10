'use strict';

const publicationsResolver = require('./publicationsResolver');
const mediaPackageResolver = require('./mediaPackage.resolver');

async function createPublication(payload) {
  return publicationsResolver.createPublication(payload);
}

async function getPublicationByPost(external_post_id, channel) {
  return publicationsResolver.getPublicationByPost(external_post_id, channel);
}

async function listPublicationsBySponsor(sponsor_id, options) {
  return publicationsResolver.listPublicationsBySponsor(sponsor_id, options);
}

async function listPublicationsByChannel(channel, options) {
  return publicationsResolver.listPublicationsByChannel(channel, options);
}

async function seedFromBizPosts() {
  return publicationsResolver.seedFromBizPosts();
}

async function seedFromSocPosts() {
  return publicationsResolver.seedFromSocPosts();
}

/**
 * Obtiene el MediaPackage (todas las variantes de media + métricas)
 * de un post por su id_post.
 *
 * Regla R8: Las URLs de media se resuelven desde Antojados App.
 * Este es el ENDPOINT ÚNICO para ello.
 *
 * @param {string} idPost - ID del post (UUID)
 * @param {string|null} modalidad - 'social', 'sponsor', o null (auto-detect)
 * @returns {Promise<Object|null>} MediaPackageUrls o null
 */
async function getPostMediaPackage(idPost, modalidad = null) {
  return mediaPackageResolver.getMediaPackageByPost(idPost, modalidad);
}

module.exports = {
  createPublication,
  getPublicationByPost,
  listPublicationsBySponsor,
  listPublicationsByChannel,
  seedFromBizPosts,
  seedFromSocPosts,
  getPostMediaPackage,
};
