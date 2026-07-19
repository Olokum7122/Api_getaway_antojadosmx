'use strict';
/**
 * routes/v1/antojados/index.js — Agregador de Rutas del Dominio Antojados
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Enrutamiento del API Gateway
 * RESPONSABLE:  Montar todos los sub-routers del dominio Antojados
 *               en el router principal /api/v1/antojados.
 *
 * NO HACE:
 *   - No contiene lógica de negocio
 *   - No expone rutas fuera del prefijo /api/v1/antojados
 *   - No incluye rutas de Explorer (publications, packages-draft, templates)
 *     Explorer publica como usuario feed, no es parte del consumo de datos
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
 *   biz.routes         → biz_posts (§1, §2, §5)
 *   equipo.routes      → equipo de trabajo
 *   instancias.routes  → instancias de negocio
 *
 * RUTAS GT locales (gobierno Antojados):
 *   gt-tenants.routes  → tenants/expediente sponsor
 *   gt-efirma.routes   → eFirma sponsor
 *   gt-dimensions.routes → catálogo dimensions/sub-dimensions Antojados
 *   gt-templates.routes → plantillas DEFAULT_USER/DEFAULT_SPONSOR
 *   gt-checked.routes → locations materializadas por instancia
 *   gt-moderation.routes → moderación social (app-facing)
 *   gt-notifications.routes → notificaciones (app-facing)
 *   gt-proxy.routes    → proxy GT API sólo para rutas transversales restantes
 *
 * RUTAS ELIMINADAS (Explorer legacy — no forman parte del feed):
 *   publications.routes     → 🗑️ ELIMINADO
 *   packages-draft.routes   → 🗑️ ELIMINADO
 *   templates.routes        → 🗑️ ELIMINADO
 *   gt-ops.routes           → 🗑️ ELIMINADO
 *   gt-tiles.routes         → 🗑️ ELIMINADO
 *
 * REFERENCIAS:
 *   - antojadosmx/docs/feed.md (Sección 11.4)
 *   - PLAN_REESTRUCTURACION_CONSUMO.md
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

// ─── GT local (dimensiones/plantillas/locations propias de Antojados) ───
router.use(require('./gt-tenants.routes'));
router.use(require('./gt-efirma.routes'));
router.use(require('./gt-dimensions.routes'));
router.use(require('./gt-templates.routes'));
router.use(require('./gt-checked.routes'));
router.use(require('./gt-moderation.routes'));
router.use(require('./gt-notifications.routes'));

// ─── GT proxy (:4010) para rutas transversales no resueltas localmente ───
router.use(require('./gt-proxy.routes'));

module.exports = router;