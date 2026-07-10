'use strict';

const { getPool, sql, randomUUID } = require('./_shared');

/**
 * Resolver para explorer_core.publications + publication_packages
 * Se conecta a la DB ATLX_EXPLORER_APP para CRUD de publicaciones y docJSON
 */

/**
 * Crea un content (publicación) en el modelo V2 (contents).
 * 
 * Body esperado:
 *   id_post, content_type, id_sponsor?, id_user?, feed_type,
 *   channel, package_type, template_code?, user_id?, payload_json?
 */
async function createPublication({
  id_post,
  content_type,
  id_sponsor = null,
  id_user = null,
  feed_type,
  channel,
  package_type,
  template_code = null,
  user_id = null,
  payload_json = null,
}) {
  const pool = getPool('explorerApp');

  const result = await pool.request()
    .input('id_post', sql.NVarChar(255), id_post)
    .input('content_type', sql.NVarChar(10), content_type)
    .input('id_sponsor', sql.NVarChar(50), id_sponsor)
    .input('id_user', sql.NVarChar(50), id_user)
    .input('feed_type', sql.NVarChar(20), feed_type)
    .input('channel', sql.NVarChar(20), channel)
    .input('package_type', sql.NVarChar(20), package_type)
    .input('template_code', sql.NVarChar(50), template_code)
    .input('user_id', sql.NVarChar(50), user_id)
    .input('payload_json', sql.NVarChar(sql.MAX), payload_json)
    .execute('explorer_core.usp_content_create');

  return result.recordset[0] || { id_post };
}

/**
 * Obtiene un content por id_post.
 */
async function getPublicationByPost(id_post) {
  const pool = getPool('explorerApp');

  const result = await pool.request()
    .input('id_post', sql.NVarChar(255), id_post)
    .execute('explorer_core.usp_content_get_by_post');

  return result.recordset[0] || null;
}

/**
 * Lista contents por sponsor.
 */
async function listPublicationsBySponsor(id_sponsor, { channel = null, feed_type = null, page = 1, page_size = 20 } = {}) {
  const pool = getPool('explorerApp');

  const result = await pool.request()
    .input('id_sponsor', sql.NVarChar(50), id_sponsor)
    .input('channel', sql.NVarChar(20), channel)
    .input('feed_type', sql.NVarChar(20), feed_type)
    .input('page', sql.Int, page)
    .input('page_size', sql.Int, page_size)
    .execute('explorer_core.usp_content_list_by_sponsor');

  return result.recordset;
}

/**
 * Lista contents por canal (feed público).
 */
async function listPublicationsByChannel(channel, { content_type = null, feed_type = null, page = 1, page_size = 20 } = {}) {
  const pool = getPool('explorerApp');

  const result = await pool.request()
    .input('channel', sql.NVarChar(20), channel)
    .input('content_type', sql.NVarChar(10), content_type)
    .input('feed_type', sql.NVarChar(20), feed_type)
    .input('page', sql.Int, page)
    .input('page_size', sql.Int, page_size)
    .execute('explorer_core.usp_content_list_by_channel');

  return result.recordset;
}

async function seedFromBizPosts() {
  const explorerPool = getPool('explorerApp');
  const antojadosPool = getPool('antojados');

  // Obtener todos los biz_posts activos
  const bizPosts = await antojadosPool.request()
    .query(`SELECT biz_post_id, user_id, channel, sponsored, created_at
            FROM antojados_core.biz_posts
            WHERE status = 'active'`);

  let seeded = 0;
  for (const bp of bizPosts.recordset) {
    const publicationId = 'pub-sp-' + bp.biz_post_id;

    // Verificar si ya existe
    const existing = await explorerPool.request()
      .input('publicationId', sql.NVarChar(50), publicationId)
      .query(`SELECT 1 FROM explorer_core.publications WHERE publication_id = @publicationId`);

    if (existing.recordset.length > 0) continue;

    await explorerPool.request()
      .input('publication_id', sql.NVarChar(50), publicationId)
      .input('sponsor_id', sql.NVarChar(50), bp.user_id)
      .input('external_post_id', sql.NVarChar(255), bp.biz_post_id)
      .input('channel', sql.NVarChar(20), bp.channel)
      .input('feed_type', sql.NVarChar(20), bp.sponsored ? 'PUBLICITY' : 'GENERAL')
      .input('mode', sql.NVarChar(10), 'sponsor')
      .input('published_at', sql.DateTime2(3), bp.created_at)
      .query(`
        INSERT INTO explorer_core.publications
          (publication_id, sponsor_id, external_post_id, channel, feed_type, mode, status, published_at)
        VALUES
          (@publication_id, @sponsor_id, @external_post_id, @channel, @feed_type, @mode, 'published', @published_at)
      `);
    seeded++;
  }

  return { seeded };
}

async function seedFromSocPosts() {
  const explorerPool = getPool('explorerApp');
  const antojadosPool = getPool('antojados');

  // Obtener todos los soc_posts activos
  const socPosts = await antojadosPool.request()
    .query(`SELECT post_id, user_id, feed_type, published_at
            FROM antojados_core.soc_posts
            WHERE post_status = 'active'`);

  let seeded = 0;
  for (const sp of socPosts.recordset) {
    const publicationId = 'pub-sc-' + sp.post_id;

    // Verificar si ya existe
    const existing = await explorerPool.request()
      .input('publicationId', sql.NVarChar(50), publicationId)
      .query(`SELECT 1 FROM explorer_core.publications WHERE publication_id = @publicationId`);

    if (existing.recordset.length > 0) continue;

    const channel = {
      pachanga: 'pachanga',
      desma: 'en_el_desma',
      neta: 'que_pex',
      momentos: 'que_pex',
    }[sp.feed_type] || sp.feed_type;

    await explorerPool.request()
      .input('publication_id', sql.NVarChar(50), publicationId)
      .input('user_id', sql.NVarChar(50), sp.user_id)
      .input('external_post_id', sql.NVarChar(255), sp.post_id)
      .input('channel', sql.NVarChar(20), channel)
      .input('feed_type', sql.NVarChar(20), 'USER')
      .input('mode', sql.NVarChar(10), 'social')
      .input('published_at', sql.DateTime2(3), sp.published_at)
      .query(`
        INSERT INTO explorer_core.publications
          (publication_id, user_id, external_post_id, channel, feed_type, mode, status, published_at)
        VALUES
          (@publication_id, @user_id, @external_post_id, @channel, @feed_type, @mode, 'published', @published_at)
      `);
    seeded++;
  }

  return { seeded };
}

module.exports = {
  createPublication,
  getPublicationByPost,
  listPublicationsBySponsor,
  listPublicationsByChannel,
  seedFromBizPosts,
  seedFromSocPosts,
};
