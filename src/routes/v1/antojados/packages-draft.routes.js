'use strict';
const { Router } = require('express');
const svc = require('../../../services/antojados/packagesDraft.service');
const { send } = require('./_helpers');

const router = Router();

/**
 * POST /api/v1/antojados/packages/draft
 * Guarda (INSERT o UPDATE) un Draft Package en explorer_core.package_drafts
 * Body: { id_post?, package_type?, payload_json? }
 */
router.post('/packages/draft', async (req, res) => {
  try {
    const { id_post, package_type, payload_json } = req.body;
    const result = await svc.saveDraft({
      id_post,
      package_type: package_type || 'defaultpackage',
      payload_json: payload_json || '{}',
    });
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    console.error('[packages-draft] Error saving draft:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/v1/antojados/packages/drafts
 * Lista Draft Packages filtrados opcionalmente por package_type
 * Query: ?package_type=defaultpackage&limit=50&offset=0
 */
router.get('/packages/drafts', async (req, res) => {
  try {
    const package_type = String(req.query.package_type || '').trim() || null;
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;

    const result = await svc.listDrafts({ package_type, limit, offset });

    // Mapear a formato drafts para consumo del FAB
    const drafts = (result.packages || []).map(pkg => {
      let payload = {};
      try {
        payload = typeof pkg.payload === 'string' ? JSON.parse(pkg.payload) : (pkg.payload || {});
      } catch (e) {
        payload = {};
      }
      return {
        id_post: pkg.idPost,
        package_type: pkg.packageType,
        styleName: payload.styleName || payload.style_name || payload.title || payload.idPost || pkg.idPost,
        styleDescription: payload.styleDescription || payload.style_description || null,
        templateCode: payload.templateCode || payload.template_code || null,
        lookCode: payload.lookCode || payload.look_code || null,
        filterCode: payload.filterCode || payload.filter_code || null,
        suggestedFor: payload.suggestedFor || payload.suggested_for || null,
        blocks: payload.composicion?.blocks || payload.blocks || [],
        composicion: payload.composicion || null,
        template: payload.template || null,
        look: payload.look || null,
        filter: payload.filter || null,
        effects: payload.effects || [],
        mediaItems: payload.mediaItems || [],
        createdAt: pkg.createdAt,
      };
    });

    return res.json({ ok: true, drafts, total: result.total });
  } catch (err) {
    console.error('[packages-draft] Error listing drafts:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/v1/antojados/packages/draft/:id_post
 * Obtiene un Draft Package específico por su id_post
 */
router.get('/packages/draft/:id_post', async (req, res) => {
  try {
    const pkg = await svc.getDraft(req.params.id_post);
    if (!pkg) {
      return res.status(404).json({ ok: false, error: 'Draft not found' });
    }
    let payload = {};
    try {
      payload = typeof pkg.payload === 'string' ? JSON.parse(pkg.payload) : (pkg.payload || {});
    } catch (e) {
      payload = {};
    }
    return res.json({
      ok: true,
      data: {
        id_post: pkg.idPost,
        package_type: pkg.packageType,
        ...payload,
        createdAt: pkg.createdAt,
      },
    });
  } catch (err) {
    console.error('[packages-draft] Error getting draft:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
