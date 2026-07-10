'use strict';
const { Router } = require('express');
const svc = require('../../../services/antojados/gt-ops.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// ─── Settings ─────────────────────────────────────────────────────────────────

// GET /api/v1/antojados/gt/settings
router.get('/gt/settings', (req, res) => {
  send(res, svc.getSettings());
});

// PATCH /api/v1/antojados/gt/settings/:key
// Body: { value, updated_by? }
router.patch('/gt/settings/:key', (req, res) => {
  const { value, updated_by } = req.body;
  if (value === undefined || value === null)
    return res.status(400).json({ error: 'value es requerido' });
  send(res, svc.updateSetting(req.params.key, { value: String(value), updated_by }));
});

// ─── Audit log ────────────────────────────────────────────────────────────────

// GET /api/v1/antojados/gt/audit
// Query: entity_type?, entity_id?, operator_id?
router.get('/gt/audit', (req, res) => {
  const { entity_type, entity_id, operator_id } = req.query;
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.getAuditLog({ entity_type, entity_id, operator_id, limit, offset })
    .then(data => ({ data, page, limit })));
});

// GET /api/v1/antojados/gt/tenants/:id/audit
router.get('/gt/tenants/:id/audit', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.getAuditLog({ entity_type: 'biz_tenant', entity_id: req.params.id, limit, offset })
    .then(data => ({ data, page, limit })));
});

// ─── Suspensions ──────────────────────────────────────────────────────────────

// GET /api/v1/antojados/gt/tenants/:id/suspensions
router.get('/gt/tenants/:id/suspensions', (req, res) => {
  const { status } = req.query;
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.getTenantSuspensions(req.params.id, { status, limit, offset })
    .then(data => ({ data, page, limit })));
});

// ─── Economic snapshot ────────────────────────────────────────────────────────

// GET /api/v1/antojados/gt/tenants/:id/economic-snapshot
router.get('/gt/tenants/:id/economic-snapshot', (req, res) => {
  const { period_type } = req.query;
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.getEconomicSnapshot(req.params.id, { period_type, limit, offset })
    .then(data => ({ data, page, limit })));
});

// POST /api/v1/antojados/gt/tenants/:id/economic-snapshot/sync
// Corp webhook — upsert snapshot via X-Corp-Api-Key
// Body: { snapshot_date, period_type?, revenue_total?, revenue_tiles?, ... }
router.post('/gt/tenants/:id/economic-snapshot/sync', (req, res) => {
  const { snapshot_date } = req.body;
  if (!snapshot_date) return res.status(400).json({ error: 'snapshot_date es requerido' });
  send(res, svc.syncEconomicSnapshot(req.params.id, req.body), 200);
});

// POST /api/v1/antojados/gt/tenants/:id/economic-event
// Corp → GT: evento económico. Requiere X-Corp-Api-Key.
// Body: { event, plan?, amount?, due_date?, cta_payment_url?, days_remaining?,
//         placement_code?, quota_total?, remaining?, initiated_by? }
router.post('/gt/tenants/:id/economic-event', (req, res) => {
  const corpKey = process.env.CORP_API_KEY || '';
  if (!corpKey || req.headers['x-corp-api-key'] !== corpKey) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  const { event } = req.body || {};
  if (!event) return res.status(400).json({ error: 'event es requerido' });
  send(res, svc.processEconomicEvent(req.params.id, req.body), 201);
});

// ─── Packages ─────────────────────────────────────────────────────────────────

// GET /api/v1/antojados/gt/tenants/:id/packages
router.get('/gt/tenants/:id/packages', (req, res) => {
  send(res, svc.getTenantPackages(req.params.id));
});

// POST /api/v1/antojados/gt/tenants/:id/packages/:code
// Body: { status, enabled_by? }
router.post('/gt/tenants/:id/packages/:code', (req, res) => {
  const { status, enabled_by } = req.body;
  if (!status) return res.status(400).json({ error: 'status es requerido' });
  const validStatuses = ['active', 'suspended', 'cancelled'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: `status inválido: ${validStatuses.join(', ')}` });
  send(res, svc.upsertTenantPackage(req.params.id, req.params.code, { status, enabled_by }));
});

module.exports = router;
