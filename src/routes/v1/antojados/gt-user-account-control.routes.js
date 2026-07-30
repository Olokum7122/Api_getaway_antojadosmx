'use strict';
const { Router } = require('express');
const svc = require('../../../services/antojados/gt-user-account-control.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// GET /api/v1/antojados/gt/user-account-control?control_status=&search=&page=&limit=
router.get('/gt/user-account-control', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.listUserAccountControl({
    control_status: req.query.control_status || null,
    search: req.query.search || null,
    limit,
    offset,
  }).then(data => ({ data, page, limit })));
});

// POST /api/v1/antojados/gt/user-account-control/expire
router.post('/gt/user-account-control/expire', (req, res) => {
  send(res, svc.expireUserAccountControl());
});

// GET /api/v1/antojados/gt/user-account-control/:user_id?instance_id=
router.get('/gt/user-account-control/:user_id', (req, res) => {
  send(res, svc.getUserAccountControl({
    user_id: req.params.user_id,
    instance_id: req.query.instance_id || null,
  }));
});

// POST /api/v1/antojados/gt/user-account-control/:user_id
router.post('/gt/user-account-control/:user_id', (req, res) => {
  send(res, svc.setUserAccountControl(req.params.user_id, req.body), 201);
});

module.exports = router;