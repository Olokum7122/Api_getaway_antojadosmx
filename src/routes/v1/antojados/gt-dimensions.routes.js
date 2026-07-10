'use strict';
const { Router } = require('express');
const svc = require('../../../services/antojados/gt-dimensions.service');
const { send } = require('./_helpers');

const router = Router();

// GET /api/v1/antojados/gt/dimensions?review_status=&applies_to=&is_active=
router.get('/gt/dimensions', (req, res) => {
  send(
    res,
    svc.listDimensions({
      reviewStatus: req.query.review_status || req.query.status,
      appliesTo: req.query.applies_to,
      isActive:
        req.query.is_active === undefined ? undefined : req.query.is_active === '1' || req.query.is_active === 'true',
    }),
  );
});

// GET /api/v1/antojados/gt/sub-dimensions?parent_dimension_id=&parent_code=&review_status=&applies_to=&is_active=
router.get('/gt/sub-dimensions', (req, res) => {
  send(
    res,
    svc.listSubDimensions({
      parentDimensionId: req.query.parent_dimension_id,
      parentCode: req.query.parent_code,
      reviewStatus: req.query.review_status || req.query.status,
      appliesTo: req.query.applies_to,
      isActive:
        req.query.is_active === undefined ? undefined : req.query.is_active === '1' || req.query.is_active === 'true',
    }),
  );
});

// POST /api/v1/antojados/gt/dimensions/batch-approve
// Body: { codes: string[] }
router.post('/gt/dimensions/batch-approve', (req, res) => {
  const { codes } = req.body;
  if (!Array.isArray(codes) || codes.length === 0)
    return res.status(400).json({ error: 'codes debe ser un array no vacío' });
  send(res, svc.batchApproveDimensions(codes));
});

// POST /api/v1/antojados/gt/sub-dimensions/batch-approve
// Body: { codes: string[] }
router.post('/gt/sub-dimensions/batch-approve', (req, res) => {
  const { codes } = req.body;
  if (!Array.isArray(codes) || codes.length === 0)
    return res.status(400).json({ error: 'codes debe ser un array no vacío' });
  send(res, svc.batchApproveSubDimensions(codes));
});

// PATCH /api/v1/antojados/gt/dimensions/:code/status
// Body: { status: 'APPROVED' | 'DEACTIVATED' | 'PENDING_REVIEW' | 'ACTIVE' | 'INACTIVE' }
router.patch('/gt/dimensions/:code/status', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status es requerido' });
  send(res, svc.updateDimensionStatus(req.params.code, status));
});

// PATCH /api/v1/antojados/gt/sub-dimensions/:code/status
router.patch('/gt/sub-dimensions/:code/status', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status es requerido' });
  send(res, svc.updateSubDimensionStatus(req.params.code, status));
});

// DELETE /api/v1/antojados/gt/dimensions/:code
router.delete('/gt/dimensions/:code', (req, res) => {
  send(res, svc.deleteDimension(req.params.code));
});

// DELETE /api/v1/antojados/gt/sub-dimensions/:code
router.delete('/gt/sub-dimensions/:code', (req, res) => {
  send(res, svc.deleteSubDimension(req.params.code));
});

// POST /api/v1/antojados/gt/scanner/snapshot
// Ejecuta scanner leyendo metadata ik/pc y subdim-* directamente del codigo Vue.
// Flujo estricto: solo snapshot (sin persistencia).
router.post('/gt/scanner/snapshot', (req, res) => {
  send(
    res,
    svc.runScannerFromSource({
      ...(req.body || {}),
      snapshot_only: true,
    }),
  );
});

// POST /api/v1/antojados/gt/scanner/save
// Persistencia explicita solo desde accion Guardar (seleccion aprobada).
router.post('/gt/scanner/save', (req, res) => {
  send(res, svc.persistScannerSelectionFromSource(req.body || {}));
});

// POST /api/v1/antojados/gt/catalog/purge
// Purga completa de sys_dimension y sys_sub_dimension.
router.post('/gt/catalog/purge', (req, res) => {
  send(res, svc.purgeCatalog());
});

module.exports = router;
