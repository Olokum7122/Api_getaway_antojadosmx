'use strict';

/**
 * feedRouter.js — Rutas de Feed para AntojadosMX
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Feed de contenido (biz_posts + soc_posts)
 * RESPONSABLE:  Exponer los endpoints de feed que consumen feedService.js
 *
 * NO HACE:
 *   - No contiene lógica de negocio (delegada a feedService.js)
 *   - No escribe en BD (solo lectura)
 *
 * ENDPOINTS:
 *   GET /api/v1/antojados/feed                    → Feed unificado (multi-canal)
 *   GET /api/v1/antojados/biz/feed                 → Feed negocios (vas_ir)
 *   GET /api/v1/antojados/biz/feed/arre            → Feed eventos (arre)
 *   GET /api/v1/antojados/posts/feed/pachanga      → Feed social pachanga/neta
 *   GET /api/v1/antojados/posts/feed/barrio        → Feed social barrio
 *   GET /api/v1/antojados/posts/feed/que-pex       → Feed que_pex (Explorer)
 *   GET /api/v1/antojados/posts/feed/desma         → Feed shorts (desma)
 *
 * PARÁMETROS COMUNES (query string):
 *   city_code   — Código de ciudad (MTY, CDMX, etc.)
 *   scope_level — 'ciudad' | 'zona' | 'mexico' | 'global'
 *   cursor      — Cursor base64 para paginación
 *   limit       — Posts por página (default 20, max 50)
 *   popular     — 'true' para ordenar por engagement en vez de fecha
 *
 * REFERENCIAS:
 *   - feedService.js → getFeed() / getFeedWithMedia()
 *   - apps-antojados/docs/feed.md (Sección 11.4: Contrato de Rutas)
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { Router } = require('express');
const feedService = require('../../../services/antojados/feedService');

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Normaliza el valor booleano de popular=true/false desde query string.
 */
function _parsePopular(val) {
  if (!val) return false;
  return val === 'true' || val === '1' || val === 'yes';
}

/**
 * Extrae parámetros comunes de feed del query string.
 * Incluye user_id y biz_post_id para filtros específicos.
 */
function _parseFeedParams(query) {
  return {
    city_code: query.city_code || null,
    scope_level: query.scope_level || 'ciudad',
    cursor: query.cursor || null,
    limit: parseInt(query.limit, 10) || 20,
    popular: _parsePopular(query.popular),
    userId: query.user_id || null,
    user_id: query.user_id || null,
    biz_post_id: query.biz_post_id || null,
    feed_type: query.feed_type || null,
  };
}

/**
 * Handler genérico para todas las rutas de feed.
 * Pasa todos los parámetros comunes + user_id + biz_post_id.
 */
function _feedHandler(feedScope) {
  return async (req, res) => {
    try {
      const params = {
        feed_scope: feedScope,
        ..._parseFeedParams(req.query),
      };
      const result = await feedService.getFeedWithMedia(params);
      res.json(result);
    } catch (err) {
      console.error(`[feedRouter] Error en feed ${feedScope}:`, err.message);
      res.status(500).json({
        error: 'Error al obtener feed',
        detail: err.message,
        feed_scope: feedScope,
      });
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/v1/antojados/feed — Feed unificado multi-canal
router.get('/feed', async (req, res) => {
  try {
    const feedScope = req.query.feed_scope ? String(req.query.feed_scope).trim().toLowerCase() : null;
    if (!feedScope) {
      return res.status(400).json({
        error: 'feed_scope es requerido',
        valid_scopes: feedService.FEED_SCOPES,
      });
    }
    const params = {
      feed_scope: feedScope,
      ..._parseFeedParams(req.query),
    };
    const result = await feedService.getFeedWithMedia(params);
    res.json(result);
  } catch (err) {
    console.error('[feedRouter] Error en feed general:', err.message);
    res.status(500).json({ error: 'Error al obtener feed', detail: err.message });
  }
});

// GET /api/v1/antojados/biz/feed — Feed negocios (vas_ir)
router.get('/biz/feed', _feedHandler('vas_ir'));

// GET /api/v1/antojados/biz/feed/arre — Feed eventos
router.get('/biz/feed/arre', _feedHandler('arre'));

// GET /api/v1/antojados/posts/feed/pachanga — Feed social pachanga/neta
router.get('/posts/feed/pachanga', _feedHandler('pachanga'));

// GET /api/v1/antojados/posts/feed/barrio — Feed social barrio
router.get('/posts/feed/barrio', _feedHandler('barrio'));

// GET /api/v1/antojados/posts/feed/que-pex — Feed que_pex (Explorer)
router.get('/posts/feed/que-pex', _feedHandler('que_pex'));

// GET /api/v1/antojados/posts/feed/desma — Feed shorts (desma)
router.get('/posts/feed/desma', _feedHandler('desma'));

module.exports = router;
