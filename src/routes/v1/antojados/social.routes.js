'use strict';
/**
 * social.routes.js — Rutas Sociales Fuera del Feed Rail
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Interacciones sociales no-feed.
 * RESPONSABLE:  Exponer follows y saves de lugares/perfiles.
 *
 * Las acciones de posts/feed rail viven en:
 *   - posts.routes.js             → soc_posts canónico
 *   - biz.routes.js               → biz_posts canónico
 *
 * ENDPOINTS:
 *   Follows:
 *     POST   /social/follows             → follow/unfollow toggle
 *     GET    /social/following/:user_id  → list following
 *     GET    /social/followers/:user_id  → list followers
 *
 *   Saves:
 *     POST   /social/saves               → save/unsave toggle
 *     GET    /social/saves/:user_id      → list saves
 *     GET    /social/saves/:user_id/feed → saves feed
 *
 * REFERENCIAS:
 *   - posts.routes.js
 *   - biz.routes.js
 *   - social.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/social.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// ─── SOCIAL V2: follows ────────────────────────────────────────

// POST /api/v1/antojados/social/follows
// Body: { follower_user_id, target_type, target_user_id?, target_place_id? }
router.post('/social/follows', (req, res) => {
  const { follower_user_id, target_type } = req.body;
  if (!follower_user_id || !target_type)
    return res.status(400).json({ error: 'follower_user_id y target_type son requeridos' });
  if (!['user', 'place'].includes(target_type))
    return res.status(400).json({ error: 'target_type debe ser "user" o "place"' });
  if (target_type === 'user'  && !req.body.target_user_id)
    return res.status(400).json({ error: 'target_user_id es requerido cuando target_type=user' });
  if (target_type === 'place' && !req.body.target_place_id)
    return res.status(400).json({ error: 'target_place_id es requerido cuando target_type=place' });
  send(res, svc.followToggle(req.body));
});

// GET /api/v1/antojados/social/following/:user_id
router.get('/social/following/:user_id', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.listFollowing({ user_id: req.params.user_id, target_type: req.query.target_type, limit, offset })
    .then(data => ({ data, page, limit })));
});

// GET /api/v1/antojados/social/followers/:user_id
router.get('/social/followers/:user_id', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.listFollowers({ user_id: req.params.user_id, limit, offset })
    .then(data => ({ data, page, limit })));
});

// ─── SOCIAL V2: saves ──────────────────────────────────────────

// POST /api/v1/antojados/social/saves
// Body: { user_id, id }
router.post('/social/saves', (req, res) => {
  const { user_id, id } = req.body;
  if (!user_id || !id)
    return res.status(400).json({ error: 'user_id y id son requeridos' });
  send(res, svc.saveToggle(req.body));
});

// GET /api/v1/antojados/social/saves/:user_id
router.get('/social/saves/:user_id', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.listSaves({ user_id: req.params.user_id, limit, offset })
    .then(data => ({ data, page, limit })));
});

// GET /api/v1/antojados/social/saves/:user_id/feed
router.get('/social/saves/:user_id/feed', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.getSavesFeed({ user_id: req.params.user_id, limit, offset })
    .then(data => ({ data, page, limit })));
});

module.exports = router;
