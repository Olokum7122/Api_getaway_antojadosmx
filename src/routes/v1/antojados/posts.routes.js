'use strict';
/**
 * posts.routes.js — Rutas de soc_posts (Sociales / Usuarios)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      Feed de AntojadosMX — Posts Sociales (soc)
 * RESPONSABLE:  Exponer endpoints REST para CRUD e interacciones
 *               de posts sociales (pachanga, neta, barrio, que_pex, desma).
 *
 * NO HACE:
 *   - No expone rutas de biz_posts (biz.routes.js)
 *   - No expone el feed unificado (feedRouter.js)
 *   - No expone rutas de rating (rating.routes.js)
 *
 * ENDPOINTS DEL MODELO (feed.md):
 *   GET    /posts                         → listPosts (§3)
 *   POST   /posts                         → createPost (§3, §5)
 *   GET    /posts/:post_id                → getPost (§3)
 *   DELETE /posts/:post_id                → deletePost (§5)
 *   POST   /posts/:post_id/like           → likePost (§5)
 *   DELETE /posts/:post_id/like           → unlikePost (§5)
 *   POST   /posts/:post_id/comments       → commentPost (§5)
 *   POST   /posts/:post_id/view           → viewPost (§5)
 *   GET    /posts/:post_id/interactions-summary → getPostInteractionsSummary (§5)
 *
 * RESTRICCIONES (feed.md):
 *   - user_id requerido (quién crea/interactúa)
 *   - channel: pachanga, neta, barrio, que_pex, desma (§3)
 *   - feed_type: default 'neta'
 *   - post_id NO debe enviarse desde el cliente (lo genera el SP §7.1)
 *   - business_name NO existe en soc_posts (era columna legacy)
 *   - media_type está en soc_post_media (§4), no en soc_posts (§3)
 *   - content_text max 2000 chars (§7.6)
 *
 * REFERENCIAS:
 *   - antojadosmx/docs/feed.md (Sección 3: soc_posts)
 *   - antojadosmx/docs/feed.md (Sección 5: SPs Soc)
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/posts.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// GET /api/v1/antojados/posts
router.get('/posts', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.listPosts({ ...req.query, limit, offset }).then(data => ({ data, page, limit })));
});

// POST /api/v1/antojados/posts
// Modelo §3: user_id, channel, feed_type, media_url, doc_json
// §7.1: post_id generado por SP (LOWER(NEWID())), no enviado por cliente
router.post('/posts', (req, res) => {
  const { user_id, channel } = req.body;
  if (!user_id)
    return res.status(400).json({ error: 'user_id es requerido' });
  const allowedChannels = new Set(['pachanga', 'neta', 'barrio', 'que_pex', 'desma']);
  const normalizedChannel = String(channel || '').trim().toLowerCase();
  if (!normalizedChannel || !allowedChannels.has(normalizedChannel)) {
    return res.status(400).json({
      error: `channel invalido: ${normalizedChannel}. Permitidos: pachanga, neta, barrio, que_pex, desma`,
    });
  }
  req.body.channel = normalizedChannel;
  if (!req.body.feed_type) req.body.feed_type = null;
  // NOTA: post_id NO debe venir del cliente (lo genera el SP §7.1)
  if (req.body.post_id) delete req.body.post_id;
  // NOTA: business_name NO existe en soc_posts (era columna legacy)
  if (req.body.business_name) {
    console.warn('[posts.routes] business_name ignorado: no existe en soc_posts (legacy)');
    delete req.body.business_name;
  }
  send(res, svc.createPost(req.body).then(result => ({ post_id: result.post_id })), 201);
});

// GET /api/v1/antojados/posts/:post_id
router.get('/posts/:post_id', (req, res) => {
  send(res, svc.getPost(req.params.post_id, req.query.user_id));
});

// DELETE /api/v1/antojados/posts/:post_id
// Body: { user_id, force? }  — force=true omite check de ownership (moderación/admin)
router.delete('/posts/:post_id', (req, res) => {
  const { user_id, force } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.deletePost(req.params.post_id, user_id, { force: !!force })
    .then(() => ({ post_id: req.params.post_id })));
});

// ─── Interacciones Sociales (soc_posts) ─────────────────────────────────────────

// POST /api/v1/antojados/posts/:post_id/like
router.post('/posts/:post_id/like', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.likePost({ post_id: req.params.post_id, user_id }));
});

// DELETE /api/v1/antojados/posts/:post_id/like
router.delete('/posts/:post_id/like', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.unlikePost({ post_id: req.params.post_id, user_id }));
});

// POST /api/v1/antojados/posts/:post_id/comments
router.post('/posts/:post_id/comments', (req, res) => {
  const { user_id, content_text } = req.body;
  if (!user_id || !content_text)
    return res.status(400).json({ error: 'user_id y content_text son requeridos' });
  if (content_text.length > 2000)
    return res.status(400).json({ error: 'content_text excede 2000 caracteres' });
  send(res, svc.commentPost({
    post_id: req.params.post_id,
    user_id,
    content_text,
    parent_comment_id: req.body.parent_comment_id || null,
    created_at_client: req.body.created_at_client || null,
  }), 201);
});

// POST /api/v1/antojados/posts/:post_id/view
router.post('/posts/:post_id/view', (req, res) => {
  const { user_id } = req.body;
  send(res, svc.viewPost({ post_id: req.params.post_id, user_id: user_id || null }));
});

// GET /api/v1/antojados/posts/:post_id/interactions-summary
router.get('/posts/:post_id/interactions-summary', (req, res) => {
  const user_id = req.query.user_id || null;
  send(res, svc.getPostInteractionsSummary({ post_id: req.params.post_id, user_id }));
});

module.exports = router;

