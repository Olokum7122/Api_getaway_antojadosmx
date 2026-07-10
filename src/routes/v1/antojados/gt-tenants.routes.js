'use strict';
const { Router } = require('express');
const svc = require('../../../services/antojados/gt-tenants.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// ─── Tenants ──────────────────────────────────────────────────────────────────

// GET /api/v1/antojados/gt/tenants
router.get('/gt/tenants', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.listTenants({ limit, offset }).then(data => ({ data, page, limit })));
});

// GET /api/v1/antojados/gt/tenants/:id
router.get('/gt/tenants/:id', (req, res) => {
  send(res, svc.getTenant(req.params.id));
});

// POST /api/v1/antojados/gt/tenants/:id/activate
// Body: { operator_id }
router.post('/gt/tenants/:id/activate', (req, res) => {
  const { operator_id } = req.body;
  if (!operator_id) return res.status(400).json({ error: 'operator_id es requerido' });
  send(res, svc.activateTenant(req.params.id, operator_id));
});

// POST /api/v1/antojados/gt/tenants/:id/suspend
// Body: { reason, initiated_by, suspension_type?, planned_end_at? }
router.post('/gt/tenants/:id/suspend', (req, res) => {
  const { reason, initiated_by, suspension_type, planned_end_at } = req.body;
  if (!reason)       return res.status(400).json({ error: 'reason es requerido' });
  if (!initiated_by) return res.status(400).json({ error: 'initiated_by es requerido' });
  const validTypes = ['economic_suspension', 'manual_suspension', 'moderation_suspension',
                      'security_suspension', 'temporary_pause'];
  if (suspension_type && !validTypes.includes(suspension_type))
    return res.status(400).json({ error: `suspension_type inválido: ${validTypes.join(', ')}` });
  send(res, svc.suspendTenant(req.params.id, { reason, initiated_by, suspension_type, planned_end_at }), 201);
});

// POST /api/v1/antojados/gt/tenants/:id/reactivate
// Body: { operator_id }
router.post('/gt/tenants/:id/reactivate', (req, res) => {
  const { operator_id } = req.body;
  if (!operator_id) return res.status(400).json({ error: 'operator_id es requerido' });
  send(res, svc.reactivateTenant(req.params.id, operator_id));
});

// ─── Expediente Sponsor (GT Review) ───────────────────────────────────────────

// GET /api/v1/antojados/gt/tenants/:id/expediente?review_status=&page=&limit=
router.get('/gt/tenants/:id/expediente', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  const review_status = req.query.review_status || null;
  send(res, svc.listTenantExpediente(req.params.id, { review_status, limit, offset }).then(data => ({ data, page, limit })));
});

// POST /api/v1/antojados/gt/tenants/:id/expediente/:doc_id/review
// Body: { review_status: 'approved'|'rejected', reviewed_by, review_notes? }
router.post('/gt/tenants/:id/expediente/:doc_id/review', (req, res) => {
  const { review_status, reviewed_by, review_notes } = req.body;
  if (!review_status) return res.status(400).json({ error: 'review_status es requerido' });
  if (!reviewed_by) return res.status(400).json({ error: 'reviewed_by es requerido' });
  const validStatus = ['approved', 'rejected'];
  if (!validStatus.includes(String(review_status).toLowerCase())) {
    return res.status(400).json({ error: `review_status invalido: ${validStatus.join(', ')}` });
  }
  send(res, svc.reviewTenantExpedienteDocument(req.params.id, req.params.doc_id, {
    review_status,
    reviewed_by,
    review_notes,
  }));
});

module.exports = router;
