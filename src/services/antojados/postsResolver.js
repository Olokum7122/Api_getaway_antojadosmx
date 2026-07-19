'use strict';

/**
 * postsResolver.js — Resolver de soc_posts (Usuario / Social)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      Feed Social — Posts de usuario (soc_posts)
 * RESPONSABLE:  Publicación, consulta, interacciones (like, comment, view)
 *
 * NO HACE:
 *   - No escribe en antojados_feed (lo hace feedService)
 *   - No procesa media (lo hace Media Engine vía engineClient)
 *   - No maneja negocios/sponsors (biz_posts → bizResolver)
 *   - No maneja ratings, lugares, ubicaciones (soc_post_ratings, soc_places)
 *
 * FLUJO PRINCIPAL:
 *   publishSocPost()
 *     → engineClient.getReadyPayload()    ← resuelve URLs desde Media Engine
 *     → usp_publish_soc_post              ← INSERT en soc_posts (SP)
 *     → sp_soc_post_media_attach          ← INSERT en soc_post_media (SP)
 *
 *   Interacciones (like, unlike, comment, view)
 *     → usp_soc_post_like / _unlike / _comment / _view   ← SPs con UPDLOCK
 *
 * TABLAS QUE TOCA:
 *   antojados_core.soc_posts
 *     PK: post_id (NVARCHAR(64))
 *     Columnas: user_id, channel, feed_type, media_url, doc_json,
 *               views_count, likes_count, comments_count, shares_count,
 *               cta_clicks_count, engagement_score, status, created_at
 *
 *   antojados_core.soc_post_media
 *     PK: media_id (NVARCHAR(64))
 *     FK: post_id → soc_posts.post_id
 *     Columnas: user_id, media_type, media_url, sort_order, asset_id,
 *               thumb_url, feed_url, full_url, created_at
 *
 *   antojados_core.soc_post_interactions
 *     PK: interaction_id (NVARCHAR(64))
  *   FK: post_id → soc_posts.post_id
 *     Columnas: user_id, interaction_type, content_text, parent_comment_id,
 *               moderation_status, created_at_client, received_at_server
 *
 * MODELO DE DATOS: antojadosmx/docs/feed.md (Sección 3, 4, 5)
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql, _emitEvent } = require('./_shared');
const engineClient = require('./engineClient');

const SQL_REQUIRED_SET_OPTIONS = `
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
`;

function normalizeMediaGallery(mediaGallery, fallbackUrl, mediaType = 'photo') {
  const source = Array.isArray(mediaGallery) ? mediaGallery : [];
  const normalized = source
    .map((item, index) => {
      if (!item) return null;
      const candidate = typeof item === 'string' ? { media_url: item } : item;
      const mediaUrl = candidate.media_url || candidate.feed_url || candidate.full_url || candidate.url || null;
      if (!mediaUrl) return null;
      return {
        media_type: candidate.media_type || mediaType,
        media_url: mediaUrl,
        sort_order: Number.isInteger(candidate.sort_order) ? candidate.sort_order : index,
        asset_id: candidate.asset_id || candidate.intake_id || null,
        thumb_url: candidate.thumb_url || candidate.media_thumbnail_url || null,
        feed_url: candidate.feed_url || mediaUrl,
        full_url: candidate.full_url || mediaUrl,
      };
    })
    .filter(Boolean);
  if (normalized.length === 0 && fallbackUrl) {
    normalized.push({ media_type: mediaType, media_url: fallbackUrl, sort_order: 0, asset_id: null, thumb_url: null, feed_url: fallbackUrl, full_url: fallbackUrl });
  }
  return normalized;
}

async function validateBadgeId({ badge_id, grupo = 'soc' }) {
  if (!badge_id) throw Object.assign(new Error('badge_id requerido'), { status: 400 });
  const result = await getPool('antojados').request()
    .input('badge_id', sql.Int, badge_id)
    .input('grupo', sql.NVarChar(20), grupo)
    .query(`
      SELECT TOP 1 badge_id
      FROM antojados_core.badges
      WHERE badge_id = @badge_id AND grupo = @grupo
    `);

  const resolved = result.recordset?.[0]?.badge_id;
  if (!resolved) throw Object.assign(new Error(`badge_id invalido para ${grupo}: ${badge_id}`), { status: 400 });
  return resolved;
}

async function publishSocPost({ user_id, channel, feed_type = null, badge_id = null, city_code = null, zone_code = null, media_url = null, media_gallery = null, campos_json = null, asset_id = null }) {
  if (!user_id) throw Object.assign(new Error('user_id requerido'), { status: 400 });
  if (!channel) throw Object.assign(new Error('channel requerido'), { status: 400 });

  let resolvedMediaUrl = media_url;
  if (asset_id) {
    const payload = await engineClient.getReadyPayload(asset_id);
    if (!payload) throw Object.assign(new Error('asset_id no encontrado'), { status: 404 });
    resolvedMediaUrl = payload.feed_url || payload.full_url || payload.thumb_url || media_url;
    if (!resolvedMediaUrl) throw Object.assign(new Error('Media no ready'), { status: 409 });
  }
  const resolvedBadgeId = await validateBadgeId({ badge_id, grupo: 'soc' });

  const req = getPool('antojados').request()
    .input('user_id', sql.NVarChar(64), user_id)
    .input('channel', sql.NVarChar(30), channel)
    .input('feed_type', sql.NVarChar(30), feed_type)
    .input('badge_id', sql.Int, resolvedBadgeId)
    .input('media_url', sql.NVarChar(500), resolvedMediaUrl)
    .input('campos_json', sql.NVarChar(sql.MAX), campos_json ? JSON.stringify(campos_json) : null)
    .input('city_code', sql.NVarChar(20), city_code)
    .input('zone_code', sql.NVarChar(20), zone_code);

  const result = await req.query(`${SQL_REQUIRED_SET_OPTIONS}
DECLARE @out_post_id NVARCHAR(64);
EXEC antojados_core.usp_publish_soc_post
  @user_id = @user_id,
  @channel = @channel,
  @feed_type = @feed_type,
  @badge_id = @badge_id,
  @city_code = @city_code,
  @zone_code = @zone_code,
  @media_url = @media_url,
  @campos_json = @campos_json,
  @post_id = @out_post_id OUTPUT;
SELECT @out_post_id AS post_id;
`);
  const postId = result.recordset?.[0]?.post_id;

  const mediaItems = normalizeMediaGallery(media_gallery, resolvedMediaUrl);
  for (const item of mediaItems) {
    await attachSocPostMedia({ post_id: postId, user_id, ...item });
  }

  _emitEvent({ user_id, post_id: postId, event_type: 'soc_post_created', payload: { channel, feed_type } });
  return { post_id: postId };
}

async function attachSocPostMedia({ post_id, user_id, media_type = 'photo', media_url, sort_order = 0, asset_id = null, thumb_url = null, feed_url = null, full_url = null }) {
  if (!post_id) throw Object.assign(new Error('post_id requerido'), { status: 400 });
  if (!user_id) throw Object.assign(new Error('user_id requerido'), { status: 400 });
  if (!media_url) throw Object.assign(new Error('media_url requerido'), { status: 400 });

  await getPool('antojados').request()
    .input('post_id', sql.NVarChar(64), post_id)
    .input('user_id', sql.NVarChar(64), user_id)
    .input('media_type', sql.NVarChar(20), media_type)
    .input('media_url', sql.NVarChar(1000), media_url)
    .input('sort_order', sql.Int, sort_order)
    .input('asset_id', sql.NVarChar(64), asset_id)
    .input('thumb_url', sql.NVarChar(1000), thumb_url)
    .input('feed_url', sql.NVarChar(1000), feed_url)
    .input('full_url', sql.NVarChar(1000), full_url)
    .query(`${SQL_REQUIRED_SET_OPTIONS}
EXEC antojados_core.sp_soc_post_media_attach
  @post_id = @post_id,
  @user_id = @user_id,
  @media_type = @media_type,
  @media_url = @media_url,
  @sort_order = @sort_order,
  @asset_id = @asset_id,
  @thumb_url = @thumb_url,
  @feed_url = @feed_url,
  @full_url = @full_url;
`);
}

async function uploadSocPostMedia({ post_id, user_id, file_buffer, file_name, mime_type, media_type = 'photo', sort_order = 0, rights = {} }) {
  const { mediaId } = await engineClient.createMediaRequest({
    sourceApp: 'antojados', sourceActorType: 'user', sourceActorId: user_id,
    targetContext: 'soc_post', mediaType: media_type,
    externalContextId: post_id,
    clientReferenceId: `soc_post-${post_id}-${Date.now()}`,
  });

  // Registrar derechos/origen antes de subir el archivo
  await engineClient.registerRightsOrigin(mediaId, rights);

  const uploadResult = await engineClient.uploadOriginal(mediaId, file_buffer, file_name, mime_type);

  await attachSocPostMedia({ post_id, user_id, media_type, media_url: uploadResult.originalUrl, sort_order, asset_id: mediaId });

  return { media_id: mediaId, url: uploadResult.originalUrl };
}

async function listSocPosts({ user_id, channel, feed_type, limit = 20, offset = 0, media_url_invalid } = {}) {
  const isAudit = media_url_invalid === true || media_url_invalid === 'true';

  const result = await getPool('antojados').request()
    .input('userId', sql.NVarChar(64), isAudit ? null : (user_id || null))
    .input('channel', sql.NVarChar(30), isAudit ? null : (channel || null))
    .input('feedType', sql.NVarChar(30), feed_type || null)
    .input('limit', sql.Int, isAudit ? 200 : limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT p.post_id, p.user_id, p.channel, p.feed_type,
             p.media_url,
             p.badge_id, b.badge, b.color_gradient AS badge_color,
             b.doc_json_campos AS badge_campos,
             pc.campos_json,
             p.views_count, p.likes_count, p.comments_count, p.shares_count,
             p.cta_clicks_count, p.engagement_score,
             p.status, p.created_at,
             (SELECT m.media_id, m.media_type, m.media_url, m.sort_order,
                     m.thumb_url, m.feed_url, m.full_url, m.asset_id
              FROM antojados_core.soc_post_media m
              WHERE m.post_id = p.post_id ORDER BY m.sort_order
              FOR JSON PATH) AS media_json,
             ai.display_name, ai.avatar_url
      FROM antojados_core.soc_posts p
      LEFT JOIN antojados_core.badges b ON b.badge_id = p.badge_id
      LEFT JOIN antojados_core.post_campos pc ON pc.post_id = p.post_id
      LEFT JOIN antojados_core.auth_identities ai ON ai.user_id = p.user_id
      WHERE p.status ${isAudit ? "IN ('active', 'archived')" : "= 'active'"}
        ${isAudit ? "AND (p.media_url IS NULL OR p.media_url = '' OR (p.media_url NOT LIKE 'http://%' AND p.media_url NOT LIKE 'https://%'))" : ''}
        AND (@userId IS NULL OR p.user_id = @userId)
        AND (@channel IS NULL OR p.channel = @channel)
        AND (@feedType IS NULL OR p.feed_type = @feedType)
      ORDER BY p.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

  return result.recordset.map(r => ({ ...r, media: r.media_json ? JSON.parse(r.media_json) : [] }));
}

async function getSocPost(post_id) {
  const result = await getPool('antojados').request()
    .input('postId', sql.NVarChar(64), post_id)
    .query(`
      SELECT p.post_id, p.user_id, p.channel, p.feed_type,
             p.media_url,
             p.badge_id, b.badge, b.color_gradient AS badge_color,
             b.doc_json_campos AS badge_campos,
             pc.campos_json,
             p.views_count, p.likes_count, p.comments_count, p.shares_count,
             p.cta_clicks_count, p.engagement_score,
             p.status, p.created_at,
             (SELECT m.media_id, m.media_type, m.media_url, m.sort_order,
                     m.thumb_url, m.feed_url, m.full_url, m.asset_id
              FROM antojados_core.soc_post_media m
              WHERE m.post_id = p.post_id ORDER BY m.sort_order
              FOR JSON PATH) AS media_json,
             ai.display_name, ai.avatar_url
      FROM antojados_core.soc_posts p
      LEFT JOIN antojados_core.badges b ON b.badge_id = p.badge_id
      LEFT JOIN antojados_core.post_campos pc ON pc.post_id = p.post_id
      LEFT JOIN antojados_core.auth_identities ai ON ai.user_id = p.user_id
      WHERE p.post_id = @postId AND p.status = 'active'
    `);

  const row = result.recordset[0];
  if (!row) return null;
  return { ...row, media: row.media_json ? JSON.parse(row.media_json) : [] };
}

async function likeSocPost({ post_id, user_id }) {
  await getPool('antojados').request()
    .input('post_id', sql.NVarChar(64), post_id)
    .input('user_id', sql.NVarChar(64), user_id)
    .execute('antojados_core.usp_soc_post_like');
  _emitEvent({ post_id, user_id, event_type: 'soc_post_liked' });
  return { ok: true };
}

async function unlikeSocPost({ post_id, user_id }) {
  await getPool('antojados').request()
    .input('post_id', sql.NVarChar(64), post_id)
    .input('user_id', sql.NVarChar(64), user_id)
    .execute('antojados_core.usp_soc_post_unlike');
  _emitEvent({ post_id, user_id, event_type: 'soc_post_unliked' });
  return { ok: true };
}

async function commentSocPost({ post_id, user_id, content_text, parent_comment_id = null, created_at_client = null }) {
  await getPool('antojados').request()
    .input('post_id', sql.NVarChar(64), post_id)
    .input('user_id', sql.NVarChar(64), user_id)
    .input('interaction_type', sql.NVarChar(30), parent_comment_id ? 'reply_created' : 'comment_created')
    .input('parent_comment_id', sql.NVarChar(64), parent_comment_id)
    .input('content_text', sql.NVarChar(2000), content_text)
    .input('created_at_client', sql.DateTime2(3), created_at_client ? new Date(created_at_client) : null)
    .execute('antojados_core.usp_soc_post_comment');
  _emitEvent({ post_id, user_id, event_type: 'soc_post_commented' });
  return { ok: true };
}

async function viewSocPost({ post_id, user_id }) {
  await getPool('antojados').request()
    .input('post_id', sql.NVarChar(64), post_id)
    .input('user_id', sql.NVarChar(64), user_id)
    .execute('antojados_core.usp_soc_post_view');
  return { ok: true };
}

async function getSocPostInteractionsSummary({ post_id, user_id }) {
  const result = await getPool('antojados').request()
    .input('post_id', sql.NVarChar(64), post_id)
    .input('user_id', sql.NVarChar(64), user_id)
    .execute('antojados_core.usp_soc_post_interactions_summary');
  return result.recordset[0] || { has_liked: false, likes_count: 0, comments_count: 0 };
}

async function deleteSocPost(post_id) {
  const tr = new sql.Transaction(getPool('antojados'));
  try {
    await tr.begin();
    await new sql.Request(tr).input('postId', sql.NVarChar(64), post_id)
      .query('DELETE FROM antojados_core.soc_post_media WHERE post_id = @postId');
    await new sql.Request(tr).input('postId', sql.NVarChar(64), post_id)
      .query('DELETE FROM antojados_core.soc_post_interactions WHERE post_id = @postId');
    await new sql.Request(tr).input('postId', sql.NVarChar(64), post_id)
      .query("UPDATE antojados_core.soc_posts SET status = 'deleted' WHERE post_id = @postId");
    await tr.commit();
  } catch (e) {
    try { await tr.rollback(); } catch (_) {}
    throw e;
  }
  return { ok: true };
}

// legacy aliases
const createPost = publishSocPost;
const listPosts = listSocPosts;
const getPost = getSocPost;

module.exports = {
  publishSocPost,
  createPost,
  attachSocPostMedia,
  uploadSocPostMedia,
  listSocPosts,
  listPosts,
  getSocPost,
  getPost,
  likeSocPost,
  unlikeSocPost,
  commentSocPost,
  viewSocPost,
  getSocPostInteractionsSummary,
  deleteSocPost,
};
