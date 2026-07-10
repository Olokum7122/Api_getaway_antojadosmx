'use strict';
const { Router } = require('express');
const svc = require('../../../services/antojados/gt-tiles.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// GET /api/v1/antojados/gt/tiles/pending
router.get('/gt/tiles/pending', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.listPendingTiles({ limit, offset }).then(data => ({ data, page, limit })));
});

// GET /api/v1/antojados/gt/tenants/:id/tiles
router.get('/gt/tenants/:id/tiles', (req, res) => {
  const { status } = req.query;
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.getTenantTiles(req.params.id, { status, limit, offset })
    .then(data => ({ data, page, limit })));
});

// POST /api/v1/antojados/gt/tiles/:id/approve
// Body: { approved_by, quota_total?, campaign_name?, pacing_mode?, start_at?, end_at? }
router.post('/gt/tiles/:id/approve', (req, res) => {
  const { approved_by } = req.body;
  if (!approved_by) return res.status(400).json({ error: 'approved_by es requerido' });
  send(res, svc.approveTile(req.params.id, req.body));
});

// POST /api/v1/antojados/gt/tiles/:id/reject
// Body: { rejected_by, reason }
router.post('/gt/tiles/:id/reject', (req, res) => {
  const { rejected_by, reason } = req.body;
  if (!rejected_by) return res.status(400).json({ error: 'rejected_by es requerido' });
  if (!reason)      return res.status(400).json({ error: 'reason es requerido' });
  send(res, svc.rejectTile(req.params.id, { rejected_by, reason }));
});

// POST /api/v1/antojados/gt/tiles/:id/disable
// Body: { operator_id }
router.post('/gt/tiles/:id/disable', (req, res) => {
  const { operator_id } = req.body;
  if (!operator_id) return res.status(400).json({ error: 'operator_id es requerido' });
  send(res, svc.disableTile(req.params.id, operator_id));
});

module.exports = router;
