'use strict';
/**
 * biz.routes.js — Rutas de biz_posts (Negocios / Sponsors)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      Feed de AntojadosMX — Posts de Negocios (biz)
 * RESPONSABLE:  Exponer endpoints REST para CRUD e interacciones
 *               de posts de negocios (vas_ir, arre).
 *
 * NO HACE:
 *   - No expone rutas de soc_posts (posts.routes.js)
 *   - No expone el feed unificado (feedRouter.js)
 *
 * ENDPOINTS DEL MODELO (feed.md):
 *   POST   /biz/posts                               → createBizPost (§5)
 *   GET    /biz/posts                               → listBizPosts (§5)
 *   GET    /biz/posts/:biz_post_id                  → getBizPost (§5)
 *   POST   /biz/posts/:biz_post_id/like             → likeBizPost (§5)
 *   DELETE /biz/posts/:biz_post_id/like             → unlikeBizPost (§5)
 *   DELETE /biz/posts/:biz_post_id                  → deleteBizPost (§5)
 *   GET    /biz/posts/:biz_post_id/comments         → listBizComments (§5)
 *   POST   /biz/posts/:biz_post_id/comments         → addBizComment (§5)
 *   POST   /biz/posts/:biz_post_id/share            → shareBizPost (§5)
 *   PATCH  /biz/posts/:biz_post_id/taps             → tapBizPost (§5)
 *   POST   /biz/posts/:biz_post_id/cta-click        → clickBizCta (§5)
 *   GET    /biz/posts/:biz_post_id/media            → getBizPostMedia (§2)
 *
 * ⚠️ ENDPOINTS FUERA DEL MODELO (contaminación):
 *   GET|POST   /biz/tenants/me/tiles                → sponsorManager
 *   DELETE     /biz/tenants/me/tiles/:id             → sponsorManager
 *   PATCH      /biz/instancias/:id/setup/*           → sponsorManager
 *   GET|POST   /biz/instancias/:id/expediente/*      → sponsorManager
 *   Ver docs/feed.auditoria.md (Deuda #2)
 *
 * REFERENCIAS:
 *   - antojadosmx/docs/feed.md (Sección 5: Interacciones Biz)
 *   - antojadosmx/docs/feed.auditoria.md (Deuda #2)
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/biz.service');
const { parsePage, send } = require('./_helpers');

const router = Router();

// POST /api/v1/antojados/biz/posts
// Body: { sponsor_id, channel, feed_type?, city_code?, zone_code?, media_url?, doc_json?, asset_id? }
// NOTA: Solo los campos de biz_posts según feed.md. NO title, feed_type, user_id, etc.
router.post('/biz/posts', (req, res) => {
  const { sponsor_id, channel, feed_type, city_code, zone_code, media_url, doc_json, asset_id } = req.body;
  if (!sponsor_id)
    return res.status(400).json({ error: 'sponsor_id es requerido' });
  if (!channel)
    return res.status(400).json({ error: 'channel es requerido' });

  const normalizedChannel = String(channel).trim().toLowerCase();
  if (!['vas_ir', 'arre'].includes(normalizedChannel))
    return res.status(400).json({ error: `channel sponsor invalido: ${channel}. Válidos: vas_ir, arre` });

  // Solo pasar campos normalizados al resolver (feed.md)
  const payload = {
    sponsor_id,
    channel: normalizedChannel,
    feed_type: feed_type || 'general',
    city_code: city_code || null,
    zone_code: zone_code || null,
    media_url: media_url || null,
    doc_json: doc_json || null,
    asset_id: asset_id || null,
  };

  send(res, svc.createBizPost(payload), 201);
});

// GET /api/v1/antojados/biz/posts?sponsor_id=&channel=&feed_type=&media_url_invalid=
//   media_url_invalid=true → lista posts con media_url NULL, vacía o sin protocolo (auditoría)
//   Si no se pasa sponsor_id ni channel, se requiere media_url_invalid=true (auditoría)
router.get('/biz/posts', (req, res) => {
  const { sponsor_id, channel, media_url_invalid } = req.query;
  const normalizedChannel = channel ? String(channel).trim().toLowerCase() : null;
  
  // Permitir listar posts corruptos para auditoría sin sponsor_id ni channel
  const isAudit = media_url_invalid === 'true';
  if (!sponsor_id && !normalizedChannel && !isAudit) {
    return res.status(400).json({ error: 'sponsor_id, channel o media_url_invalid=true es requerido' });
  }
  if (normalizedChannel && !['vas_ir', 'arre'].includes(normalizedChannel)) {
    return res.status(400).json({ error: `channel sponsor invalido: ${channel}` });
  }
  
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.listBizPosts({
    sponsor_id: isAudit ? null : sponsor_id,
    channel: normalizedChannel,
    feed_type: req.query.feed_type,
    limit: isAudit ? 200 : limit,
    offset,
    media_url_invalid: isAudit || undefined,
  })
    .then(data => ({ data, page, limit })));
});

// GET /api/v1/antojados/biz/posts/:biz_post_id
router.get('/biz/posts/:biz_post_id', (req, res) => {
  send(res, svc.getBizPost(req.params.biz_post_id, req.query.user_id));
});

// POST /api/v1/antojados/biz/posts/:biz_post_id/like
router.post('/biz/posts/:biz_post_id/like', (req, res) => {
  if (!req.body.user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.likeBizPost({ biz_post_id: req.params.biz_post_id, user_id: req.body.user_id }));
});

// DELETE /api/v1/antojados/biz/posts/:biz_post_id/like
router.delete('/biz/posts/:biz_post_id/like', (req, res) => {
  if (!req.body.user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.unlikeBizPost({ biz_post_id: req.params.biz_post_id, user_id: req.body.user_id }));
});

// DELETE /api/v1/antojados/biz/posts/:biz_post_id
router.delete('/biz/posts/:biz_post_id', (req, res) => {
  send(res, svc.deleteBizPost(req.params.biz_post_id));
});

// GET /api/v1/antojados/biz/posts/:biz_post_id/comments
router.get('/biz/posts/:biz_post_id/comments', (req, res) => {
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.listBizComments(req.params.biz_post_id, { limit, offset })
    .then(data => ({ data, page, limit })));
});

// POST /api/v1/antojados/biz/posts/:biz_post_id/comments
router.post('/biz/posts/:biz_post_id/comments', (req, res) => {
  const { user_id, content_text } = req.body;
  if (!user_id || !content_text)
    return res.status(400).json({ error: 'user_id y content_text son requeridos' });
  if (content_text.length > 2000)
    return res.status(400).json({ error: 'content_text excede 2000 caracteres' });
  send(res,
    svc.addBizComment({ biz_post_id: req.params.biz_post_id, ...req.body })
      .then(id => ({ interaction_id: id, biz_post_id: req.params.biz_post_id })),
    201);
});

// POST /api/v1/antojados/biz/posts/:biz_post_id/share
router.post('/biz/posts/:biz_post_id/share', (req, res) => {
  if (!req.body.user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.shareBizPost({
    biz_post_id: req.params.biz_post_id,
    user_id: req.body.user_id,
    created_at_client: req.body.created_at_client,
  }));
});

// PATCH /api/v1/antojados/biz/posts/:biz_post_id/taps
router.patch('/biz/posts/:biz_post_id/taps', (req, res) => {
  const { tap_type } = req.body;
  if (!['whatsapp', 'maps'].includes(tap_type))
    return res.status(400).json({ error: 'tap_type debe ser whatsapp o maps' });
  send(res, svc.tapBizPost({ biz_post_id: req.params.biz_post_id, tap_type, user_id: req.body.user_id || null }));
});

// POST /api/v1/antojados/biz/posts/:biz_post_id/cta-click
router.post('/biz/posts/:biz_post_id/cta-click', (req, res) => {
  send(res, svc.clickBizCta({
    biz_post_id: req.params.biz_post_id,
    user_id: req.body.user_id || null,
    cta_type: req.body.cta_type || 'generic',
    created_at_client: req.body.created_at_client,
  }));
});

// GET /api/v1/antojados/biz/posts/:biz_post_id/media
// Devuelve media detallado de un biz post (thumb_url, feed_url, full_url, etc.)
router.get('/biz/posts/:biz_post_id/media', (req, res) => {
  send(res, svc.getBizPostMedia(req.params.biz_post_id));
});

// ─── Sponsor Tile Management ──────────────────────────────────────────────────

// GET /api/v1/antojados/biz/tenants/me/tiles?user_id=&status=
router.get('/biz/tenants/me/tiles', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  const { page, limit, offset } = parsePage(req.query);
  send(res, svc.getTenantTilesForUser(user_id, { status: req.query.status, limit, offset })
    .then(data => ({ data, page, limit })));
});

// POST /api/v1/antojados/biz/tenants/me/tiles
// Body: { user_id, media_url, tile_type?, content_json? }
router.post('/biz/tenants/me/tiles', (req, res) => {
  const { user_id, media_url } = req.body;
  if (!user_id)   return res.status(400).json({ error: 'user_id es requerido' });
  if (!media_url) return res.status(400).json({ error: 'media_url es requerido' });
  send(res, svc.createTile(user_id, req.body), 201);
});

// DELETE /api/v1/antojados/biz/tenants/me/tiles/:id
// Body: { user_id }
router.delete('/biz/tenants/me/tiles/:id', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.deleteTile(req.params.id, user_id));
});

// PATCH /api/v1/antojados/biz/instancias/:instance_id/setup/business
router.patch('/biz/instancias/:instance_id/setup/business', (req, res) => {
  const { user_id, business_name, biz_type, city_code } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  if (!business_name || !biz_type || !city_code)
    return res.status(400).json({ error: 'business_name, biz_type y city_code son requeridos' });
  send(res, svc.setupSponsorBusiness(req.params.instance_id, user_id, req.body));
});

// PATCH /api/v1/antojados/biz/instancias/:instance_id/setup/representative
router.patch('/biz/instancias/:instance_id/setup/representative', (req, res) => {
  const { user_id, tenant_user_id, display_name, phone_e164 } = req.body;
  if (!user_id || !tenant_user_id || !display_name || !phone_e164)
    return res.status(400).json({ error: 'user_id, tenant_user_id, display_name y phone_e164 son requeridos' });
  send(res, svc.setupSponsorRepresentative(req.params.instance_id, user_id, req.body));
});

// PATCH /api/v1/antojados/biz/instancias/:instance_id/setup/billing
router.patch('/biz/instancias/:instance_id/setup/billing', (req, res) => {
  const { user_id, billing_email, razon_social, rfc, fiscal_address } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  if (!billing_email || !razon_social || !rfc || !fiscal_address)
    return res.status(400).json({ error: 'billing_email, razon_social, rfc y fiscal_address son requeridos' });
  send(res, svc.setupSponsorBilling(req.params.instance_id, user_id, req.body));
});

// POST /api/v1/antojados/biz/instancias/:instance_id/expediente/upload
router.post('/biz/instancias/:instance_id/expediente/upload', (req, res) => {
  const {
    user_id,
    uploaded_by_tenant_user_id,
    doc_type,
    file_name,
    storage_url,
    mime_type,
    size_bytes,
  } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  if (!uploaded_by_tenant_user_id || !doc_type || !file_name || !storage_url || !mime_type || !Number.isFinite(Number(size_bytes)))
    return res.status(400).json({ error: 'uploaded_by_tenant_user_id, doc_type, file_name, storage_url, mime_type y size_bytes son requeridos' });
  send(res, svc.uploadSponsorExpedienteDocument(req.params.instance_id, user_id, req.body), 201);
});

// GET /api/v1/antojados/biz/instancias/:instance_id/expediente?user_id=...
router.get('/biz/instancias/:instance_id/expediente', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  send(res, svc.listSponsorExpediente(req.params.instance_id, user_id));
});

module.exports = router;
