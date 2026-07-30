'use strict';
/**
 * routes/v1/antojados/index.js — Agregador de Rutas del Dominio Antojados
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Enrutamiento del API Gateway
 * RESPONSABLE:  Montar todos los sub-routers del dominio Antojados
 *               en el router principal /api/v1/antojados.
 *
 * NAMESPACES PROPIETARIOS (CONTRATO_API_OPERACIONES_V1.md §14):
 *   /api/v1/antojados/dimensiones/*           → catálogo, scanner, templates, checked
 *   /api/v1/antojados/cuentas/*               → tenants
 *   /api/v1/antojados/equipo/*                → perfiles, usuarios, UAC, admin changes
 *   /api/v1/antojados/efirma/*                → ciclo de e-firma
 *
 * SUB-ROUTERS (según modelo feed.md y modelo vertical/transversal):
 *   auth.routes        → autenticación
 *   app-diag.routes    → diagnóstico de app
 *   feedback.routes    → feedback de usuario
 *   geo.routes         → geografía/contexto (§11.2)
 *   places.routes      → lugares
 *   posts.routes       → soc_posts (§3, §5)
 *   rating.routes      → calificaciones
 *   feedRouter         → feed unificado (§11.4)
 *   social.routes      → social (follows, saves)
 *   sync.routes        → sincronización offline
 *   rewards.routes     → recompensas/cupones
 *   analytics.routes   → analíticas
 *   biz.routes         → biz_posts, registration, expediente (§1, §2, §5)
 *   equipo.routes      → equipo, perfiles, usuarios, UAC, admin changes
 *   instancias.routes  → instancias de negocio
 *   dimensiones.routes → catálogo dimensiones, scanner, templates, checked
 *   cuentas.routes     → tenants
 *   efirma.routes      → e-firma
 *
 * RUTAS GT LEGACY (mantenidas por retrocompatibilidad hasta migración total):
 *   gt-tenants.routes           → /gt/tenants/ (legacy) (REEMPLAZADO por /cuentas/tenants/*)
 *   gt-efirma.routes            → /gt/efirma/ (legacy) (REEMPLAZADO por /efirma/*)
 *   gt-dimensions.routes        → /gt/dimensions/ (legacy) (REEMPLAZADO por /dimensiones/catalog/*)
 *   gt-templates.routes         → /gt/templates/ (legacy) (REEMPLAZADO por /dimensiones/templates/*)
 *   gt-checked.routes           → /gt/instances/{id}/checked/{dimensions} (REEMPLAZADO por /dimensiones/checked/*)
 *   gt-user-account-control.routes → /gt/user-account-control/ (legacy) (REEMPLAZADO por /equipo/user-account-control/*)
 *   gt-moderation.routes        → moderación social (app-facing, se mantiene)
 *   gt-notifications.routes     → notificaciones (app-facing, se mantiene)
 *
 * @see CONTRATO_API_OPERACIONES_V1.md §14 — Namespaces Propietarios
 * @see PLAN_REESTRUCTURACION_CONSUMO.md
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');

const router = Router();

// ─── App-facing (dominio Antojados) ─────────────────────────────────
router.use(require('./auth.routes'));
router.use(require('./app-diag.routes'));
router.use(require('./feedback.routes'));
router.use(require('./geo.routes'));
router.use(require('./places.routes'));
router.use(require('./posts.routes'));
router.use(require('./rating.routes'));
router.use(require('./feedRouter'));
router.use(require('./social.routes'));
router.use(require('./sync.routes'));
router.use(require('./rewards.routes'));
router.use(require('./analytics.routes'));
router.use(require('./biz.routes'));
router.use(require('./equipo.routes'));
router.use(require('./instancias.routes'));

// ─── Namespaces Propietarios (CONTRATO_API_OPERACIONES_V1.md §14) ────
router.use(require('./dimensiones.routes'));
router.use(require('./cuentas.routes'));
router.use(require('./efirma.routes'));

// ─── GT Legacy (retrocompatibilidad — se eliminarán cuando Antojados API
//      migre completamente y GT API apunte solo a rutas propietarias) ───
router.use(require('./gt-tenants.routes'));
router.use(require('./gt-efirma.routes'));
router.use(require('./gt-dimensions.routes'));
router.use(require('./gt-templates.routes'));
router.use(require('./gt-checked.routes'));
router.use(require('./gt-moderation.routes'));
router.use(require('./gt-notifications.routes'));
router.use(require('./gt-user-account-control.routes'));

// ─── GT proxy (:4010) — desactivado; GT API corre como proceso independiente ───
// router.use(require('./gt-proxy.routes'));

module.exports = router;
