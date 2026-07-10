'use strict';
const { Router } = require('express');
const svc = require('../../../services/antojados/publications.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// POST /api/v1/antojados/publications
// Body (V2 contents model): { id_post, content_type, id_sponsor?, id_user?, feed_type, channel, package_type, template_code?, user_id?, payload_json? }
router.post('/publications', (req, res) => {
  const { id_post, content_type, channel, feed_type, package_type } = req.body;
  if (!id_post) return res.status(400).json({ error: 'id_post es requerido' });
  if (!content_type) return res.status(400).json({ error: 'content_type es requerido (sponsor|social)' });
  if (!channel) return res.status(400).json({ error: 'channel es requerido' });
  if (!feed_type) return res.status(400).json({ error: 'feed_type es requerido (publicity|general|user)' });
  if (!package_type) return res.status(400).json({ error: 'package_type es requerido' });

  if (content_type === 'sponsor' && !req.body.id_sponsor) {
    return res.status(400).json({ error: 'content_type sponsor requiere id_sponsor' });
  }
  if (content_type === 'social' && !req.body.id_user) {
    return res.status(400).json({ error: 'content_type social requiere id_user' });
  }

  send(res, svc.createPublication({
    id_post,
    content_type: String(content_type).trim().toLowerCase(),
    id_sponsor: req.body.id_sponsor || null,
    id_user: req.body.id_user || null,
    feed_type: String(feed_type).trim().toLowerCase(),
    channel: String(channel).trim().toLowerCase(),
    package_type: String(package_type).trim().toLowerCase(),
    template_code: req.body.template_code || null,
    user_id: req.body.user_id || null,
    payload_json: req.body.payload_json || null,
  }), 201);
});

// GET /api/v1/antojados/publications/by-post/:id_post
router.get('/publications/by-post/:id_post', (req, res) => {
  send(res, svc.getPublicationByPost(req.params.id_post));
});

// GET /api/v1/antojados/publications/by-post-media/:id_post
// Regla R8: Resuelve URLs de media desde Antojados App (v_posts_media)
router.get('/publications/by-post-media/:id_post', async (req, res) => {
  try {
    const { id_post } = req.params;
    const modalidad = req.query.modalidad || null;

    if (!id_post) {
      return res.status(400).json({ ok: false, error: 'id_post es requerido' });
    }

    const mediaPackage = await svc.getPostMediaPackage(id_post, modalidad);

    if (!mediaPackage) {
      return res.status(404).json({
        ok: false,
        error: 'Post no encontrado o sin media asociada',
      });
    }

    return res.json({ ok: true, data: mediaPackage });
  } catch (err) {
    console.error('[publications] Error en by-post-media:', err.message);
    return res.status(500).json({
      ok: false,
      error: 'Error al resolver media del post',
      detail: err.message,
    });
  }
});

// GET /api/v1/antojados/publications/by-sponsor/:id_sponsor
router.get('/publications/by-sponsor/:id_sponsor', (req, res) => {
  const { page, limit } = parsePage(req.query);
  send(res, svc.listPublicationsBySponsor(req.params.id_sponsor, {
    channel: req.query.channel || null,
    feed_type: req.query.feed_type || null,
    page,
    page_size: limit,
  }).then(data => ({ data, page, limit })));
});

// GET /api/v1/antojados/publications/by-channel/:channel
router.get('/publications/by-channel/:channel', (req, res) => {
  const { page, limit } = parsePage(req.query);
  send(res, svc.listPublicationsByChannel(req.params.channel, {
    content_type: req.query.content_type || null,
    feed_type: req.query.feed_type || null,
    page,
    page_size: limit,
  }).then(data => ({ data, page, limit })));
});

// POST /api/v1/antojados/publications/seed/biz-posts
router.post('/publications/seed/biz-posts', (req, res) => {
  send(res, svc.seedFromBizPosts());
});

// POST /api/v1/antojados/publications/seed/soc-posts
router.post('/publications/seed/soc-posts', (req, res) => {
  send(res, svc.seedFromSocPosts());
});

module.exports = router;
