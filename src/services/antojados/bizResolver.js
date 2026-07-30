'use strict';

/**
 * bizResolver.js — Resolver de biz_posts (Sponsor / Negocio)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      Feed de Negocios — Posts de tipo sponsor (biz_posts)
 * RESPONSABLE:  Publicación, consulta, interacciones (like, comment, view, tap)
 *
 * NO HACE:
 *   - No escribe en antojados_feed (lo hace feedService)
 *   - No procesa media (lo hace Media Engine vía engineClient)
 *   - No maneja usuarios sociales (soc_posts → postsResolver)
 *
 * ⚠️ CONTAMINACIÓN (DEUDA DOCUMENTADA):
 *   Este archivo incluye funciones de SPONSOR MANAGEMENT
 *   (tiles, setup de negocio, representante, facturación,
 *   expediente) que NO pertenecen al modelo de datos feed.md.
 *   Estas funciones deberían vivir en sponsorManager.js.
 *   Se mantienen aquí por compatibilidad.
 *   Ver docs/feed.auditoria.md (Deuda #2)
 *
 * FLUJO PRINCIPAL:
 *   publishBizPost()
 *     → engineClient.getReadyPayload()    ← resuelve URLs desde Media Engine
 *     → usp_publish_biz_post              ← INSERT en biz_posts (SP)
 *     → sp_biz_post_media_attach          ← INSERT en biz_post_media (SP)
 *
 *   Interacciones (like, unlike, comment, view)
 *     → usp_biz_post_like / _unlike / _comment / _view   ← SPs con UPDLOCK
 *
 * TABLAS QUE TOCA:
 *   antojados_core.biz_posts
 *     PK: biz_post_id (NVARCHAR(64))
 *     Columnas: sponsor_id, channel, feed_type, media_url, doc_json,
 *               views_count, likes_count, comments_count, shares_count,
 *               cta_clicks_count, taps_whatsapp_count, taps_maps_count,
 *               engagement_score, status, created_at
 *
 *   antojados_core.biz_post_media
 *     PK: media_id (NVARCHAR(64))
 *     FK: post_id → biz_posts.biz_post_id
 *     Columnas: sponsor_id, media_type, media_url, sort_order, asset_id,
 *               thumb_url, feed_url, full_url, created_at
 *
 *   antojados_core.biz_post_interactions
 *     PK: interaction_id (NVARCHAR(64))
 *     FK: biz_post_id → biz_posts.biz_post_id
 *     Columnas: user_id, interaction_type, content_text, parent_comment_id,
 *               moderation_status, created_at_client, received_at_server
 *
 * MODELO DE DATOS: antojadosmx/docs/feed.md (Sección 1, 2, 5)
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql, fs, pathMod, _emitEvent } = require('./_shared');
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

async function validateBadgeId({ badge_id, grupo = 'biz', channel = null }) {
  if (!badge_id) throw Object.assign(new Error('badge_id requerido'), { status: 400 });
  const result = await getPool('antojados').request()
    .input('badge_id', sql.Int, badge_id)
    .input('grupo', sql.NVarChar(20), grupo)
    .query(`
      SELECT TOP 1 badge_id, badge
      FROM antojados_core.badges
      WHERE badge_id = @badge_id AND grupo = @grupo
    `);

  const record = result.recordset?.[0];
  if (!record?.badge_id) throw Object.assign(new Error(`badge_id invalido para ${grupo}: ${badge_id}`), { status: 400 });
  if (channel === 'arre' && String(record.badge || '').toUpperCase() !== 'EVENTO') {
    throw Object.assign(new Error('arre solo acepta badge EVENTO'), { status: 400 });
  }
  return record.badge_id;
}

async function publishBizPost({ sponsor_id, channel, feed_type = null, badge_id = null, city_code = null, zone_code = null, media_url = null, media_gallery = null, campos_json = null, asset_id = null }) {
  if (!sponsor_id) throw Object.assign(new Error('sponsor_id requerido'), { status: 400 });
  if (!channel) throw Object.assign(new Error('channel requerido'), { status: 400 });
  if (!feed_type) throw Object.assign(new Error('feed_type requerido'), { status: 400 });

  let resolvedMediaUrl = media_url;
  if (asset_id) {
    const payload = await engineClient.getReadyPayload(asset_id);
    if (!payload) throw Object.assign(new Error('asset_id no encontrado'), { status: 404 });
    resolvedMediaUrl = payload.feed_url || payload.full_url || payload.thumb_url || media_url;
    if (!resolvedMediaUrl) throw Object.assign(new Error('Media no ready'), { status: 409 });
  }
  const resolvedBadgeId = await validateBadgeId({ badge_id, grupo: 'biz', channel });

  const req = getPool('antojados').request()
    .input('sponsor_id', sql.NVarChar(64), sponsor_id)
    .input('channel', sql.NVarChar(30), channel)
    .input('feed_type', sql.NVarChar(30), feed_type)
    .input('badge_id', sql.Int, resolvedBadgeId)
    .input('media_url', sql.NVarChar(500), resolvedMediaUrl)
    .input('campos_json', sql.NVarChar(sql.MAX), campos_json ? JSON.stringify(campos_json) : null)
    .input('city_code', sql.NVarChar(20), city_code)
    .input('zone_code', sql.NVarChar(20), zone_code);

  const result = await req.query(`${SQL_REQUIRED_SET_OPTIONS}
DECLARE @out_biz_post_id NVARCHAR(64);
EXEC antojados_core.usp_publish_biz_post
  @sponsor_id = @sponsor_id,
  @channel = @channel,
  @feed_type = @feed_type,
  @badge_id = @badge_id,
  @city_code = @city_code,
  @zone_code = @zone_code,
  @media_url = @media_url,
  @campos_json = @campos_json,
  @biz_post_id = @out_biz_post_id OUTPUT;
SELECT @out_biz_post_id AS biz_post_id;
`);
  const bizPostId = result.recordset?.[0]?.biz_post_id;

  const mediaItems = normalizeMediaGallery(media_gallery, resolvedMediaUrl);
  for (const item of mediaItems) {
    await attachBizPostMedia({ post_id: bizPostId, sponsor_id, ...item });
  }

  _emitEvent({ sponsor_id, biz_post_id: bizPostId, event_type: 'biz_post_created', payload: { channel, feed_type } });
  return { biz_post_id: bizPostId };
}

async function attachBizPostMedia({ post_id, sponsor_id, media_type = 'photo', media_url, sort_order = 0, asset_id = null, thumb_url = null, feed_url = null, full_url = null }) {
  if (!post_id) throw Object.assign(new Error('post_id requerido'), { status: 400 });
  if (!sponsor_id) throw Object.assign(new Error('sponsor_id requerido'), { status: 400 });
  if (!media_url) throw Object.assign(new Error('media_url requerido'), { status: 400 });

  await getPool('antojados').request()
    .input('post_id', sql.NVarChar(64), post_id)
    .input('sponsor_id', sql.NVarChar(64), sponsor_id)
    .input('media_type', sql.NVarChar(20), media_type)
    .input('media_url', sql.NVarChar(1000), media_url)
    .input('sort_order', sql.Int, sort_order)
    .input('asset_id', sql.NVarChar(64), asset_id)
    .input('thumb_url', sql.NVarChar(1000), thumb_url)
    .input('feed_url', sql.NVarChar(1000), feed_url)
    .input('full_url', sql.NVarChar(1000), full_url)
    .query(`${SQL_REQUIRED_SET_OPTIONS}
EXEC antojados_core.sp_biz_post_media_attach
  @post_id = @post_id,
  @sponsor_id = @sponsor_id,
  @media_type = @media_type,
  @media_url = @media_url,
  @sort_order = @sort_order,
  @asset_id = @asset_id,
  @thumb_url = @thumb_url,
  @feed_url = @feed_url,
  @full_url = @full_url;
`);
}

async function uploadBizPostMedia({ post_id, sponsor_id, file_buffer, file_name, mime_type, media_type = 'photo', sort_order = 0, rights = {} }) {
  const { mediaId } = await engineClient.createMediaRequest({
    sourceApp: 'antojados', sourceActorType: 'sponsor', sourceActorId: sponsor_id,
    targetContext: 'biz_post', mediaType: media_type,
    externalContextId: post_id,
    clientReferenceId: `biz_post-${post_id}-${Date.now()}`,
  });

  // Registrar derechos/origen antes de subir el archivo
  await engineClient.registerRightsOrigin(mediaId, rights);

  const uploadResult = await engineClient.uploadOriginal(mediaId, file_buffer, file_name, mime_type);
  await attachBizPostMedia({ post_id, sponsor_id, media_type, media_url: uploadResult.originalUrl, sort_order, asset_id: mediaId });
  return { media_id: mediaId, url: uploadResult.originalUrl };
}

async function listBizPosts({ sponsor_id, channel, feed_type, city_code, zone_code, limit = 20, offset = 0, media_url_invalid } = {}) {
  const isAudit = media_url_invalid === true || media_url_invalid === 'true';

  const result = await getPool('antojados').request()
    .input('sponsorId', sql.NVarChar(64), isAudit ? null : (sponsor_id || null))
    .input('channel', sql.NVarChar(30), isAudit ? null : (channel || null))
    .input('feedType', sql.NVarChar(30), feed_type || null)
    .input('cityCode', sql.NVarChar(20), isAudit ? null : (city_code || null))
    .input('zoneCode', sql.NVarChar(20), isAudit ? null : (zone_code || null))
    .input('limit', sql.Int, isAudit ? 200 : limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT bp.biz_post_id, bp.sponsor_id, bp.channel, bp.feed_type,
             bp.media_url,
             bp.city_code, bp.zone_code,
             bp.badge_id, b.badge, b.color_gradient AS badge_color,
             b.doc_json_campos AS badge_campos,
             pc.campos_json,
             bp.views_count, bp.likes_count, bp.comments_count, bp.shares_count,
             bp.cta_clicks_count, bp.taps_whatsapp_count, bp.taps_maps_count,
             bp.engagement_score, bp.status, bp.created_at,
             (SELECT m.media_id, m.media_type, m.media_url, m.sort_order,
                     m.thumb_url, m.feed_url, m.full_url, m.asset_id
              FROM antojados_core.biz_post_media m
              WHERE m.post_id = bp.biz_post_id ORDER BY m.sort_order
              FOR JSON PATH) AS media_json
      FROM antojados_core.biz_posts bp
      LEFT JOIN antojados_core.badges b ON b.badge_id = bp.badge_id
      LEFT JOIN antojados_core.post_campos pc ON pc.post_id = bp.biz_post_id
      WHERE bp.status ${isAudit ? "IN ('active', 'archived')" : "= 'active'"}
        ${isAudit ? "AND (bp.media_url IS NULL OR bp.media_url = '' OR (bp.media_url NOT LIKE 'http://%' AND bp.media_url NOT LIKE 'https://%'))" : ''}
        AND (@sponsorId IS NULL OR bp.sponsor_id = @sponsorId)
        AND (@channel IS NULL OR bp.channel = @channel)
        AND (@feedType IS NULL OR bp.feed_type = @feedType)
        AND (@cityCode IS NULL OR bp.city_code = @cityCode)
        AND (@zoneCode IS NULL OR bp.zone_code = @zoneCode)
      ORDER BY bp.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  return result.recordset.map(r => ({ ...r, media: r.media_json ? JSON.parse(r.media_json) : [] }));
}

async function getBizPost(biz_post_id) {
  const result = await getPool('antojados').request()
    .input('bizPostId', sql.NVarChar(64), biz_post_id)
    .query(`
      SELECT bp.biz_post_id, bp.sponsor_id, bp.channel, bp.feed_type,
             bp.media_url,
             bp.badge_id, b.badge, b.color_gradient AS badge_color,
             b.doc_json_campos AS badge_campos,
             pc.campos_json,
             bp.views_count, bp.likes_count, bp.comments_count, bp.shares_count,
             bp.cta_clicks_count, bp.taps_whatsapp_count, bp.taps_maps_count,
             bp.engagement_score, bp.status, bp.created_at,
             (SELECT m.media_id, m.media_type, m.media_url, m.sort_order,
                     m.thumb_url, m.feed_url, m.full_url, m.asset_id
              FROM antojados_core.biz_post_media m
              WHERE m.post_id = bp.biz_post_id ORDER BY m.sort_order
              FOR JSON PATH) AS media_json
      FROM antojados_core.biz_posts bp
      LEFT JOIN antojados_core.badges b ON b.badge_id = bp.badge_id
      LEFT JOIN antojados_core.post_campos pc ON pc.post_id = bp.biz_post_id
      WHERE bp.biz_post_id = @bizPostId AND bp.status = 'active'
    `);
  const row = result.recordset[0];
  if (!row) return null;
  return { ...row, media: row.media_json ? JSON.parse(row.media_json) : [] };
}

async function assertAuthIdentity(user_id) {
  const normalized_user_id = String(user_id || '').trim();
  if (!normalized_user_id) {
    const err = new Error('user_id es requerido');
    err.status = 400;
    throw err;
  }

  const result = await getPool('antojados').request()
    .input('user_id', sql.NVarChar(64), normalized_user_id)
    .query('SELECT TOP 1 user_id FROM antojados_core.auth_identities WHERE user_id = @user_id');

  if (!result.recordset[0]) {
    const err = new Error('user_id no existe en auth_identities');
    err.status = 400;
    throw err;
  }

  return normalized_user_id;
}

async function likeBizPost({ biz_post_id, user_id }) {
  const resolved_user_id = await assertAuthIdentity(user_id);
  await getPool('antojados').request()
    .input('biz_post_id', sql.NVarChar(64), biz_post_id)
    .input('user_id', sql.NVarChar(64), resolved_user_id)
    .execute('antojados_core.usp_biz_post_like');
  _emitEvent({ biz_post_id, user_id: resolved_user_id, event_type: 'biz_post_liked' });
  return { ok: true };
}

async function unlikeBizPost({ biz_post_id, user_id }) {
  const resolved_user_id = await assertAuthIdentity(user_id);
  await getPool('antojados').request()
    .input('biz_post_id', sql.NVarChar(64), biz_post_id)
    .input('user_id', sql.NVarChar(64), resolved_user_id)
    .execute('antojados_core.usp_biz_post_unlike');
  _emitEvent({ biz_post_id, user_id: resolved_user_id, event_type: 'biz_post_unliked' });
  return { ok: true };
}

async function commentBizPost({ biz_post_id, user_id, content_text, parent_comment_id = null, created_at_client = null }) {
  const resolved_user_id = await assertAuthIdentity(user_id);
  const result = await getPool('antojados').request()
    .input('biz_post_id', sql.NVarChar(64), biz_post_id)
    .input('user_id', sql.NVarChar(64), resolved_user_id)
    .input('interaction_type', sql.NVarChar(30), parent_comment_id ? 'reply_created' : 'comment_created')
    .input('parent_comment_id', sql.NVarChar(64), parent_comment_id)
    .input('content_text', sql.NVarChar(2000), content_text)
    .input('created_at_client', sql.DateTime2(3), created_at_client ? new Date(created_at_client) : null)
    .output('interaction_id', sql.NVarChar(64))
    .execute('antojados_core.usp_biz_post_comment');
  _emitEvent({ biz_post_id, user_id: resolved_user_id, event_type: 'biz_post_commented' });
  return result.output?.interaction_id || null;
}

async function viewBizPost({ biz_post_id, user_id }) {
  await getPool('antojados').request()
    .input('biz_post_id', sql.NVarChar(64), biz_post_id)
    .input('user_id', sql.NVarChar(64), user_id)
    .execute('antojados_core.usp_biz_post_view');
  return { ok: true };
}

async function getBizPostInteractionsSummary({ biz_post_id, user_id }) {
  const result = await getPool('antojados').request()
    .input('biz_post_id', sql.NVarChar(64), biz_post_id)
    .input('user_id', sql.NVarChar(64), user_id)
    .execute('antojados_core.usp_biz_post_interactions_summary');
  return result.recordset[0] || { has_liked: false, likes_count: 0, comments_count: 0 };
}

async function tapBizPost({ biz_post_id, tap_type, user_id = null }) {
  const col = tap_type === 'whatsapp' ? 'taps_whatsapp_count'
             : tap_type === 'maps' ? 'taps_maps_count' : null;
  if (!col) throw Object.assign(new Error('tap_type invalido'), { status: 400 });
  await getPool('antojados').request()
    .input('bizPostId', sql.NVarChar(64), biz_post_id)
    .query(`UPDATE antojados_core.biz_posts SET ${col} = ${col} + 1, cta_clicks_count = cta_clicks_count + 1 WHERE biz_post_id = @bizPostId`);
  _emitEvent({ biz_post_id, user_id, event_type: `biz_post_tap_${tap_type}` });
  return { ok: true };
}

async function deleteBizPost(biz_post_id) {
  const tr = new sql.Transaction(getPool('antojados'));
  try {
    await tr.begin();
    await new sql.Request(tr).input('bizPostId', sql.NVarChar(64), biz_post_id)
      .query('DELETE FROM antojados_core.biz_post_media WHERE post_id = @bizPostId');
    await new sql.Request(tr).input('bizPostId', sql.NVarChar(64), biz_post_id)
      .query('DELETE FROM antojados_core.biz_post_interactions WHERE biz_post_id = @bizPostId');
    await new sql.Request(tr).input('bizPostId', sql.NVarChar(64), biz_post_id)
      .query("UPDATE antojados_core.biz_posts SET status = 'deleted' WHERE biz_post_id = @bizPostId");
    await tr.commit();
  } catch (e) {
    try { await tr.rollback(); } catch (_) {}
    throw e;
  }
  return { ok: true };
}

const createBizPost = publishBizPost;

module.exports = {
  publishBizPost,
  createBizPost,
  attachBizPostMedia,
  uploadBizPostMedia,
  listBizPosts,
  getBizPost,
  likeBizPost,
  unlikeBizPost,
  commentBizPost,
  viewBizPost,
  getBizPostInteractionsSummary,
  tapBizPost,
  deleteBizPost,
};

// ═════════════════════════════════════════════════════════════════════════════
// SPONSOR MANAGEMENT (tiles, setup, expediente)
// No pertenece al modelo feed.md pero se mantiene para compatibilidad
// ═════════════════════════════════════════════════════════════════════════════

const { createHash } = require('crypto');
const SPONSOR_BIZ_KEY = 'tenant' + '_id';

const REQUIRED_EXPEDIENTE_DOC_TYPES = ['constancia_fiscal', 'identificacion_oficial'];
const ALLOWED_EXPEDIENTE_DOC_TYPES = [...REQUIRED_EXPEDIENTE_DOC_TYPES, 'orden_servicios_contratados'];

function withSponsorBizColumn(sqlText) {
  return sqlText.replaceAll('__SPONSOR_BIZ_COL__', SPONSOR_BIZ_KEY);
}

function hashEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  return createHash('sha256').update(normalized).digest('hex');
}

async function _getSponsorBizIdForUser(userId) {
  const result = await getPool('antojados').request().input('userId', sql.NVarChar(64), userId)
    .query(withSponsorBizColumn("SELECT __SPONSOR_BIZ_COL__ FROM antojados_core.sys_instancia WHERE cuenta_id = @userId AND instance_type = 'sponsor'"));
  const row = result.recordset[0];
  if (!row?.[SPONSOR_BIZ_KEY]) { const err = new Error('No se encontró instancia sponsor'); err.status = 404; throw err; }
  return row[SPONSOR_BIZ_KEY];
}

async function _resolveSponsorContext(instanceId, userId) {
  const result = await getPool('antojados').request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .input('userId', sql.NVarChar(64), userId)
    .query(withSponsorBizColumn("SELECT si.instance_id, si.__SPONSOR_BIZ_COL__, si.status FROM antojados_core.sys_instancia si WHERE si.instance_id = @instanceId AND si.cuenta_id = @userId AND si.instance_type = 'sponsor'"));
  const row = result.recordset[0];
  if (!row?.instance_id || !row?.[SPONSOR_BIZ_KEY]) { const err = new Error('Instancia sponsor no encontrada'); err.status = 404; throw err; }
  return { ...row, sponsor_biz_id: row[SPONSOR_BIZ_KEY] };
}

async function getTenantTilesForUser(userId, { status, limit = 50, offset = 0 } = {}) {
  const sponsorBizId = await _getSponsorBizIdForUser(userId);
  const req = getPool('antojados').request().input('sponsorBizId', sql.NVarChar(64), sponsorBizId).input('limit', sql.Int, limit).input('offset', sql.Int, offset);
  let where = 'WHERE t.__SPONSOR_BIZ_COL__ = @sponsorBizId';
  if (status) { req.input('status', sql.NVarChar(30), status); where += ' AND t.status = @status'; }
  const result = await req.query(`SELECT t.id, t.tile_type, t.content_json, t.status, t.submitted_at, t.reviewed_at, t.reject_reason, t.created_at FROM antojados_core.biz_tenant_tiles t ${where} ORDER BY t.created_at DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`.replace('__SPONSOR_BIZ_COL__', SPONSOR_BIZ_KEY));
  return result.recordset;
}

async function createTile(userId, { media_url, tile_type = 'brand', content_json }) {
  const sponsorBizId = await _getSponsorBizIdForUser(userId);
  const id = require('crypto').randomUUID();
  const contentRaw = content_json ? JSON.stringify(content_json) : JSON.stringify({ media_url });
  await getPool('antojados').request()
    .input('id', sql.NVarChar(64), id).input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('tileType', sql.NVarChar(30), tile_type)
    .input('contentJson', sql.NVarChar(sql.MAX), contentRaw)
    .input('status', sql.NVarChar(30), 'pending_review')
    .query(`INSERT INTO antojados_core.biz_tenant_tiles (id, __SPONSOR_BIZ_COL__, tile_type, content_json, status, submitted_at) VALUES (@id, @sponsorBizId, @tileType, @contentJson, @status, GETDATE())`.replace('__SPONSOR_BIZ_COL__', SPONSOR_BIZ_KEY));
  return { id, status: 'pending_review' };
}

async function deleteTile(tileId, userId) {
  const sponsorBizId = await _getSponsorBizIdForUser(userId);
  const check = await getPool('antojados').request()
    .input('tileId', sql.NVarChar(64), tileId).input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .query(`SELECT id, status FROM antojados_core.biz_tenant_tiles WHERE id = @tileId AND __SPONSOR_BIZ_COL__ = @sponsorBizId`.replace('__SPONSOR_BIZ_COL__', SPONSOR_BIZ_KEY));
  const tile = check.recordset[0];
  if (!tile) { const err = new Error('Tile no encontrado'); err.status = 404; throw err; }
  if (tile.status !== 'rejected') { const err = new Error('Solo se pueden eliminar tiles rechazados'); err.status = 409; throw err; }
  await getPool('antojados').request().input('tileId', sql.NVarChar(64), tileId).query('DELETE FROM antojados_core.biz_tenant_tiles WHERE id = @tileId');
  return { deleted: true, id: tileId };
}

async function setupSponsorBusiness(instanceId, userId, { business_name, biz_type, city_code, phone = null, website = null, description = null }) {
  const ctx = await _resolveSponsorContext(instanceId, userId);
  await getPool('antojados').request()
    .input('sponsorBizId', sql.NVarChar(64), ctx.sponsor_biz_id)
    .input('businessName', sql.NVarChar(400), business_name)
    .input('bizType', sql.NVarChar(60), biz_type)
    .input('cityCode', sql.NVarChar(60), city_code)
    .input('phone', sql.NVarChar(60), phone)
    .input('website', sql.NVarChar(600), website)
    .input('description', sql.NVarChar(300), description)
    .query('UPDATE antojados_core.biz_tenants SET business_name = @businessName, biz_type = @bizType, city_code = @cityCode, phone = @phone, website = @website, description = @description, updated_at = SYSUTCDATETIME() WHERE id = @sponsorBizId');
  return { instance_id: ctx.instance_id, status: ctx.status };
}

async function setupSponsorRepresentative(instanceId, userId, { tenant_user_id, display_name, representative_email, phone_e164 }) {
  const ctx = await _resolveSponsorContext(instanceId, userId);
  const tr = new sql.Transaction(getPool('antojados'));
  try {
    await tr.begin();
    const target = await new sql.Request(tr).input('tenantUserId', sql.NVarChar(64), tenant_user_id).input('instanceId', sql.NVarChar(64), ctx.instance_id)
      .query('SELECT id, user_id FROM antojados_core.biz_tenant_users WHERE id = @tenantUserId AND instance_id = @instanceId');
    const targetRow = target.recordset[0];
    if (!targetRow?.id || !targetRow?.user_id) { const err = new Error('tenant_user_id no pertenece a la instancia'); err.status = 400; throw err; }

    const identity = await new sql.Request(tr).input('targetUserId', sql.NVarChar(64), targetRow.user_id)
      .query('SELECT user_id, email_hash FROM antojados_core.auth_identities WHERE user_id = @targetUserId');
    const identityRow = identity.recordset[0];
    if (!identityRow) { const err = new Error('No se encontró la identidad'); err.status = 404; throw err; }

    const expectedEmailHash = hashEmail(representative_email);
    if (representative_email && expectedEmailHash !== identityRow.email_hash) { const err = new Error('representative_email no coincide'); err.status = 409; throw err; }

    await new sql.Request(tr).input('targetUserId', sql.NVarChar(64), targetRow.user_id).input('displayName', sql.NVarChar(300), display_name).input('phoneE164', sql.NVarChar(25), phone_e164)
      .query('UPDATE antojados_core.auth_identities SET display_name = @displayName, phone_e164 = @phoneE164, updated_at = SYSUTCDATETIME() WHERE user_id = @targetUserId');
    await new sql.Request(tr).input('instanceId', sql.NVarChar(64), ctx.instance_id)
      .query("UPDATE antojados_core.biz_tenant_users SET is_legal_representative = 0, representative_declared_at = NULL, representative_declared_by = NULL, updated_at = SYSUTCDATETIME() WHERE instance_id = @instanceId");
    await new sql.Request(tr).input('tenantUserId', sql.NVarChar(64), targetRow.id).input('declaredBy', sql.NVarChar(64), targetRow.id)
      .query("UPDATE antojados_core.biz_tenant_users SET is_legal_representative = 1, representative_declared_at = SYSUTCDATETIME(), representative_declared_by = @declaredBy, updated_at = SYSUTCDATETIME() WHERE id = @tenantUserId");
    await tr.commit();
    return { instance_id: ctx.instance_id, tenant_user_id: targetRow.id, user_id: targetRow.user_id };
  } catch (e) { try { await tr.rollback(); } catch (_) {} throw e; }
}

async function _completeSponsorAccountIfReady(pool, instanceId) {
  const context = await pool.request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .query(withSponsorBizColumn(`
      SELECT TOP 1 si.instance_id, si.__SPONSOR_BIZ_COL__ AS sponsor_biz_id,
             rep.id AS representative_tenant_user_id
      FROM antojados_core.sys_instancia si
      LEFT JOIN antojados_core.biz_tenant_users rep
        ON rep.instance_id = si.instance_id
       AND rep.is_legal_representative = 1
       AND rep.status = 'active'
      WHERE si.instance_id = @instanceId
        AND si.instance_type = 'sponsor'
    `));
  const row = context.recordset[0] || null;
  if (!row?.sponsor_biz_id || !row?.representative_tenant_user_id) return null;

  const docs = await pool.request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .query(`
      SELECT COUNT(DISTINCT doc_type) AS required_docs
      FROM antojados_core.biz_tenant_expediente_documents
      WHERE instance_id = @instanceId
        AND review_status = 'pending'
        AND doc_type IN ('constancia_fiscal', 'identificacion_oficial')
    `);
  if (Number(docs.recordset[0]?.required_docs || 0) < 2) return null;

  await pool.request()
    .input('tenant_id', sql.NVarChar(64), row.sponsor_biz_id)
    .execute('antojados_core.sp_biz_tenant_seed_system_profiles');

  const profile = await pool.request()
    .input('sponsorBizId', sql.NVarChar(64), row.sponsor_biz_id)
    .query(withSponsorBizColumn(`
      SELECT TOP 1 id
      FROM antojados_core.biz_tenant_profiles
      WHERE __SPONSOR_BIZ_COL__ = @sponsorBizId
        AND profile_type = 'admin_general'
      ORDER BY is_system DESC, created_at
    `));
  const adminProfileId = profile.recordset[0]?.id || null;
  if (!adminProfileId) return null;

  await pool.request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .input('representativeTenantUserId', sql.NVarChar(64), row.representative_tenant_user_id)
    .input('adminProfileId', sql.NVarChar(64), adminProfileId)
    .query(`
      UPDATE antojados_core.biz_tenant_users
      SET profile_id = CASE WHEN id = @representativeTenantUserId THEN @adminProfileId ELSE profile_id END,
          updated_at = SYSUTCDATETIME()
      WHERE instance_id = @instanceId;

      UPDATE antojados_core.biz_tenants
      SET status = 'pending_document_review', updated_at = SYSUTCDATETIME()
      WHERE id = (SELECT TOP 1 ${SPONSOR_BIZ_KEY} FROM antojados_core.sys_instancia WHERE instance_id = @instanceId);

      UPDATE antojados_core.sys_instancia
      SET status = 'pending_document_review', updated_at = SYSUTCDATETIME()
      WHERE instance_id = @instanceId;
    `);

  return {
    account_status: 'account_complete',
    tenant_status: 'pending_document_review',
    admin_general_tenant_user_id: row.representative_tenant_user_id,
  };
}

async function setupSponsorBilling(instanceId, userId, { billing_email, razon_social, rfc, fiscal_address }) {
  const ctx = await _resolveSponsorContext(instanceId, userId);
  await getPool('antojados').request()
    .input('sponsorBizId', sql.NVarChar(64), ctx.sponsor_biz_id)
    .input('billingEmail', sql.NVarChar(500), billing_email)
    .input('razonSocial', sql.NVarChar(500), razon_social)
    .input('rfc', sql.NVarChar(20), rfc)
    .input('fiscalAddress', sql.NVarChar(800), fiscal_address)
    .query('UPDATE antojados_core.biz_tenants SET billing_email = @billingEmail, razon_social = @razonSocial, rfc = @rfc, fiscal_address = @fiscalAddress, updated_at = SYSUTCDATETIME() WHERE id = @sponsorBizId');
  return { instance_id: ctx.instance_id, status: ctx.status };
}

function sanitizeFileName(value) {
  const name = String(value || 'documento').trim().replace(/[^a-zA-Z0-9._-]+/g, '_');
  return name || 'documento';
}

function persistExpedienteBase64({ instanceId, documentId, docType, fileName, fileBase64 }) {
  const raw = String(fileBase64 || '').trim();
  if (!raw) return null;
  const normalized = raw.includes(',') ? raw.split(',').pop() : raw;
  const buffer = Buffer.from(normalized, 'base64');
  if (!buffer.length) throw Object.assign(new Error('file_base64 invalido'), { status: 400 });

  const safeDocType = sanitizeFileName(docType);
  const safeFileName = sanitizeFileName(fileName);
  const relativeDir = pathMod.join('expediente', sanitizeFileName(instanceId), safeDocType);
  const uploadsRoot = pathMod.resolve(__dirname, '..', '..', '..', 'uploads');
  const targetDir = pathMod.join(uploadsRoot, relativeDir);
  fs.mkdirSync(targetDir, { recursive: true });
  const storedName = `${documentId}_${safeFileName}`;
  fs.writeFileSync(pathMod.join(targetDir, storedName), buffer);
  return `/uploads/${relativeDir.split(pathMod.sep).join('/')}/${storedName}`;
}

async function uploadSponsorExpedienteDocument(instanceId, userId, { uploaded_by_tenant_user_id, doc_type, file_name, storage_url, file_base64 = null, mime_type, size_bytes, checksum_sha256 = null }) {
  const ctx = await _resolveSponsorContext(instanceId, userId);
  const normalizedDocType = String(doc_type || '').trim().toLowerCase();
  if (!ALLOWED_EXPEDIENTE_DOC_TYPES.includes(normalizedDocType)) { const err = new Error('doc_type invalido'); err.status = 400; throw err; }

  const documentId = require('crypto').randomUUID();
  const resolvedStorageUrl = storage_url || persistExpedienteBase64({
    instanceId: ctx.instance_id,
    documentId,
    docType: normalizedDocType,
    fileName: file_name,
    fileBase64: file_base64,
  });
  if (!resolvedStorageUrl) throw Object.assign(new Error('storage_url o file_base64 es requerido'), { status: 400 });

  const pool = getPool('antojados');
  await pool.request()
    .input('id', sql.NVarChar(64), documentId).input('instanceId', sql.NVarChar(64), ctx.instance_id)
    .input('sponsorBizId', sql.NVarChar(64), ctx.sponsor_biz_id)
    .input('uploadedBy', sql.NVarChar(64), uploaded_by_tenant_user_id)
    .input('docType', sql.NVarChar(60), normalizedDocType)
    .input('fileName', sql.NVarChar(400), file_name)
    .input('storageUrl', sql.NVarChar(800), resolvedStorageUrl)
    .input('mimeType', sql.NVarChar(100), mime_type)
    .input('sizeBytes', sql.Int, Number(size_bytes))
    .input('checksum', sql.NVarChar(64), checksum_sha256)
    .query(`INSERT INTO antojados_core.biz_tenant_expediente_documents (id, instance_id, __SPONSOR_BIZ_COL__, uploaded_by_tenant_user_id, doc_type, file_name, storage_url, mime_type, size_bytes, checksum_sha256, review_status, created_at) VALUES (@id, @instanceId, @sponsorBizId, @uploadedBy, @docType, @fileName, @storageUrl, @mimeType, @sizeBytes, @checksum, 'pending', SYSUTCDATETIME())`.replace('__SPONSOR_BIZ_COL__', SPONSOR_BIZ_KEY));
  const account_completion = await _completeSponsorAccountIfReady(pool, ctx.instance_id);
  return { id: documentId, instance_id: ctx.instance_id, uploaded_by_tenant_user_id, doc_type: normalizedDocType, file_name, storage_url: resolvedStorageUrl, mime_type, size_bytes: Number(size_bytes), checksum_sha256, review_status: 'pending', account_completion };
}

async function listSponsorExpediente(instanceId, userId) {
  const ctx = await _resolveSponsorContext(instanceId, userId);
  const result = await getPool('antojados').request().input('instanceId', sql.NVarChar(64), ctx.instance_id)
    .query('SELECT d.id, d.instance_id, d.uploaded_by_tenant_user_id, d.doc_type, d.file_name, d.storage_url, d.mime_type, d.size_bytes, d.checksum_sha256, d.review_status, d.reviewed_by, d.reviewed_at, d.created_at FROM antojados_core.biz_tenant_expediente_documents d WHERE d.instance_id = @instanceId ORDER BY d.created_at DESC');
  return result.recordset;
}

async function getSponsorRegistrationForGt(instanceId) {
  const result = await getPool('antojados').request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .query(withSponsorBizColumn(`
      SELECT TOP 1
        si.instance_id,
        si.status AS instance_status,
        t.id AS tenant_id,
        t.business_name,
        t.biz_type,
        t.city_code,
        t.phone,
        t.website,
        t.description,
        t.billing_email,
        t.razon_social,
        t.rfc,
        t.fiscal_address,
        t.status AS tenant_status,
        rep.id AS representative_tenant_user_id,
        rep.user_id AS representative_user_id,
        rep.is_legal_representative,
        ai.display_name AS representative_name,
        ai.phone_e164 AS representative_phone
      FROM antojados_core.sys_instancia si
      INNER JOIN antojados_core.biz_tenants t ON t.id = si.__SPONSOR_BIZ_COL__
      LEFT JOIN antojados_core.biz_tenant_users rep
        ON rep.instance_id = si.instance_id
       AND rep.is_legal_representative = 1
       AND rep.status = 'active'
      LEFT JOIN antojados_core.auth_identities ai ON ai.user_id = rep.user_id
      WHERE si.instance_id = @instanceId
        AND si.instance_type = 'sponsor'
    `));
  const registration = result.recordset[0] || null;
  if (!registration) return null;

  const docs = await getPool('antojados').request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .query(`
      SELECT id, instance_id, uploaded_by_tenant_user_id, doc_type, file_name, storage_url,
             mime_type, size_bytes, checksum_sha256, review_status, reviewed_by, reviewed_at, created_at
      FROM antojados_core.biz_tenant_expediente_documents
      WHERE instance_id = @instanceId
      ORDER BY created_at DESC
    `);

  return {
    ...registration,
    documents: docs.recordset,
  };
}

async function reviewSponsorRegistration(instanceId, { decision, reviewed_by = null, corrections = null } = {}) {
  const normalizedDecision = String(decision || '').trim().toLowerCase();
  if (!['approve', 'reject'].includes(normalizedDecision)) {
    throw Object.assign(new Error('decision debe ser approve o reject'), { status: 400 });
  }

  const nextStatus = normalizedDecision === 'approve' ? 'pending_efirma' : 'registration_rejected';
  const documentStatus = normalizedDecision === 'approve' ? 'approved' : 'rejected';
  const pool = getPool('antojados');
  const tr = new sql.Transaction(pool);

  try {
    await tr.begin();

    const context = await new sql.Request(tr)
      .input('instanceId', sql.NVarChar(64), instanceId)
      .query(withSponsorBizColumn(`
        SELECT TOP 1 si.instance_id, si.__SPONSOR_BIZ_COL__ AS sponsor_biz_id, si.status
        FROM antojados_core.sys_instancia si WITH (UPDLOCK, HOLDLOCK)
        WHERE si.instance_id = @instanceId
          AND si.instance_type = 'sponsor'
      `));
    const row = context.recordset[0] || null;
    if (!row?.instance_id || !row?.sponsor_biz_id) {
      throw Object.assign(new Error('Instancia sponsor no encontrada.'), { status: 404 });
    }
    if (!['pending_document_review', 'registration_rejected'].includes(String(row.status || ''))) {
      throw Object.assign(new Error('La instancia no esta en estado revisable.'), { status: 409 });
    }

    const docs = await new sql.Request(tr)
      .input('instanceId', sql.NVarChar(64), instanceId)
      .query(`
        SELECT COUNT(DISTINCT doc_type) AS required_docs
        FROM antojados_core.biz_tenant_expediente_documents
        WHERE instance_id = @instanceId
          AND doc_type IN ('constancia_fiscal', 'identificacion_oficial')
      `);
    if (Number(docs.recordset[0]?.required_docs || 0) < 2) {
      throw Object.assign(new Error('Faltan documentos requeridos para revisar registro.'), { status: 409 });
    }

    await new sql.Request(tr)
      .input('instanceId', sql.NVarChar(64), instanceId)
      .input('reviewStatus', sql.NVarChar(30), documentStatus)
      .input('reviewedBy', sql.NVarChar(64), reviewed_by)
      .query(`
        UPDATE antojados_core.biz_tenant_expediente_documents
        SET review_status = @reviewStatus,
            reviewed_by = @reviewedBy,
            reviewed_at = SYSUTCDATETIME()
        WHERE instance_id = @instanceId;
      `);

    await new sql.Request(tr)
      .input('instanceId', sql.NVarChar(64), instanceId)
      .input('sponsorBizId', sql.NVarChar(64), row.sponsor_biz_id)
      .input('status', sql.NVarChar(40), nextStatus)
      .query(`
        UPDATE antojados_core.sys_instancia
        SET status = @status, updated_at = SYSUTCDATETIME()
        WHERE instance_id = @instanceId;

        UPDATE antojados_core.biz_tenants
        SET status = @status, updated_at = SYSUTCDATETIME()
        WHERE id = @sponsorBizId;
      `);

    await tr.commit();
    return {
      instance_id: instanceId,
      status: nextStatus,
      decision: normalizedDecision,
      corrections,
      source_table: 'sys_instancia',
      source_field: 'status',
      source_status: nextStatus,
    };
  } catch (error) {
    try { await tr.rollback(); } catch (rollbackError) { console.warn('reviewSponsorRegistration.rollback_failed', rollbackError); }
    throw error;
  }
}

async function getBizPostMedia(biz_post_id) {
  const result = await getPool('antojados').request().input('bizPostId', sql.NVarChar(64), biz_post_id)
    .query("SELECT m.media_id, m.post_id, m.media_url, m.media_type, m.sort_order, m.thumb_url, m.feed_url, m.full_url, m.asset_id FROM antojados_core.biz_post_media m WHERE m.post_id = @bizPostId ORDER BY m.sort_order ASC");
  return result.recordset;
}

async function listBizComments(biz_post_id, { limit, offset }) {
  const result = await getPool('antojados').request()
    .input('bizPostId', sql.NVarChar(64), biz_post_id).input('limit', sql.Int, limit).input('offset', sql.Int, offset)
    .query("SELECT i.interaction_id, i.user_id, COALESCE(a.display_name, i.user_id) AS display_name, a.instagram_handle AS author_handle, i.interaction_type, i.parent_comment_id, i.content_text, i.received_at_server FROM antojados_core.biz_post_interactions i LEFT JOIN antojados_core.auth_identities a ON a.user_id = i.user_id WHERE i.biz_post_id = @bizPostId AND i.interaction_type IN ('comment_created', 'reply_created') AND i.moderation_status = 'approved' ORDER BY i.received_at_server ASC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY");
  return result.recordset;
}

async function shareBizPost({ biz_post_id, user_id, created_at_client }) {
  await getPool('antojados').request().input('bizPostId', sql.NVarChar(64), biz_post_id)
    .query('UPDATE antojados_core.biz_posts SET shares_count = shares_count + 1 WHERE biz_post_id = @bizPostId');
  _emitEvent({ biz_post_id, user_id, event_type: 'biz_post_shared', event_ts: created_at_client || Date.now() });
  return { ok: true };
}

async function clickBizCta({ biz_post_id, user_id, cta_type = 'generic', created_at_client }) {
  await getPool('antojados').request().input('bizPostId', sql.NVarChar(64), biz_post_id)
    .query('UPDATE antojados_core.biz_posts SET cta_clicks_count = cta_clicks_count + 1 WHERE biz_post_id = @bizPostId');
  _emitEvent({ biz_post_id, user_id, event_type: 'biz_cta_clicked', event_ts: created_at_client || Date.now(), payload: { cta_type } });
  return { ok: true };
}

// override exports to include legacy sponsor functions
module.exports = Object.assign(module.exports, {
  getBizPostMedia,
  addBizComment: commentBizPost,
  listBizComments,
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
});
