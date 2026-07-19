'use strict';
// ─── Shared: DB pools, sql types, utilities, analytics emitter ───────────────
// Todos los servicios de dominio importan desde aquí.
// _emitEvent es best-effort por diseño — errores no propagan al caller.

const { getPool, sql } = require('../../db');
const { randomUUID }   = require('crypto');
const fs               = require('fs');
const pathMod          = require('path');

function normalizeAnalyticsEventType(eventType, payload = null) {
  const normalizedType = String(eventType || '').trim();
  if (!normalizedType) return normalizedType;

  switch (normalizedType) {
  case 'place_rating':
    return 'post_rated';
  case 'like_created':
    return 'post_liked';
  case 'comment_created':
  case 'reply_created':
    return 'post_commented';
  case 'post_rated':
    return 'rating_submitted';
  case 'follow_toggle':
    if (payload?.target_type === 'place') {
      return payload?.action === 'unfollowed' ? 'place_unfollowed' : 'place_followed';
    }
    if (payload?.target_type === 'user') {
      return payload?.action === 'unfollowed' ? 'user_unfollowed' : 'user_followed';
    }
    return normalizedType;
  case 'save_toggle':
    return payload?.action === 'unsaved' ? 'place_unsaved' : 'place_saved';
  case 'biz_post_tap_whatsapp':
    return 'cta_whatsapp';
  case 'biz_post_tap_maps':
    return 'cta_maps';
  case 'biz_post_tap_call':
    return 'cta_call';
  default:
    return normalizedType;
  }
}

// ═══════════════════════════════════════════════════════════════
// PRIVATE — emite evento analítico a ATLX_GT_INTEGRATION
// Best-effort: error aquí no propaga al caller.
//
// Columnas reales de gt_antojados.food_event_ingesta:
//   ingesta_id, idempotency_key, user_id, post_id, place_id, campaign_id,
//   biz_post_id, tile_id, device_id, event_type, event_ts,
//   source_placement, barrio_code, batch_id, raw_payload, status_code, received_at
//
// user_id es NOT NULL en la tabla. Para eventos biz (biz_post_*)
// que NO tienen user_id, se pasa 'system' como uid.
// place_id solo aplica para eventos soc (user posts con ubicación).
// ═══════════════════════════════════════════════════════════════
async function _emitEvent({ user_id, post_id, place_id, campaign_id, biz_post_id,
                             device_id, tile_id, event_type, event_ts,
                             source_placement, payload }) {
  const normalizedEventType = normalizeAnalyticsEventType(event_type, payload);
  const ikey = `${user_id || 'system'}_${normalizedEventType}_${post_id || biz_post_id || place_id || tile_id || ''}_${event_ts || Date.now()}`;
  try {
    await getPool('integration').request()
      .input('id',              sql.NVarChar(36),      randomUUID())
      .input('ikey',            sql.NVarChar(128),     ikey)
      .input('uid',             sql.NVarChar(64),      user_id            || 'system')
      .input('pid',             sql.NVarChar(64),      post_id            || null)
      .input('plid',            sql.NVarChar(64),      place_id           || null)
      .input('cid',             sql.NVarChar(64),      campaign_id        || null)
      .input('bizPostId',       sql.NVarChar(64),      biz_post_id        || null)
      .input('tileId',          sql.NVarChar(64),      tile_id            || null)
      .input('did',             sql.NVarChar(64),      device_id          || null)
      .input('etype',           sql.NVarChar(80),      normalizedEventType)
      .input('ets',             sql.DateTime2(3),      new Date(event_ts || Date.now()))
      .input('sourcePlacement', sql.NVarChar(50),      source_placement   || null)
      .input('raw',             sql.NVarChar(sql.MAX), payload ? JSON.stringify(payload) : null)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM gt_antojados.food_event_ingesta WHERE idempotency_key = @ikey)
          INSERT INTO gt_antojados.food_event_ingesta
            (ingesta_id, idempotency_key, user_id, post_id, place_id, campaign_id,
             biz_post_id, tile_id, device_id, event_type, event_ts,
             source_placement, raw_payload, status_code)
          VALUES
            (@id, @ikey, @uid, @pid, @plid, @cid,
             @bizPostId, @tileId, @did, @etype, @ets,
             @sourcePlacement, @raw, 'PENDING')
      `);
  } catch (err) {
    console.error('[antojados.service] integration emit error:', event_type, err.message);
  }
}

module.exports = { getPool, sql, randomUUID, fs, pathMod, _emitEvent, normalizeAnalyticsEventType };
