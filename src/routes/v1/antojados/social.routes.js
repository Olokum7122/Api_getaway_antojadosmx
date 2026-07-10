'use strict';
/**
 * social.routes.js — Rutas de Interacciones Sociales
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Interacciones Sociales (likes, comments,
 *               follows, saves, shares)
 * RESPONSABLE:  Exponer endpoints REST para interacciones sociales
 *               sobre soc_posts y soc_places.
 *
 * ENDPOINTS:
 *   Social (likes, comments, ratings):
 *     POST   /posts/:post_id/like         → like
 *     DELETE /posts/:post_id/like         → unlike
 *     POST   /posts/:post_id/comments     → comment
 *     POST   /posts/:post_id/ratings      → rate
 *     GET    /posts/:post_id/comments     → list comments
 *     POST   /posts/:post_id/share        → share
 *
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
 * ⚠️ NOTA: Algunos endpoints de likes/comments compiten con posts.routes.js.
 *
 * REFERENCIAS:
 *   - apps-antojados/docs/feed.md (Sección 5)
 *   - social.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/social.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// ─── SOCIAL: likes & comments ─────────────────────────────────

// POST /api/v1/antojados/posts/:post_id/like
router.post('/posts/:post_id/like', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.likePost(req.params.post_id, user_id, req.body)
    .then(() => ({ post_id: req.params.post_id, user_id })), 201);
});

// DELETE /api/v1/antojados/posts/:post_id/like
router.delete('/posts/:post_id/like', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.unlikePost(req.params.post_id, user_id)
    .then(() => ({ post_id: req.params.post_id })));
});

// POST /api/v1/antojados/posts/:post_id/comments
router.post('/posts/:post_id/comments', (req, res) => {
  const { user_id, content_text } = req.body;
  if (!user_id || !content_text)
    return res.status(400).json({ error: 'user_id y content_text son requeridos' });
  if (content_text.length > 2000)
    return res.status(400).json({ error: 'content_text excede 2000 caracteres' });
  send(res,
    svc.addComment({ post_id: req.params.post_id, ...req.body })
      .then(interaction_id => ({ interaction_id, post_id: req.params.post_id })),
    201);
});

// POST /api/v1/antojados/posts/:post_id/ratings
router.post('/posts/:post_id/ratings', (req, res) => {
  const { user_id, taste, price, service, cleanliness, ambience, wait_time } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  const dims = { taste, price, service, cleanliness, ambience, wait_time };
  const anySet = Object.values(dims).some(v => v != null && v > 0);
  if (!anySet) return res.status(400).json({ error: 'Al menos una dimensión debe ser > 0' });
  send(res,
    svc.ratePost({ post_id: req.params.post_id, user_id, ...dims })
      .then(rating_id => ({ rating_id, post_id: req.params.post_id })),
    201);
});

// GET /api/v1/antojados/posts/:post_id/comments
router.get('/posts/:post_id/comments', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.listComments(req.params.post_id, { limit, offset }).then(data => ({ data, page, limit })));
});

// POST /api/v1/antojados/posts/:post_id/share
router.post('/posts/:post_id/share', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.sharePost(req.params.post_id, user_id, req.body)
    .then(() => ({ post_id: req.params.post_id, user_id })), 201);
});

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
