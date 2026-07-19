'use strict';

const { Router } = require('express');
const svc = require('../../../services/antojados/gt-templates.service');
const { send } = require('./_helpers');

const router = Router();

function boolParam(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return value === true || value === '1' || value === 'true';
}

// GET /api/v1/antojados/gt/templates?scope_type=user|sponsor
router.get('/gt/templates', (req, res) => {
  send(res, svc.listTemplates({ scopeType: req.query.scope_type }));
});

// GET /api/v1/antojados/gt/templates/:code?scope_type=user|sponsor
router.get('/gt/templates/:code', (req, res) => {
  send(res, svc.getTemplate(req.params.code, { scopeType: req.query.scope_type }));
});

// POST /api/v1/antojados/gt/templates/:code/rebuild
router.post('/gt/templates/:code/rebuild', (req, res) => {
  const scopeType = req.body?.scope_type || req.query.scope_type;
  if (!scopeType) return res.status(400).json({ error: 'scope_type es requerido' });
  send(res, svc.rebuildTemplate(req.params.code, { scopeType }));
});

// PATCH /api/v1/antojados/gt/templates/locations/:template_location_id
router.patch('/gt/templates/locations/:template_location_id', (req, res) => {
  send(res, svc.updateTemplateLocation(req.params.template_location_id, {
    visible: boolParam(req.body?.visible),
    enabled: boolParam(req.body?.enabled),
    sortOrder: req.body?.sort_order,
  }));
});

// PATCH /api/v1/antojados/gt/templates/sub-locations/:template_sub_location_id
router.patch('/gt/templates/sub-locations/:template_sub_location_id', (req, res) => {
  send(res, svc.updateTemplateSubLocation(req.params.template_sub_location_id, {
    enabled: boolParam(req.body?.enabled),
    sortOrder: req.body?.sort_order,
  }));
});

module.exports = router;