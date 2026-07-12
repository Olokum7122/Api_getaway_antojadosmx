'use strict';
/**
 * services/antojados/index.js — Agregador de Servicios del Dominio Antojados
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Servicios del API Gateway
 * RESPONSABLE:  Re-exportar todas las funciones de los servicios de dominio,
 *               manteniendo la misma interfaz que el monolito
 *               antojados.service.js original.
 *
 * NO HACE:
 *   - No contiene lógica de negocio
 *   - No agrega/dedup valida exports (passthrough puro)
 *
 * SERVICIOS EXPORTADOS (según modelo feed.md):
 *   auth.service        → autenticación
 *   places.service      → lugares
 *   posts.service       → soc_posts (§3, §5)
 *   social.service      → social (likes, comments, follows, saves)
 *   sync.service        → sincronización offline
 *   feedService         → feed unificado (§11)
 *   rewards.service     → recompensas/cupones
 *   analytics.service   → analíticas (GT Web)
 *   biz.service         → biz_posts (§1, §2, §5)
 *
 * REFERENCIAS:
 *   - antojadosmx/docs/feed.md (Sección 11: Feed Service)
 * ══════════════════════════════════════════════════════════════════════════════
 */

module.exports = {
  // auth
  ...require('./auth.service'),
  // places
  ...require('./places.service'),
  // posts
  ...require('./posts.service'),
  // social (likes, comments, follows, saves)
  ...require('./social.service'),
  // sync (outbox SQLite)
  ...require('./sync.service'),
    // feed → feedService (nuevo, consume biz_posts/soc_posts directamente)
  ...require('./feedService'),
  // rewards
  ...require('./rewards.service'),
  // analytics (GT Web)
  ...require('./analytics.service'),
  // biz content + comments + taps
  ...require('./biz.service'),
};
