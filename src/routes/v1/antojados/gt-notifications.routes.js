'use strict';
const { Router } = require('express');
const svc = require('../../../services/antojados/gt-notifications.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// GET /api/v1/antojados/gt/instancias/:instance_id/notifications
router.get('/gt/instancias/:instance_id/notifications', (req, res) => {
  const { status } = req.query;
  const { page, limit, offset } = parsePage(req.query);
  send(
    res,
    svc.resolveTenantIdByInstance(req.params.instance_id)
      .then((sponsorBizId) => {
        if (!sponsorBizId) {
          const err = new Error('No existe instancia sponsor para instance_id');
          err.status = 404;
          throw err;
        }
        return svc.getNotifications(sponsorBizId, { status, limit, offset });
      })
      .then(data => ({ data, page, limit })),
  );
});

// POST /api/v1/antojados/gt/instancias/:instance_id/notifications
// Body: { notification_type, title, message, cta_label?, cta_deeplink?, ... }
router.post('/gt/instancias/:instance_id/notifications', (req, res) => {
  const { notification_type, title, message } = req.body;
  if (!notification_type) return res.status(400).json({ error: 'notification_type es requerido' });
  if (!title)             return res.status(400).json({ error: 'title es requerido' });
  if (!message)           return res.status(400).json({ error: 'message es requerido' });
  const validTypes = ['tutorial', 'action_required', 'payment_alert',
                      'contract_alert', 'operational', 'info'];
  if (!validTypes.includes(notification_type))
    return res.status(400).json({ error: `notification_type inválido: ${validTypes.join(', ')}` });
  send(
    res,
    svc.resolveTenantIdByInstance(req.params.instance_id)
      .then((sponsorBizId) => {
        if (!sponsorBizId) {
          const err = new Error('No existe instancia sponsor para instance_id');
          err.status = 404;
          throw err;
        }
        return svc.createNotification(sponsorBizId, req.body);
      }),
    201,
  );
});

// App-facing — sponsor inbox (consumido desde la app)
// GET /api/v1/antojados/notifications?instance_id=&status=
router.get('/notifications', (req, res) => {
  const { instance_id, status } = req.query;
  if (!instance_id) return res.status(400).json({ error: 'instance_id es requerido' });
  const { page, limit, offset } = parsePage(req.query);
  send(
    res,
    svc.resolveTenantIdByInstance(instance_id)
      .then((sponsorBizId) => {
        if (!sponsorBizId) {
          const err = new Error('No existe instancia sponsor para el instance_id proporcionado');
          err.status = 404;
          throw err;
        }
        return svc.getNotifications(sponsorBizId, { status, limit, offset });
      })
      .then(data => ({ data, page, limit })),
  );
});

// ─── Sequences ────────────────────────────────────────────────────────────────

// GET /api/v1/antojados/gt/notification-sequences
router.get('/gt/notification-sequences', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.listSequences({ limit, offset }).then(data => ({ data, page, limit })));
});

// POST /api/v1/antojados/gt/notification-sequences
// Body: { name, description?, trigger_event, steps_json, created_by? }
router.post('/gt/notification-sequences', (req, res) => {
  const { name, trigger_event, steps_json } = req.body;
  if (!name)          return res.status(400).json({ error: 'name es requerido' });
  if (!trigger_event) return res.status(400).json({ error: 'trigger_event es requerido' });
  if (!steps_json)    return res.status(400).json({ error: 'steps_json es requerido' });
  const validTriggers = ['manual', 'activation', 'trial_day_N', 'payment_overdue'];
  if (!validTriggers.includes(trigger_event))
    return res.status(400).json({ error: `trigger_event inválido: ${validTriggers.join(', ')}` });
  send(res, svc.createSequence(req.body), 201);
});

// PATCH /api/v1/antojados/notifications/:id/read  (app-facing — tenant marca leída)
router.patch('/notifications/:id/read', (req, res) => {
  send(res, svc.markNotificationRead(req.params.id));
});

// POST /api/v1/antojados/gt/notification-sequences/:id/assign
// Body: { instance_id, assigned_by? }
router.post('/gt/notification-sequences/:id/assign', (req, res) => {
  const { instance_id, assigned_by } = req.body;
  if (!instance_id) return res.status(400).json({ error: 'instance_id es requerido' });
  send(res, svc.assignSequence(req.params.id, instance_id, assigned_by), 201);
});

module.exports = router;
