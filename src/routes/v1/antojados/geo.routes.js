'use strict';
/**
 * geo.routes.js — Rutas de Geografía / Contexto Geoespacial
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Sistema de Geografía y Contexto (Geo)
 * RESPONSABLE:  Exponer endpoints REST para consulta de scopes geográficos,
 *               búsqueda de ciudades y resolución de contexto por coordenadas.
 *
 * ENDPOINTS:
 *   GET    /geo/scopes       → catálogo de scopes (scope_level, parent, q)
 *   GET    /geo/cities/search → búsqueda de ciudades (q)
 *   GET    /geo/resolve      → resolver contexto por lat/lng (query)
 *   POST   /geo/resolve      → resolver contexto por lat/lng (body)
 *
 * REFERENCIAS:
 *   - apps-antojados/docs/feed.md (Sección 11.2)
 *   - geo.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { Router } = require('express');
const svc = require('../../../services/antojados/geo.service');
const { send } = require('./_helpers');

const router = Router();

// GET /api/v1/antojados/geo/scopes
router.get('/geo/scopes', (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || 100, 10)));
  send(res, svc.listScopes({
    scope_level: req.query.scope_level || null,
    parent_scope_code: req.query.parent_scope_code || null,
    q: req.query.q || null,
    limit,
  }).then(data => ({ data, limit })));
});

// GET /api/v1/antojados/geo/cities/search
router.get('/geo/cities/search', (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || 50, 10)));
  send(res, svc.searchCities({
    q: req.query.q || null,
    limit,
  }).then(data => ({ data, limit })));
});

// GET /api/v1/antojados/geo/resolve
router.get('/geo/resolve', (req, res) => {
  send(res, svc.resolveBarContext({
    lat: req.query.lat,
    lng: req.query.lng,
  }));
});

// POST /api/v1/antojados/geo/resolve
router.post('/geo/resolve', (req, res) => {
  send(res, svc.resolveBarContext({
    lat: req.body?.lat,
    lng: req.body?.lng,
  }));
});

module.exports = router;

