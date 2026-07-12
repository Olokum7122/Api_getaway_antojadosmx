'use strict';
const { Router }     = require('express');
const svc            = require('../../../services/antojados/gt-templates.service');
const { send }       = require('./_helpers');
const { SCOPE_TYPE } = require('../../../constants/instancias');

const router = Router();

// ─── GET /gt/templates ───────────────────────────────────────────────────────
// Lista resumen de todos los templates disponibles.
// Query: ?scope_type=user|sponsor
router.get('/gt/templates', (req, res) => {
  send(res, svc.listTemplates({
    scopeType: req.query.scope_type ?? null,
  }));
});

// ─── GET /gt/templates/:code ─────────────────────────────────────────────────
// Template completo: dimension_locations + sub_dimension_locations.
// Query: ?scope_type=user|sponsor  (requerido si hay varios scope_type para ese code)
router.get('/gt/templates/:code', (req, res) => {
  send(res, svc.getTemplate(req.params.code, {
    scopeType: req.query.scope_type ?? null,
  }));
});

// ─── POST /gt/templates/:code/rebuild ────────────────────────────────────────
// Rebuild template desde canonico aprobado.
// Body: { scope_type: 'user'|'sponsor' }
router.post('/gt/templates/:code/rebuild', (req, res) => {
  const { scope_type } = req.body;
  if (!scope_type) {
    return res.status(400).json({ error: 'scope_type es requerido' });
  }
  if (!Object.values(SCOPE_TYPE).includes(scope_type)) {
    return res.status(400).json({ error: `scope_type inválido. Valores: ${Object.values(SCOPE_TYPE).join(', ')}` });
  }
  send(res, svc.rebuildTemplate(req.params.code, { scopeType: scope_type }));
});

// ─── PATCH /gt/templates/:code/locations/:location_id ────────────────────────
// Ajuste manual GT sobre un nodo dimension de la plantilla.
// Body: { visible?, enabled?, sort_order? }
router.patch('/gt/templates/:code/locations/:location_id', (req, res) => {
  const { visible, enabled, sort_order } = req.body;
  if (visible === undefined && enabled === undefined && sort_order === undefined) {
    return res.status(400).json({ error: 'Se requiere al menos un campo: visible, enabled, sort_order' });
  }
  send(res, svc.updateTemplateLocation(req.params.location_id, {
    visible:   visible   !== undefined ? (visible   ? 1 : 0) : null,
    enabled:   enabled   !== undefined ? (enabled   ? 1 : 0) : null,
    sortOrder: sort_order !== undefined ? parseInt(sort_order, 10) : null,
  }));
});

// ─── PATCH /gt/templates/:code/sub-locations/:sub_location_id ────────────────
// Ajuste manual GT sobre un nodo sub_dimension de la plantilla.
// Body: { enabled?, sort_order? }
router.patch('/gt/templates/:code/sub-locations/:sub_location_id', (req, res) => {
  const { enabled, sort_order } = req.body;
  if (enabled === undefined && sort_order === undefined) {
    return res.status(400).json({ error: 'Se requiere al menos un campo: enabled, sort_order' });
  }
  send(res, svc.updateTemplateSubLocation(req.params.sub_location_id, {
    enabled:   enabled    !== undefined ? (enabled ? 1 : 0) : null,
    sortOrder: sort_order !== undefined ? parseInt(sort_order, 10) : null,
  }));
});

module.exports = router;
