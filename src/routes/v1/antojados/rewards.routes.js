'use strict';
/**
 * rewards.routes.js — Rutas de Recompensas / Cupones
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Recompensas y Cupones (rwd_*)
 * RESPONSABLE:  Exponer endpoints REST para campañas de recompensas,
 *               elegibilidad, redención e historial de redenciones.
 *
 * ENDPOINTS:
 *   GET  /rewards/campaigns                   → listar campañas
 *   GET  /rewards/campaigns/:campaign_id      → detalle de campaña
 *   GET  /rewards/eligibility                 → elegibilidad por usuario
 *   POST /rewards/redeem                      → redimir recompensa
 *   GET  /rewards/redemptions/:user_id        → historial de redenciones
 *
 * REFERENCIAS:
 *   - rewards.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/rewards.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// GET /api/v1/antojados/rewards/campaigns
router.get('/rewards/campaigns', (req, res) => {
  send(res, svc.listCampaigns(req.query).then(data => ({ data, total: data.length })));
});

// GET /api/v1/antojados/rewards/campaigns/:campaign_id
router.get('/rewards/campaigns/:campaign_id', (req, res) => {
  send(res, svc.getCampaign(req.params.campaign_id));
});

// GET /api/v1/antojados/rewards/eligibility?user_id=
router.get('/rewards/eligibility', (req, res) => {
  if (!req.query.user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.listEligibility(req.query).then(data => ({ data, total: data.length })));
});

// POST /api/v1/antojados/rewards/redeem
router.post('/rewards/redeem', (req, res) => {
  const { campaign_id, user_id, post_id } = req.body;
  if (!campaign_id || !user_id || !post_id)
    return res.status(400).json({ error: 'campaign_id, user_id y post_id son requeridos' });
  send(res, svc.redeemReward(req.body), 201);
});

// GET /api/v1/antojados/rewards/redemptions/:user_id  (V2)
router.get('/rewards/redemptions/:user_id', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.listUserRedemptions({ user_id: req.params.user_id, limit, offset })
    .then(data => ({ data, page, limit })));
});

module.exports = router;
