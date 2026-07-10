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
 * MODELO DE DATOS: apps-antojados/docs/feed.md (Sección 1, 2, 5)
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql, _emitEvent } = require('./_shared');
const engineClient = require('./engineClient');

async function publishBizPost({ sponsor_id, channel, feed_type = 'general', city_code = null, zone_code = null, media_url = null, doc_json = null, asset_id = null }) {
  if (!sponsor_id) throw Object.assign(new Error('sponsor_id requerido'), { status: 400 });
  if (!channel) throw Object.assign(new Error('channel requerido'), { status: 400 });

  let resolvedMediaUrl = media_url;
  if (asset_id) {
    const payload = await engineClient.getReadyPayload(asset_id);
    if (!payload) throw Object.assign(new Error('asset_id no encontrado'), { status: 404 });
    resolvedMediaUrl = payload.feed_url || payload.full_url || payload.thumb_url || media_url;
    if (!resolvedMediaUrl) throw Object.assign(new Error('Media no ready'), { status: 409 });
  }

  const req = getPool('antojados').request()
    .input('sponsor_id', sql.NVarChar(64), sponsor_id)
    .input('channel', sql.NVarChar(30), channel)
    .input('feed_type', sql.NVarChar(30), feed_type)
    .input('media_url', sql.NVarChar(500), resolvedMediaUrl)
    .input('doc_json', sql.NVarChar(sql.MAX), doc_json ? JSON.stringify(doc_json) : null)
    .input('city_code', sql.NVarChar(20), city_code)
    .input('zone_code', sql.NVarChar(20), zone_code)
    .output('biz_post_id', sql.NVarChar(64));

  await req.execute('antojados_core.usp_publish_biz_post');

  _emitEvent({ sponsor_id, biz_post_id: req.output.biz_post_id, event_type: 'biz_post_created', payload: { channel, feed_type } });
  return { biz_post_id: req.output.biz_post_id };
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
    .execute('antojados_core.sp_biz_post_media_attach');
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

async function listBizPosts({ sponsor_id, channel, feed_type, limit = 20, offset = 0, media_url_invalid } = {}) {
  const isAudit = media_url_invalid === true || media_url_invalid === 'true';
  
  const result = await getPool('antojados').request()
    .input('sponsorId', sql.NVarChar(64), isAudit ? null : (sponsor_id || null))
    .input('channel', sql.NVarChar(30), isAudit ? null : (channel || null))
    .input('feedType', sql.NVarChar(30), feed_type || null)
    .input('limit', sql.Int, isAudit ? 200 : limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT bp.biz_post_id, bp.sponsor_id, bp.channel, bp.feed_type,
             bp.media_url, bp.doc_json,
             bp.views_count, bp.likes_count, bp.comments_count, bp.shares_count,
             bp.cta_clicks_count, bp.taps_whatsapp_count, bp.taps_maps_count,
             bp.engagement_score, bp.status, bp.created_at,
             (SELECT m.media_id, m.media_type, m.media_url, m.sort_order,
                     m.thumb_url, m.feed_url, m.full_url, m.asset_id
              FROM antojados_core.biz_post_media m
              WHERE m.post_id = bp.biz_post_id ORDER BY m.sort_order
              FOR JSON PATH) AS media_json
      FROM antojados_core.biz_posts bp
      WHERE bp.status ${isAudit ? "IN ('active', 'archived')" : "= 'active'"}
        ${isAudit ? "AND (bp.media_url IS NULL OR bp.media_url = '' OR (bp.media_url NOT LIKE 'http://%' AND bp.media_url NOT LIKE 'https://%'))" : ''}
        AND (@sponsorId IS NULL OR bp.sponsor_id = @sponsorId)
        AND (@channel IS NULL OR bp.channel = @channel)
        AND (@feedType IS NULL OR bp.feed_type = @feedType)
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
             bp.media_url, bp.doc_json,
             bp.views_count, bp.likes_count, bp.comments_count, bp.shares_count,
             bp.cta_clicks_count, bp.taps_whatsapp_count, bp.taps_maps_count,
             bp.engagement_score, bp.status, bp.created_at,
             (SELECT m.media_id, m.media_type, m.media_url, m.sort_order,
                     m.thumb_url, m.feed_url, m.full_url, m.asset_id
              FROM antojados_core.biz_post_media m
              WHERE m.post_id = bp.biz_post_id ORDER BY m.sort_order
              FOR JSON PATH) AS media_json
      FROM antojados_core.biz_posts bp
      WHERE bp.biz_post_id = @bizPostId AND bp.status = 'active'
    `);
  const row = result.recordset[0];
  if (!row) return null;
  return { ...row, media: row.media_json ? JSON.parse(row.media_json) : [] };
}

async function likeBizPost({ biz_post_id, user_id }) {
  await getPool('antojados').request()
    .input('biz_post_id', sql.NVarChar(64), biz_post_id)
    .input('user_id', sql.NVarChar(64), user_id)
    .execute('antojados_core.usp_biz_post_like');
  _emitEvent({ biz_post_id, user_id, event_type: 'biz_post_liked' });
  return { ok: true };
}

async function unlikeBizPost({ biz_post_id, user_id }) {
  await getPool('antojados').request()
    .input('biz_post_id', sql.NVarChar(64), biz_post_id)
    .input('user_id', sql.NVarChar(64), user_id)
    .execute('antojados_core.usp_biz_post_unlike');
  _emitEvent({ biz_post_id, user_id, event_type: 'biz_post_unliked' });
  return { ok: true };
}

async function commentBizPost({ biz_post_id, user_id, content_text, parent_comment_id = null, created_at_client = null }) {
  await getPool('antojados').request()
    .input('biz_post_id', sql.NVarChar(64), biz_post_id)
    .input('user_id', sql.NVarChar(64), user_id)
    .input('interaction_type', sql.NVarChar(30), parent_comment_id ? 'reply_created' : 'comment_created')
    .input('parent_comment_id', sql.NVarChar(64), parent_comment_id)
    .input('content_text', sql.NVarChar(2000), content_text)
    .input('created_at_client', sql.DateTime2(3), created_at_client ? new Date(created_at_client) : null)
    .execute('antojados_core.usp_biz_post_comment');
  _emitEvent({ biz_post_id, user_id, event_type: 'biz_post_commented' });
  return { ok: true };
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

async function uploadSponsorExpedienteDocument(instanceId, userId, { uploaded_by_tenant_user_id, doc_type, file_name, storage_url, mime_type, size_bytes, checksum_sha256 = null }) {
  const ctx = await _resolveSponsorContext(instanceId, userId);
  const normalizedDocType = String(doc_type || '').trim().toLowerCase();
  if (!ALLOWED_EXPEDIENTE_DOC_TYPES.includes(normalizedDocType)) { const err = new Error('doc_type invalido'); err.status = 400; throw err; }

  const documentId = require('crypto').randomUUID();
  await getPool('antojados').request()
    .input('id', sql.NVarChar(64), documentId).input('instanceId', sql.NVarChar(64), ctx.instance_id)
    .input('sponsorBizId', sql.NVarChar(64), ctx.sponsor_biz_id)
    .input('uploadedBy', sql.NVarChar(64), uploaded_by_tenant_user_id)
    .input('docType', sql.NVarChar(60), normalizedDocType)
    .input('fileName', sql.NVarChar(400), file_name)
    .input('storageUrl', sql.NVarChar(800), storage_url)
    .input('mimeType', sql.NVarChar(100), mime_type)
    .input('sizeBytes', sql.Int, Number(size_bytes))
    .input('checksum', sql.NVarChar(64), checksum_sha256)
    .query(`INSERT INTO antojados_core.biz_tenant_expediente_documents (id, instance_id, __SPONSOR_BIZ_COL__, uploaded_by_tenant_user_id, doc_type, file_name, storage_url, mime_type, size_bytes, checksum_sha256, review_status, created_at) VALUES (@id, @instanceId, @sponsorBizId, @uploadedBy, @docType, @fileName, @storageUrl, @mimeType, @sizeBytes, @checksum, 'pending', SYSUTCDATETIME())`.replace('__SPONSOR_BIZ_COL__', SPONSOR_BIZ_KEY));
  return { id: documentId, instance_id: ctx.instance_id, uploaded_by_tenant_user_id, doc_type: normalizedDocType, file_name, storage_url, mime_type, size_bytes: Number(size_bytes), checksum_sha256, review_status: 'pending' };
}

async function listSponsorExpediente(instanceId, userId) {
  const ctx = await _resolveSponsorContext(instanceId, userId);
  const result = await getPool('antojados').request().input('instanceId', sql.NVarChar(64), ctx.instance_id)
    .query('SELECT d.id, d.instance_id, d.uploaded_by_tenant_user_id, d.doc_type, d.file_name, d.storage_url, d.mime_type, d.size_bytes, d.checksum_sha256, d.review_status, d.reviewed_by, d.reviewed_at, d.created_at FROM antojados_core.biz_tenant_expediente_documents d WHERE d.instance_id = @instanceId ORDER BY d.created_at DESC');
  return result.recordset;
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
});
