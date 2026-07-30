'use strict';
/**
 * dimensiones.routes.js — Rutas Propietarias de Dimensiones / Catálogo / Scanner
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Catálogo de Dimensiones de Apps
 * RESPONSABLE:  Exponer endpoints REST para configuración de dimensiones,
 *               sub-dimensiones, scanner, templates y locations checked.
 *
 * SUSTITUYE:
 *   - gt-dimensions.routes.js   → /dimensiones/catalog/ + /dimensiones/scanner/
 *   - gt-templates.routes.js    → /dimensiones/templates/
 *   - gt-checked.routes.js      → /dimensiones/checked/
 *
 * @see CONTRATO_API_OPERACIONES_V1.md §14 — Namespaces Propietarios
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const dimSvc = require('../../../services/antojados/gt-dimensions.service');
const tmplSvc = require('../../../services/antojados/gt-templates.service');
const cascadeSvc = require('../../../services/antojados/gt-cascades.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// ─── Helpers para Checked ──────────────────────────────────────────────
function checkedFlag(row) {
  return row?.visible === true || row?.enabled === true;
}

function mapCheckedDimension(row) {
  const checked = checkedFlag(row);
  return {
    ...row,
    is_checked: checked,
    visible_override: row.visible,
    enabled_override: row.enabled,
    effective_visible: row.visible,
    effective_enabled: row.enabled,
    control_mode: 'OPERABLE',
  };
}

function mapCheckedSubDimension(row) {
  const checked = checkedFlag(row);
  return {
    ...row,
    is_checked: checked,
    visible_override: row.visible,
    enabled_override: row.enabled,
    effective_visible: row.visible,
    effective_enabled: row.enabled,
    control_mode: 'OPERABLE',
  };
}

// ══════════════════════════════════════════════════════════════════════════
// DIMENSIONES — Catálogo
// ══════════════════════════════════════════════════════════════════════════

// GET /api/v1/antojados/dimensiones/catalog
router.get('/dimensiones/catalog', (req, res) => {
  const { page, limit } = parsePage(req.query);
  send(res, dimSvc.listDimensions({ ...req.query, limit, page }));
});

// GET /api/v1/antojados/dimensiones/catalog/sub
router.get('/dimensiones/catalog/sub', (req, res) => {
  const { page, limit } = parsePage(req.query);
  send(res, dimSvc.listSubDimensions({ ...req.query, limit, page }));
});

// POST /api/v1/antojados/dimensiones/catalog/batch-approve
router.post('/dimensiones/catalog/batch-approve', (req, res) => {
  send(res, dimSvc.batchApprove(req.body));
});

// POST /api/v1/antojados/dimensiones/catalog/sub/batch-approve
router.post('/dimensiones/catalog/sub/batch-approve', (req, res) => {
  send(res, dimSvc.batchApproveSub(req.body));
});

// PATCH /api/v1/antojados/dimensiones/catalog/:code/status
router.patch('/dimensiones/catalog/:code/status', (req, res) => {
  send(res, dimSvc.updateDimensionStatus(req.params.code, req.body));
});

// PATCH /api/v1/antojados/dimensiones/catalog/sub/:code/status
router.patch('/dimensiones/catalog/sub/:code/status', (req, res) => {
  send(res, dimSvc.updateSubDimensionStatus(req.params.code, req.body));
});

// POST /api/v1/antojados/dimensiones/catalog/purge
router.post('/dimensiones/catalog/purge', (req, res) => {
  send(res, dimSvc.purgeCatalog());
});

// ══════════════════════════════════════════════════════════════════════════
// SCANNER
// ══════════════════════════════════════════════════════════════════════════

// POST /api/v1/antojados/dimensiones/scanner/snapshot
router.post('/dimensiones/scanner/snapshot', (req, res) => {
  send(res, dimSvc.createSnapshot(req.body));
});

// POST /api/v1/antojados/dimensiones/scanner/save
router.post('/dimensiones/scanner/save', (req, res) => {
  send(res, dimSvc.persistScannerSelection(req.body));
});

// ══════════════════════════════════════════════════════════════════════════
// TEMPLATES
// ══════════════════════════════════════════════════════════════════════════

// GET /api/v1/antojados/dimensiones/templates
router.get('/dimensiones/templates', (req, res) => {
  const { scope_type, show_inactive } = req.query;
  send(res, tmplSvc.listTemplates({ scope_type, show_inactive }));
});

// POST /api/v1/antojados/dimensiones/templates/:code/rebuild
router.post('/dimensiones/templates/:code/rebuild', (req, res) => {
  const scopeType = req.query.scope_type || req.body?.scope_type || 'all';
  send(res, tmplSvc.rebuildTemplate(req.params.code, { scopeType }));
});

// ══════════════════════════════════════════════════════════════════════════
// CHECKED (Locations materializadas por instancia)
// ══════════════════════════════════════════════════════════════════════════

// GET /api/v1/antojados/dimensiones/checked/instances/:instance_id/dimensions
router.get('/dimensiones/checked/instances/:instance_id/dimensions', (req, res) => {
  send(res, cascadeSvc.getInstanceCascade(req.params.instance_id).then((cascade) => {
    if (!cascade) return null;
    return {
      instance: cascade.instance,
      instance_type: cascade.instance.instance_type,
      dimension_locations: cascade.dimension_locations.map(mapCheckedDimension),
    };
  }));
});

// GET /api/v1/antojados/dimensiones/checked/instances/:instance_id/sub-dimensions
router.get('/dimensiones/checked/instances/:instance_id/sub-dimensions', (req, res) => {
  send(res, cascadeSvc.getInstanceCascade(req.params.instance_id).then((cascade) => {
    if (!cascade) return null;
    return {
      instance: cascade.instance,
      instance_type: cascade.instance.instance_type,
      sub_dimension_locations: cascade.sub_dimension_locations.map(mapCheckedSubDimension),
    };
  }));
});

// PUT /api/v1/antojados/dimensiones/checked/instances/:instance_id/dimensions
router.put('/dimensiones/checked/instances/:instance_id/dimensions', (req, res) => {
  send(res, cascadeSvc.rebuildInstanceCascade(req.params.instance_id, req.body));
});

module.exports = router;
