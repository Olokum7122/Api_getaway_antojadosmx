'use strict';
// App-facing — solo lectura de templates de ubicación.
// Consumido por la app móvil para: inicializar cascada de usuario, mostrar template por defecto.
// Sin endpoints de rebuild ni PATCH (exclusivos del GT Panel).
const { Router } = require('express');
const svc        = require('../../../services/antojados/gt-templates.service');
const { send }   = require('./_helpers');

const router = Router();

// ─── GET /templates ──────────────────────────────────────────────────────────
// Lista resumen de templates disponibles.
// Query: ?scope_type=user|sponsor
router.get('/templates', (req, res) => {
  send(res, svc.listTemplates({
    scopeType: req.query.scope_type ?? null,
  }));
});

// ─── GET /templates/:code ────────────────────────────────────────────────────
// Template completo: dimension_locations + sub_dimension_locations (activos).
// Query: ?scope_type=user|sponsor  (requerido si el code tiene varios scope_type)
router.get('/templates/:code', (req, res) => {
  send(res, svc.getTemplate(req.params.code, {
    scopeType: req.query.scope_type ?? null,
  }));
});

module.exports = router;
