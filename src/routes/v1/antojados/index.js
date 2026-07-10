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
 *
 * SUB-ROUTERS (según modelo feed.md):
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
 *   templates.routes   → plantillas de contenido
 *   publications.routes → publicaciones
 *   packages-draft.routes → paquetes/borradores
 *   gt-proxy.routes    → proxy GT API (Android)
 *   gt-tenants.routes  → GT tenants (fallback)
 *   gt-efirma.routes   → GT e-firma (fallback)
 *   gt-dimensions.routes → GT dimensiones (fallback)
 *   gt-moderation.routes → moderación social
 *   gt-notifications.routes → notificaciones
 *
 * ⚠️ NOTA: Muchos de estos sub-routers están fuera del modelo feed.md
 *          (auth, equipo, instancias, templates, packages, rewards, etc.)
 *          y pertenecen a otros dominios del monolito.
 *
 * REFERENCIAS:
 *   - apps-antojados/docs/feed.md (Sección 11.4)
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');

const router = Router();

// App-facing
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
router.use(require('./templates.routes'));
router.use(require('./publications.routes'));
router.use(require('./packages-draft.routes'));

// GT Panel (owner GT API): passthrough principal para Android new / app consumers.
// Si GT_API_BASE_URL existe, todas las rutas /gt deben resolverse primero por proxy.
router.use(require('./gt-proxy.routes'));

// GT-local endpoints quedan como fallback solamente cuando el proxy no esta configurado.
router.use(require('./gt-tenants.routes'));
router.use(require('./gt-efirma.routes'));
router.use(require('./gt-dimensions.routes'));

// App-facing que viven en archivos mixtos con rutas /gt.
router.use(require('./gt-moderation.routes')); // /social/report (app-facing)
router.use(require('./gt-notifications.routes')); // /notifications (app-facing)

module.exports = router;

