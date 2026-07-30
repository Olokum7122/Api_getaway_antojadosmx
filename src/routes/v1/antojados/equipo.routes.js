'use strict';
/**
 * equipo.routes.js — Rutas de Equipo / Empleados (Biz Tenants)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Equipo de Negocio (biz_tenants)
 * RESPONSABLE:  Exponer endpoints REST para gestión de perfiles, usuarios,
 *               invitaciones, asignaciones y transferencias de equipo.
 *
 * ENDPOINTS:
 *   Equipo/Mi Tenant:
 *     GET    /equipo/mi-tenant          → tenant por user_id
 *     GET    /equipo/perfiles           → perfiles de tenant
 *
 *   Usuarios:
 *     GET    /equipo/usuarios           → listar usuarios
 *     PATCH  /equipo/usuarios/:id/perfil    → cambiar perfil
 *     PATCH  /equipo/usuarios/:id/revocar   → revocar usuario
 *     POST   /equipo/usuarios/transferir-admin → transferir admin
 *
 *   Invitaciones:
 *     GET    /equipo/invitaciones       → pendientes
 *     POST   /equipo/invitar            → crear invitación
 *     PATCH  /equipo/invitaciones/:id   → actualizar
 *     DELETE /equipo/invitaciones/:id   → eliminar
 *     GET    /equipo/invitacion/:code   → obtener por código
 *     POST   /equipo/redimir            → redimir invitación
 *
 *   Asignaciones:
 *     GET    /equipo/asignaciones/:id   → listar
 *     PUT    /equipo/asignaciones/:id   → reemplazar
 *     POST   /equipo/asignaciones/:id/seed → seed admin
 *
 * REFERENCIAS:
 *   - equipo.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/equipo.service');
const uacSvc = require('../../../services/antojados/gt-user-account-control.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// ─── Perfiles ────────────────────────────────────────────────────────────────

// GET /api/v1/antojados/equipo/mi-tenant?user_id=...
router.get('/equipo/mi-tenant', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  try {
    const data = await svc.getTenantByUserId(user_id);
    if (!data) return res.status(404).json({ error: 'not_found', message: 'No se encontró negocio vinculado a este usuario.' });
    res.json(data);
  } catch (e) {
    console.error('[equipo.routes] mi-tenant error', e);
    res.status(e.status || 500).json({ error: e.message });
  }
});

// GET /api/v1/antojados/equipo/perfiles?instance_id=...
router.get('/equipo/perfiles', (req, res) => {
  const { instance_id } = req.query;
  if (!instance_id) return res.status(400).json({ error: 'instance_id es requerido' });
  send(res, svc.listPerfiles(instance_id));
});

// ─── Usuarios ────────────────────────────────────────────────────────────────

// GET /api/v1/antojados/equipo/usuarios?instance_id=...
router.get('/equipo/usuarios', (req, res) => {
  const { instance_id } = req.query;
  if (!instance_id) return res.status(400).json({ error: 'instance_id es requerido' });
  send(res, svc.listUsuarios(instance_id));
});

// PATCH /api/v1/antojados/equipo/usuarios/:tenant_user_id/perfil
router.patch('/equipo/usuarios/:tenant_user_id/perfil', (req, res) => {
  const { profile_id } = req.body;
  send(res, svc.updateUsuarioPerfil(req.params.tenant_user_id, profile_id)
    .then(() => ({ tenant_user_id: req.params.tenant_user_id, profile_id })));
});

// PATCH /api/v1/antojados/equipo/usuarios/:tenant_user_id/revocar
router.patch('/equipo/usuarios/:tenant_user_id/revocar', (req, res) => {
  send(res, svc.revocarUsuario(req.params.tenant_user_id)
    .then(() => ({ tenant_user_id: req.params.tenant_user_id, status: 'revoked' })));
});

// POST /api/v1/antojados/equipo/usuarios/transferir-admin
// Body: { instance_id, nuevo_user_id }  — nuevo_user_id es auth_identities.user_id
router.post('/equipo/usuarios/transferir-admin', (req, res) => {
  const { instance_id, nuevo_user_id } = req.body;
  if (!instance_id || !nuevo_user_id)
    return res.status(400).json({ error: 'instance_id y nuevo_user_id son requeridos' });
  send(res, svc.transferirAdminGeneral({ instance_id, nuevo_user_id }));
});

// POST /api/v1/antojados/equipo/usuarios/transferir-admin-perfil
router.post('/equipo/usuarios/transferir-admin-perfil', (req, res) => {
  const { instance_id, requested_by_tenant_user_id, proposed_admin_tenant_user_id, password_secret_ref } = req.body;
  if (!instance_id || !requested_by_tenant_user_id || !proposed_admin_tenant_user_id || !password_secret_ref) {
    return res.status(400).json({ error: 'instance_id, requested_by_tenant_user_id, proposed_admin_tenant_user_id y password_secret_ref son requeridos' });
  }
  send(res, svc.transferirAdminGeneralPerfil(req.body));
});

// POST /api/v1/antojados/equipo/admin-general-change-requests
router.post('/equipo/admin-general-change-requests', (req, res) => {
  const { instance_id, requested_by_tenant_user_id, reason, password_secret_ref } = req.body;
  if (!instance_id || !requested_by_tenant_user_id || !reason || !password_secret_ref) {
    return res.status(400).json({ error: 'instance_id, requested_by_tenant_user_id, reason y password_secret_ref son requeridos' });
  }
  send(res, svc.requestAdminGeneralChange(req.body), 201);
});

// GET /api/v1/antojados/gt/admin-general-change-requests?instance_id=&status=

// GET /api/v1/antojados/equipo/admin-change-requests — Listar solicitudes de cambio Admin General
router.get("/equipo/admin-change-requests", (req, res) => {
  send(res, svc.listAdminGeneralChangeRequests({
    instance_id: req.query.instance_id || null,
    status: req.query.status || null,
  }));
});
router.get('/gt/admin-general-change-requests', (req, res) => {
  send(res, svc.listAdminGeneralChangeRequests({
    instance_id: req.query.instance_id || null,
    status: req.query.status || null,
  }));
});


// ─── User Account Control (UAC) — Control administrativo de cuentas sociales ──
// Migrado de /gt/user-account-control/* → /equipo/user-account-control/*
// @see CONTRATO_API_OPERACIONES_V1.md §14

// GET /api/v1/antojados/equipo/user-account-control
router.get("/equipo/user-account-control", (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, uacSvc.listUserAccountControl({
    control_status: req.query.control_status || null,
    search: req.query.search || null,
    limit,
    offset,
  }).then(data => ({ data, page, limit })));
});

// POST /api/v1/antojados/equipo/user-account-control/expire
router.post("/equipo/user-account-control/expire", (req, res) => {
  send(res, uacSvc.expireUserAccountControl());
});

// GET /api/v1/antojados/equipo/user-account-control/:user_id
router.get("/equipo/user-account-control/:user_id", (req, res) => {
  send(res, uacSvc.getUserAccountControl({
    user_id: req.params.user_id,
    instance_id: req.query.instance_id || null,
  }));
});

// POST /api/v1/antojados/equipo/user-account-control/:user_id
router.post("/equipo/user-account-control/:user_id", (req, res) => {
  send(res, uacSvc.setUserAccountControl(req.params.user_id, req.body), 201);
});


// ─── Invitaciones ─────────────────────────────────────────────────────────────

// GET /api/v1/antojados/equipo/invitaciones?instance_id=...
router.get('/equipo/invitaciones', (req, res) => {
  const { instance_id } = req.query;
  if (!instance_id) return res.status(400).json({ error: 'instance_id es requerido' });
  send(res, svc.listInvitacionesPendientes(instance_id));
});

// POST /api/v1/antojados/equipo/invitar
router.post('/equipo/invitar', (req, res) => {
  const { instance_id, created_by, invitee_email, invitee_phone_e164, channel } = req.body;
  if (!instance_id || !created_by || !invitee_email || !invitee_phone_e164 || !channel)
    return res.status(400).json({ error: 'instance_id, created_by, invitee_email, invitee_phone_e164 y channel son requeridos' });
  send(res, svc.generarInvitacion(req.body), 201);
});

// PATCH /api/v1/antojados/equipo/invitaciones/:id
router.patch('/equipo/invitaciones/:id', (req, res) => {
  const { invitee_email, invitee_phone_e164, channel } = req.body;
  if (!invitee_email || !invitee_phone_e164 || !channel)
    return res.status(400).json({ error: 'invitee_email, invitee_phone_e164 y channel son requeridos' });
  send(res, svc.updateInvitacion(req.params.id, { invitee_email, invitee_phone_e164, channel })
    .then(() => ({ id: req.params.id, updated: true })));
});

// DELETE /api/v1/antojados/equipo/invitaciones/:id
router.delete('/equipo/invitaciones/:id', (req, res) => {
  send(res, svc.deleteInvitacion(req.params.id)
    .then(() => ({ id: req.params.id, cancelled: true })));
});

// GET /api/v1/antojados/equipo/invitacion/:invite_code
router.get('/equipo/invitacion/:invite_code', (req, res) => {
  send(res, svc.getInvitacion(req.params.invite_code));
});

// POST /api/v1/antojados/equipo/redimir
router.post('/equipo/redimir', (req, res) => {
  const { invite_code, user_id } = req.body;
  if (!invite_code || !user_id)
    return res.status(400).json({ error: 'invite_code y user_id son requeridos' });
  send(res, svc.redimirInvitacion({ invite_code, user_id }), 201);
});

// ─── Asignaciones ─────────────────────────────────────────────────────────────

// GET /api/v1/antojados/equipo/asignaciones/:tenant_user_id
router.get('/equipo/asignaciones/:tenant_user_id', (req, res) => {
  send(res, svc.getAsignaciones(req.params.tenant_user_id));
});

// PUT /api/v1/antojados/equipo/asignaciones/:tenant_user_id
router.put('/equipo/asignaciones/:tenant_user_id', (req, res) => {
  const { details } = req.body;
  if (!Array.isArray(details))
    return res.status(400).json({ error: 'details debe ser un array' });
  send(res, svc.setAsignaciones(req.params.tenant_user_id, details));
});

// POST /api/v1/antojados/equipo/asignaciones/:tenant_user_id/seed
router.post('/equipo/asignaciones/:tenant_user_id/seed', (req, res) => {
  const force = req.body?.force === true;
  send(res, svc.seedAsignaciones(req.params.tenant_user_id, force));
});

module.exports = router;
