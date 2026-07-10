'use strict';
const { Router }                    = require('express');
const svc                           = require('../../../services/antojados/gt-cascades.service');
const { send }                      = require('./_helpers');
const { SCOPE_TYPE }                = require('../../../constants/instancias');

const router = Router();

router.get('/gt/instances', (req, res) => {
  send(res, svc.listInstances({
    instanceType: req.query.instance_type ?? null,
    sponsorBizId: req.query.sponsor_biz_id ?? null,
    cuentaId:     req.query.cuenta_id     ?? null,
    status:       req.query.status        ?? null,
  }));
});

router.get('/gt/instances/:id', (req, res) => {
  send(res, svc.getInstance(req.params.id));
});

router.get('/gt/instances/:id/cascade', (req, res) => {
  send(res, svc.getInstanceCascade(req.params.id));
});

router.get('/gt/sponsors/:id/cascade', (req, res) => {
  send(res, svc.getSponsorCascade(req.params.id));
});

// Backward-compatible alias. Prefer /gt/sponsors/:id/cascade.
router.get('/gt/tenants/:id/cascade', (req, res) => {
  send(res, svc.getSponsorCascade(req.params.id));
});

router.get('/gt/users/:id/cascade', (req, res) => {
  send(res, svc.getUserCascade(req.params.id));
});

router.get('/gt/reusable-cascades', (req, res) => {
  send(res, svc.listReusableCascades({ scopeType: req.query.scope_type ?? null }));
});

router.get('/gt/reusable-cascades/:code', (req, res) => {
  send(res, svc.getReusableCascade(req.params.code, { scopeType: req.query.scope_type ?? null }));
});

router.post('/gt/instances/:id/rebuild-cascade', (req, res) => {
  send(res, svc.rebuildInstanceCascade(req.params.id));
});

router.post('/gt/reusable-cascades/:code/rebuild', (req, res) => {
  const { scope_type, root_label } = req.body;
  if (!scope_type) {
    return res.status(400).json({ error: 'scope_type es requerido' });
  }
  if (!Object.values(SCOPE_TYPE).includes(scope_type)) {
    return res.status(400).json({ error: `scope_type inválido: ${Object.values(SCOPE_TYPE).join(', ')}` });
  }
  send(res, svc.rebuildReusableCascade(req.params.code, {
    scopeType: scope_type,
    rootLabel: root_label ?? null,
  }));
});

module.exports = router;