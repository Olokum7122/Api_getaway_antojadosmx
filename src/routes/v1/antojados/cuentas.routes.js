'use strict';
/**
 * cuentas.routes.js — Rutas Propietarias de Cuentas / Tenants
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Cuentas de Negocio (Tenants)
 * RESPONSABLE:  Exponer endpoints REST para consulta de tenants y cuentas
 *               sponsor registradas.
 *
 * SUSTITUYE:
 *   - gt-tenants.routes.js   → /cuentas/tenants/*
 *
 * @see CONTRATO_API_OPERACIONES_V1.md §14 — Namespaces Propietarios
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/gt-tenants.service');
const { send } = require('./_helpers');

const router = Router();

// GET /api/v1/antojados/cuentas/tenants
router.get('/cuentas/tenants', (req, res) => {
  const { limit, offset } = req.query;
  send(res, svc.listTenants({ limit: Number(limit) || 50, offset: Number(offset) || 0 }));
});

// GET /api/v1/antojados/cuentas/tenants/:tenant_id
router.get('/cuentas/tenants/:tenant_id', (req, res) => {
  send(res, svc.getTenantDetail(req.params.tenant_id));
});

module.exports = router;
