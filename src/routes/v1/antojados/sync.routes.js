'use strict';
/**
 * sync.routes.js — Rutas de Sincronización Offline
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Sincronización Offline (Outbox SQLite)
 * RESPONSABLE:  Exponer endpoint REST para ingesta batch de eventos
 *               offline desde el cliente (app).
 *
 * ENDPOINTS:
 *   POST /sync/events → ingesta de eventos con dedup por idempotency_key
 *
 * REFERENCIAS:
 *   - sync.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/sync.service');

const router = Router();

// POST /api/v1/antojados/sync/events
router.post('/sync/events', async (req, res) => {
  const { batch_id, user_id, device_id, events } = req.body;
  if (!user_id || !Array.isArray(events) || events.length === 0)
    return res.status(400).json({ error: 'user_id y events[] son requeridos' });
  if (events.length > 200)
    return res.status(400).json({ error: 'Máximo 200 eventos por batch' });
  try {
    const results = await svc.syncEvents({ batch_id, user_id, device_id, events });
    const status  = results.error.length > 0 && results.accepted.length === 0 ? 422 : 202;
    res.status(status).json({
      batch_id:  batch_id || null,
      accepted:  results.accepted.length,
      duplicate: results.duplicate.length,
      error:     results.error.length,
      detail:    results.error.length > 0 ? results.error : undefined,
    });
  } catch (e) {
    console.error('[sync.routes] sync/events failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
