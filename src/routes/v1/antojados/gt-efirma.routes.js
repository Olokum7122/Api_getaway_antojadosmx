'use strict';

const { Router } = require('express');
const svc = require('../../../services/antojados/gt-efirma.service');
const { send } = require('./_helpers');

const router = Router();

function requireField(res, value, fieldName) {
  if (String(value || '').trim()) return true;
  res.status(400).json({ error: `${fieldName} es requerido` });
  return false;
}

// POST /api/v1/antojados/gt/efirma/create
router.post('/gt/efirma/create', (req, res) => {
  if (!requireField(res, req.body?.instance_id, 'instance_id')) return;
  if (!requireField(res, req.body?.representative_tenant_user_id, 'representative_tenant_user_id')) return;
  send(res, svc.createElectronicSignature(req.body, req.headers));
});

// POST /api/v1/antojados/gt/efirma/send-activation
router.post('/gt/efirma/send-activation', (req, res) => {
  if (!requireField(res, req.body?.instance_id, 'instance_id')) return;
  if (!requireField(res, req.body?.actor_tenant_user_id, 'actor_tenant_user_id')) return;
  send(res, svc.sendElectronicSignatureActivation(req.body, req.headers));
});

// POST /api/v1/antojados/gt/efirma/accept-activation
router.post('/gt/efirma/accept-activation', (req, res) => {
  if (!requireField(res, req.body?.instance_id, 'instance_id')) return;
  if (!requireField(res, req.body?.activation_id, 'activation_id')) return;
  if (!requireField(res, req.body?.actor_tenant_user_id, 'actor_tenant_user_id')) return;
  if (typeof req.body?.credential_validated !== 'boolean') {
    return res.status(400).json({ error: 'credential_validated (boolean) es requerido' });
  }
  send(res, svc.acceptElectronicSignatureActivation(req.body, req.headers));
});

// POST /api/v1/antojados/gt/efirma/authorize-action
router.post('/gt/efirma/authorize-action', (req, res) => {
  if (!requireField(res, req.body?.instance_id, 'instance_id')) return;
  if (!requireField(res, req.body?.requested_by_tenant_user_id, 'requested_by_tenant_user_id')) return;
  if (!requireField(res, req.body?.action_code, 'action_code')) return;
  if (!requireField(res, req.body?.resource_type, 'resource_type')) return;
  if (!requireField(res, req.body?.resource_id, 'resource_id')) return;
  if (typeof req.body?.credential_validated !== 'boolean') {
    return res.status(400).json({ error: 'credential_validated (boolean) es requerido' });
  }
  send(res, svc.authorizeElectronicSignatureAction(req.body, req.headers));
});

// GET /api/v1/antojados/gt/efirma/status?instance_id=
router.get('/gt/efirma/status', (req, res) => {
  const instanceId = String(req.query.instance_id || '').trim();
  if (!instanceId) {
    return res.status(400).json({ error: 'instance_id es requerido' });
  }
  send(res, svc.getElectronicSignatureStatus(instanceId, req.headers));
});

module.exports = router;
