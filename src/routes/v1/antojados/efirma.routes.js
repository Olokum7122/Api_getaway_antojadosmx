'use strict';
/**
 * efirma.routes.js — Rutas Propietarias de E-Firma
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Ciclo de Firma Electrónica
 * RESPONSABLE:  Exponer endpoints REST para el ciclo completo de e-firma:
 *               creación, activación y autorización.
 *
 * SUSTITUYE:
 *   - gt-efirma.routes.js   → /efirma/*
 *
 * @see CONTRATO_API_OPERACIONES_V1.md §14 — Namespaces Propietarios
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/gt-efirma.service');
const { send } = require('./_helpers');

const router = Router();

// GET /api/v1/antojados/efirma/status?instance_id=
router.get('/efirma/status', (req, res) => {
  const { instance_id } = req.query;
  if (!instance_id) return res.status(400).json({ error: 'instance_id es requerido' });
  send(res, svc.getEfirmaStatus(instance_id));
});

// POST /api/v1/antojados/efirma/create
router.post('/efirma/create', (req, res) => {
  const { instance_id, representative_tenant_user_id } = req.body || {};
  if (!instance_id || !representative_tenant_user_id)
    return res.status(400).json({ error: 'instance_id y representative_tenant_user_id son requeridos' });
  send(res, svc.createElectronicSignature(instance_id, representative_tenant_user_id), 201);
});

// POST /api/v1/antojados/efirma/send-activation
router.post('/efirma/send-activation', (req, res) => {
  send(res, svc.sendActivation(req.body), 201);
});

module.exports = router;
