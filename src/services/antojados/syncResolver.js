'use strict';
/**
 * syncResolver.js — Resolver de Sincronización Offline
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Sincronización Offline (Outbox SQLite)
 * RESPONSABLE:  Ingestar eventos offline enviados desde el cliente,
 *               con deduplicación por idempotency_key.
 *
 * NO HACE:
 *   - No procesa eventos (solo los inserta en gt_antojados.food_event_ingesta)
 *
 * TABLA QUE TOCA:
 *   gt_antojados.food_event_ingesta → ingestión de eventos offline
 *
 * REFERENCIAS:
 *   - syncMapper.js, sync.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql, randomUUID, normalizeAnalyticsEventType } = require('./_shared');

async function syncEvents({ batch_id, user_id, device_id, events }) {
  const pool = getPool('integration');
  const results = { accepted: [], duplicate: [], error: [] };

  for (const ev of events) {
    const resolvedUserId = ev.user_id || user_id;
    const resolvedEventTs = ev.event_ts || new Date().toISOString();

    if (!ev.event_type || !resolvedUserId) {
      results.error.push({ idempotency_key: ev.idempotency_key, reason: 'missing_fields' });
      continue;
    }
    const normalizedEventType = normalizeAnalyticsEventType(ev.event_type, ev.payload);
    if (!ev.idempotency_key) {
      const ts = new Date(resolvedEventTs).toISOString().replace(/[-:T.Z]/g, '').substring(0, 14);
      ev.idempotency_key = `${resolvedUserId}_${normalizedEventType}_${ev.id || ev.post_id || ''}_${ts}`;
    }
    try {
      await pool.request()
        .input('id', sql.NVarChar(36), randomUUID())
        .input('ikey', sql.NVarChar(128), ev.idempotency_key)
        .input('uid', sql.NVarChar(64), resolvedUserId)
        .input('plid', sql.NVarChar(64), ev.id || null)
        .input('pid', sql.NVarChar(64), ev.post_id || null)
        .input('cid', sql.NVarChar(64), ev.campaign_id || null)
        .input('did', sql.NVarChar(64), device_id || null)
        .input('etype', sql.NVarChar(80), normalizedEventType)
        .input('ets', sql.DateTime2(3), new Date(resolvedEventTs))
        .input('bid', sql.NVarChar(36), batch_id || null)
        .input('tileId', sql.NVarChar(64), ev.tile_id || null)
        .input('sourcePlacement', sql.NVarChar(50), ev.source_placement || null)
        .input('raw', sql.NVarChar(sql.MAX), ev.payload ? JSON.stringify(ev.payload) : null)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM gt_antojados.food_event_ingesta WHERE idempotency_key = @ikey)
            INSERT INTO gt_antojados.food_event_ingesta
              (ingesta_id, idempotency_key, user_id, id, post_id, campaign_id,
               tile_id, device_id, event_type, event_ts, source_placement, batch_id, raw_payload, status_code)
            VALUES
              (@id, @ikey, @uid, @plid, @pid, @cid,
               @tileId, @did, @etype, @ets, @sourcePlacement, @bid, @raw, 'PENDING')
        `);
      results.accepted.push(ev.idempotency_key);
    } catch (e) {
      if (e.number === 2627 || (e.message && e.message.includes('UX_fei_idempotency'))) {
        results.duplicate.push(ev.idempotency_key);
      } else {
        console.error('[syncEvents] ingest error:', e.message);
        results.error.push({ idempotency_key: ev.idempotency_key, reason: e.message });
      }
    }
  }
  return results;
}

module.exports = { syncEvents };
