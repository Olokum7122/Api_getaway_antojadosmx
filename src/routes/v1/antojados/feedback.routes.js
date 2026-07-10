'use strict';
/**
 * feedback.routes.js — Rutas de Feedback de Usuarios
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Feedback / Opiniones (web_launch_feedback)
 * RESPONSABLE:  Exponer endpoints REST para recibir feedback de usuarios,
 *               agregar información de contacto y consultar (protegido).
 *
 * ENDPOINTS:
 *   POST  /feedback               → crear feedback
 *   PATCH /feedback/:id/contact   → agregar datos de contacto
 *   GET   /feedback               → listar feedback (requiere admin token)
 *
 * REFERENCIAS:
 *   - feedback.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/feedback.service');
const { send } = require('./_helpers');

const router = Router();

// POST /api/v1/antojados/feedback
router.post('/feedback', (req, res) => {
  const meta = {
    ip: req.ip,
    forwarded_for: req.get('x-forwarded-for'),
    user_agent: req.get('user-agent'),
  };

  send(res, svc.createFeedback(req.body, meta), 201);
});

// PATCH /api/v1/antojados/feedback/:id/contact
router.patch('/feedback/:id/contact', (req, res) => {
  send(res, svc.addFeedbackContact(req.params.id, req.body));
});

// GET /api/v1/antojados/feedback
// Protegido con FEEDBACK_ADMIN_TOKEN para no exponer datos de contacto publicamente.
router.get('/feedback', (req, res) => {
  const expected = process.env.FEEDBACK_ADMIN_TOKEN;
  const received = req.get('x-admin-token') || req.query.admin_token;

  if (!expected || received !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  send(res, svc.listFeedback(req.query));
});

module.exports = router;
