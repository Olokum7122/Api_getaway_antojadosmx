'use strict';
/**
 * auth.routes.js — Rutas de Autenticación y Usuarios
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Autenticación (Auth)
 * RESPONSABLE:  Exponer endpoints REST para registro, login, perfil,
 *               recuperación de contraseña y gestión de exploradores.
 *
 * ENDPOINTS:
 *   POST   /auth/register                        → registro de usuario/sponsor
 *   POST   /auth/register-employee               → registro con invitación
 *   POST   /auth/login                           → login
 *   POST   /auth/password-recovery/request       → solicitar código
 *   POST   /auth/password-recovery/verify        → verificar código
 *   POST   /auth/password-recovery/reset         → resetear contraseña
 *   GET    /auth/profile/:user_id                → obtener perfil
 *   PATCH  /auth/profile/:user_id                → actualizar perfil
 *   GET    /auth/explorers                       → listar exploradores
 *   GET    /auth/explorers/activity              → actividad batch
 *   PATCH  /auth/explorers/:user_id              → cambiar status
 *   POST   /auth/explorers/:user_id/associations → asociar explorador
 *   GET    /auth/explorers/:user_id/associations → listar asociaciones
 *   PATCH  /auth/explorers/:user_id/associations/:association_id → status
 *   GET    /auth/explorers/:user_id/activity     → actividad individual
 *
 * REFERENCIAS:
 *   - auth.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/auth.service');
const { send } = require('./_helpers');

const router = Router();

function parseLimitOffset(query) {
  const rawLimit = parseInt(query.limit || 50, 10);
  const rawOffset = parseInt(query.offset || 0, 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, rawLimit)) : 50;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;
  return { limit, offset };
}

// POST /api/v1/antojados/auth/register
router.post('/auth/register', (req, res) => {
  const allowed_fields = new Set([
    'email_hash',
    'password_secret_ref',
    'password_confirm_secret_ref',
    'confirm_password_secret_ref',
    'instance_type',
    'display_name',
    'username',
    'city_code',
    'device_id',
    'marketing_opt_in',
    'business_name',
    'biz_type',
    'phone',
  ]);
  const unexpected_fields = Object.keys(req.body || {}).filter((key) => !allowed_fields.has(key));
  if (unexpected_fields.length) {
    return res.status(400).json({
      error: `Campos no permitidos en registro: ${unexpected_fields.join(', ')}`,
    });
  }
  const {
    email_hash,
    password_secret_ref,
    password_confirm_secret_ref,
    confirm_password_secret_ref,
    instance_type,
  } = req.body;
  const missingFields = [];
  if (!email_hash) missingFields.push('email_hash');
  if (!password_secret_ref) missingFields.push('password_secret_ref');
  if (!instance_type) missingFields.push('instance_type');
  if (missingFields.length) {
    return res.status(400).json({
      error: `Campos faltantes en registro: ${missingFields.join(', ')}`,
    });
  }
  if (!/^[a-f0-9]{64}$/i.test(String(email_hash))) {
    return res.status(400).json({ error: 'email_hash inválido: debe ser SHA-256 hexadecimal de 64 caracteres' });
  }
  if (!/^sha256:[a-f0-9]{64}$/i.test(String(password_secret_ref))) {
    return res.status(400).json({ error: 'password_secret_ref inválido: debe usar formato sha256:<64 hex>' });
  }

  const normalizedInstanceType = String(instance_type).trim().toLowerCase();
  if (!['user', 'sponsor'].includes(normalizedInstanceType)) {
    return res.status(400).json({ error: 'instance_type inválido: permitidos user | sponsor' });
  }

  if (normalizedInstanceType === 'sponsor') {
    const sponsorMissing = [];
    if (!String(req.body.display_name || '').trim()) sponsorMissing.push('display_name');
    if (!String(req.body.username || '').trim()) sponsorMissing.push('username');
    if (!String(req.body.city_code || '').trim()) sponsorMissing.push('city_code');
    if (!String(req.body.business_name || '').trim()) sponsorMissing.push('business_name');
    if (!String(req.body.biz_type || '').trim()) sponsorMissing.push('biz_type');

    if (sponsorMissing.length) {
      return res.status(400).json({
        error: `Campos faltantes para registro sponsor: ${sponsorMissing.join(', ')}`,
      });
    }
  }

  const passwordConfirmRef = password_confirm_secret_ref || confirm_password_secret_ref || null;
  if (passwordConfirmRef && String(passwordConfirmRef) !== String(password_secret_ref)) {
    return res.status(400).json({ error: 'La confirmación de contraseña no coincide' });
  }
  send(res, svc.registerUser(req.body), 201);
});

// POST /api/v1/antojados/auth/register-employee
router.post('/auth/register-employee', (req, res) => {
  const allowed_fields = new Set([
    'email_hash',
    'invite_code',
    'display_name',
    'city_code',
    'device_id',
    'password_secret_ref',
    'password_confirm_secret_ref',
    'confirm_password_secret_ref',
    'marketing_opt_in',
  ]);
  const unexpected_fields = Object.keys(req.body || {}).filter((key) => !allowed_fields.has(key));
  if (unexpected_fields.length) {
    return res.status(400).json({
      error: `Campos no permitidos en registro empleado: ${unexpected_fields.join(', ')}`,
    });
  }
  const { email_hash, invite_code, display_name, password_secret_ref } = req.body;
  if (!email_hash || !invite_code || !display_name || !password_secret_ref)
    return res.status(400).json({
      error: 'email_hash, invite_code, display_name y password_secret_ref son requeridos',
    });
  if (!/^sha256:[a-f0-9]{64}$/i.test(String(password_secret_ref))) {
    return res.status(400).json({ error: 'password_secret_ref inválido: debe usar formato sha256:<64 hex>' });
  }
  send(res, svc.registerEmployeeWithInvite(req.body), 201);
});

// POST /api/v1/antojados/auth/login
router.post('/auth/login', (req, res) => {
  const { email_hash, login_identifier, password_secret_ref } = req.body;
  console.log('[AuthAPI] /auth/login request', JSON.stringify({
    email_hash_prefix: email_hash ? String(email_hash).slice(0, 12) : null,
    login_identifier: login_identifier ? String(login_identifier).trim().toLowerCase() : null,
    password_secret_ref_prefix: password_secret_ref ? String(password_secret_ref).slice(0, 20) : null,
  }));
  if ((!email_hash && !login_identifier) || !password_secret_ref)
    return res.status(400).json({ error: 'email_hash o login_identifier y password_secret_ref son requeridos' });
  send(res, svc.loginUser({ email_hash, login_identifier, password_secret_ref }).then((user) => {
    if (!user) {
      console.warn('[AuthAPI] /auth/login reject', JSON.stringify({
        email_hash_prefix: email_hash ? String(email_hash).slice(0, 12) : null,
        login_identifier: login_identifier ? String(login_identifier).trim().toLowerCase() : null,
      }));
      return Promise.reject(Object.assign(new Error('Credenciales inválidas'), { status: 401 }));
    }
    console.log('[AuthAPI] /auth/login success', JSON.stringify({ user_id: user.user_id, username: user.username || null }));
    return user;
  }));
});

// POST /api/v1/antojados/auth/password-recovery/request
router.post('/auth/password-recovery/request', (req, res) => {
  const { email_hash, delivery_channel, email } = req.body;
  if (!email_hash) {
    return res.status(400).json({ error: 'email_hash es requerido' });
  }
  send(res, svc.requestPasswordRecovery({ email_hash, delivery_channel, email }), 201);
});

// POST /api/v1/antojados/auth/password-recovery/verify
router.post('/auth/password-recovery/verify', (req, res) => {
  const { recovery_request_id, recovery_code } = req.body;
  if (!recovery_request_id || !recovery_code) {
    return res.status(400).json({ error: 'recovery_request_id y recovery_code son requeridos' });
  }
  send(res, svc.verifyPasswordRecoveryCode({ recovery_request_id, recovery_code }));
});

// POST /api/v1/antojados/auth/password-recovery/reset
router.post('/auth/password-recovery/reset', (req, res) => {
  const {
    recovery_request_id,
    recovery_code,
    password_secret_ref,
    password_confirm_secret_ref,
    confirm_password_secret_ref,
  } = req.body;
  if (!recovery_request_id || !recovery_code || !password_secret_ref) {
    return res.status(400).json({
      error: 'recovery_request_id, recovery_code y password_secret_ref son requeridos',
    });
  }
  send(res, svc.resetPasswordWithRecovery({
    recovery_request_id,
    recovery_code,
    password_secret_ref,
    password_confirm_secret_ref,
    confirm_password_secret_ref,
  }));
});

// GET /api/v1/antojados/auth/profile/:user_id
router.get('/auth/profile/:user_id', (req, res) => {
  send(res, svc.getProfile(req.params.user_id));
});

// PATCH /api/v1/antojados/auth/profile/:user_id
router.patch('/auth/profile/:user_id', (req, res) => {
  send(res, svc.updateProfile(req.params.user_id, req.body).then(() => ({ user_id: req.params.user_id })));
});

// GET /api/v1/antojados/auth/explorers
router.get('/auth/explorers', (req, res) => {
  const { limit, offset } = parseLimitOffset(req.query);
  send(res, svc.listExplorers({ city_code: req.query.city_code || null, limit, offset })
    .then(data => ({ data, limit, offset })));
});

// GET /api/v1/antojados/auth/explorers/activity?days=14
router.get('/auth/explorers/activity', (req, res) => {
  const { limit, offset } = parseLimitOffset(req.query);
  send(res, svc.listExplorersActivity({
    city_code: req.query.city_code || null,
    days: req.query.days || 14,
    limit,
    offset,
  }));
});

// PATCH /api/v1/antojados/auth/explorers/:user_id
// Body: { enabled?: boolean, updated_by?: user_id }
router.patch('/auth/explorers/:user_id', (req, res) => {
  const enabled = req.body.enabled !== false;
  send(res, svc.setExplorerStatus(req.params.user_id, { ...req.body, enabled }));
});

// POST /api/v1/antojados/auth/explorers/:user_id/associations
// Body: { target_type:'user'|'sponsor', associated_instance_id, association_source?, notes?, created_by? }
router.post('/auth/explorers/:user_id/associations', (req, res) => {
  send(res, svc.linkExplorerAssociation(req.params.user_id, req.body), 201);
});

// GET /api/v1/antojados/auth/explorers/:user_id/associations
router.get('/auth/explorers/:user_id/associations', (req, res) => {
  const { limit, offset } = parseLimitOffset(req.query);
  send(res, svc.listExplorerAssociations(req.params.user_id, {
    status: req.query.status || 'active',
    target_type: req.query.target_type || null,
    limit,
    offset,
  }).then(data => ({ data, limit, offset })));
});

// PATCH /api/v1/antojados/auth/explorers/:user_id/associations/:association_id
// Body: { status: active|inactive, notes?, updated_by? }
router.patch('/auth/explorers/:user_id/associations/:association_id', (req, res) => {
  send(res, svc.updateExplorerAssociation(req.params.user_id, req.params.association_id, req.body));
});

// GET /api/v1/antojados/auth/explorers/:user_id/activity?days=14
router.get('/auth/explorers/:user_id/activity', (req, res) => {
  send(res, svc.getExplorerActivity(req.params.user_id, { days: req.query.days || 14 }));
});

module.exports = router;
