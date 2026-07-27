'use strict';
/**
 * instancias.routes.js — Rutas de Instancias del Sistema
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Instancias del Sistema (sys_instancia)
 * RESPONSABLE:  Exponer endpoint REST para consulta de información
 *               de instancias de usuario o sponsor.
 *
 * ENDPOINTS:
 *   GET /instancias/me/info → obtener instance_id y status por user_id
 *
 * REFERENCIAS:
 *   - instancias.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/instancias.service');
const { send } = require('./_helpers');

const router = Router();

// GET /api/v1/antojados/instancias/me/info
// Query: user_id, instance_type (default 'user')
// Retorna instance_id y status de la instancia del usuario.
router.get('/instancias/me/info', (req, res) => {
  const { user_id, instance_type } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.getInstanceInfo({ user_id, instance_type }));
});

// POST /api/v1/antojados/instancias/:id/transitar
// Body: { status: string, actor_user_id?: string }
// Cambia el status de sys_instancia y dispara efectos secundarios.
router.post('/instancias/:id/transitar', (req, res) => {
  const { id } = req.params;
  const { status, actor_user_id } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status es requerido' });
  send(res, svc.transitarInstancia({ instance_id: id, status, actor_user_id }));
});

module.exports = router;
