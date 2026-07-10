'use strict';
/**
 * app-diag.routes.js — Receptor de Trazas de Diagnóstico
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Diagnóstico de Aplicación (App Diag)
 * RESPONSABLE:  Recibir y almacenar en ring-buffer (memoria) trazas técnicas
 *               de diagnóstico enviadas desde la app mobile. No requiere
 *               autenticación intencionalmente (solo datos técnicos, sin PII).
 *
 * ENDPOINTS:
 *   POST   /app-diag   → recibe evento de la app
 *   GET    /app-diag   → lista últimos eventos (para GT Web)
 *   DELETE /app-diag   → limpia el buffer
 *
 * REFERENCIAS:
 *   - Ring-buffer local con máximo MAX_EVENTS (200)
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');

const router = Router();
const MAX_EVENTS = 200;
const _buffer = [];

// ─── POST /app-diag ──────────────────────────────────────────────────────────
router.post('/app-diag', (req, res) => {
  const body = req.body || {};
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    ts: new Date().toISOString(),
    level: String(body.level || 'info'),
    source: String(body.source || 'app'),
    module: String(body.module || 'antojadosmx'),
    component: String(body.component || 'desma'),
    message: String(body.message || '').slice(0, 700),
    status: Number.isFinite(Number(body.status)) ? Number(body.status) : null,
    method: body.method ? String(body.method).toUpperCase() : null,
    url: body.url ? String(body.url).slice(0, 300) : null,
    latencyMs: Number.isFinite(Number(body.latencyMs)) ? Number(body.latencyMs) : null,
    details: body.details ? String(body.details).slice(0, 1200) : null,
  };
  _buffer.unshift(entry);
  if (_buffer.length > MAX_EVENTS) _buffer.splice(MAX_EVENTS);
  return res.status(201).json({ ok: true, id: entry.id });
});

// ─── GET /app-diag ───────────────────────────────────────────────────────────
router.get('/app-diag', (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 60)));
  return res.json({ ok: true, data: _buffer.slice(0, limit) });
});

// ─── DELETE /app-diag ────────────────────────────────────────────────────────
router.delete('/app-diag', (_req, res) => {
  _buffer.splice(0);
  return res.json({ ok: true });
});

module.exports = router;
