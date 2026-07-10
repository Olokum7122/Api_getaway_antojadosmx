'use strict';
/**
 * analytics.routes.js — Rutas de Analíticas
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Analíticas y Métricas (GT Web)
 * RESPONSABLE:  Exponer endpoints REST para consulta de engagement,
 *               place scores, user scores, tenant summary, sponsor metrics,
 *               y búsqueda de ciudades vía Google Places API.
 *
 * ENDPOINTS:
 *   GET /analytics/engagement          → engagement por scope/periodo
 *   GET /analytics/place-scores        → scores de lugares
 *   GET /analytics/user-score          → score individual de usuario
 *   GET /analytics/user-summary        → resumen de usuario
 *   GET /analytics/tenant-summary      → resumen de tenants
 *   GET /analytics/sponsor-metrics     → métricas de sponsors
 *   GET /analytics/tile-performance    → performance de tiles
 *   GET /cities/search                 → autocomplete de ciudades
 *
 * REFERENCIAS:
 *   - analytics.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/analytics.service');
const { send } = require('./_helpers');

const router = Router();

// GET /api/v1/antojados/analytics/engagement
router.get('/analytics/engagement', (req, res) => {
  send(res, svc.getEngagement(req.query).then(data => ({ data, total: data.length })));
});

// GET /api/v1/antojados/analytics/place-scores
router.get('/analytics/place-scores', (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit || 20, 10));
  send(res, svc.getPlaceScores({ ...req.query, limit }).then(data => ({ data, total: data.length })));
});

// GET /api/v1/antojados/analytics/user-score?user_id=&year=&month=  (V2)
router.get('/analytics/user-score', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.getUserScore(req.query));
});

// GET /api/v1/antojados/analytics/user-summary?user_id=
router.get('/analytics/user-summary', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.getUserSummary(req.query));
});

// GET /api/v1/antojados/analytics/tenant-summary
router.get('/analytics/tenant-summary', (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit || 20, 10));
  send(res, svc.getTenantSummary({ ...req.query, limit }).then(data => ({ data, total: data.length })));
});

// GET /api/v1/antojados/analytics/sponsor-metrics
router.get('/analytics/sponsor-metrics', (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit || 20, 10));
  send(res, svc.getSponsorMetrics({ ...req.query, limit }).then(data => ({ data, total: data.length })));
});

// GET /api/v1/antojados/analytics/tile-performance
router.get('/analytics/tile-performance', (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit || 20, 10));
  send(res, svc.getTilePerformance({ ...req.query, limit }).then(data => ({ data, total: data.length })));
});

// GET /api/v1/antojados/cities/search?q=cancun
router.get('/cities/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ predictions: [] });
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return res.status(503).json({ error: 'places_not_configured' });
  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=(cities)&components=country:mx&language=es&key=${key}`;
    const r = await fetch(url);
    const data = await r.json();
    const predictions = (data.predictions || []).slice(0, 4).map(p => ({
      id: p.id,
      name: p.structured_formatting?.main_text || p.description,
      description: p.description,
    }));
    res.json({ predictions });
  } catch (e) {
    console.error('[analytics.routes] cities/search failed:', e.message);
    res.status(502).json({ error: 'places_fetch_failed' });
  }
});

module.exports = router;
