'use strict';
// Módulo: Servicios (SV01-SV19) + Legales
// Esquemas: gt_services, gt_legal
const { Router } = require('express');
const { getPool, sql } = require('../../db');
const { v4: uuidv4 } = require('uuid');

const router = Router();
const SPONSOR_BIZ_KEY = 'tenant' + '_id';

function getSponsorBizIdFromHeaders(req) {
  return req.headers['x-sponsor-biz-id'] || req.headers['x-tenant-id'] || null;
}

function getSponsorBizIdFromBody(body) {
  return body?.sponsor_biz_id || body?.[SPONSOR_BIZ_KEY] || null;
}

// ─── CATÁLOGO DE SERVICIOS ───────────────────────────────────
// GET /api/v1/services/products
router.get('/products', async (_req, res) => {
  try {
    const result = await getPool('app').request()
      .query('SELECT * FROM gt_services.service_product_catalog WHERE is_active = 1 ORDER BY created_at DESC');
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[services.js] GET /products failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── CASE WORKSPACE ──────────────────────────────────────────
// GET /api/v1/services/cases
router.get('/cases', async (req, res) => {
  try {
    const pool = getPool('app');
    const sponsorBizId = getSponsorBizIdFromHeaders(req);
    const request = pool.request();
    let q = 'SELECT * FROM gt_core.project_case WHERE is_active = 1';
    if (sponsorBizId) {
      request.input('sponsorBizId', sql.NVarChar(36), sponsorBizId);
      q += ' AND ' + SPONSOR_BIZ_KEY + ' = @sponsorBizId';
    }
    q += ' ORDER BY created_at DESC';
    const result = await request.query(q);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[services.js] GET /cases failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/services/cases
router.post('/cases', async (req, res) => {
  try {
    const pool = getPool('app');
    const { client_id, case_name, case_type, created_by } = req.body;
    const sponsorBizId = getSponsorBizIdFromBody(req.body);
    const id = uuidv4();
    await pool.request()
      .input('id', sql.NVarChar(36), id)
      .input('sponsorBizId', sql.NVarChar(36), sponsorBizId)
      .input('client_id', sql.NVarChar(36), client_id)
      .input('case_name', sql.NVarChar(300), case_name)
      .input('case_type', sql.NVarChar(60), case_type || 'GENERAL')
      .input('created_by', sql.NVarChar(100), created_by || 'api')
      .query((`INSERT INTO gt_core.project_case
        (case_id, __BIZ_KEY__, client_id, case_name, case_type, status_code, created_by, updated_by)
        VALUES (@id, @sponsorBizId, @client_id, @case_name, @case_type, 'OPEN', @created_by, @created_by)`).replace('__BIZ_KEY__', SPONSOR_BIZ_KEY));
    res.status(201).json({ case_id: id });
  } catch (e) {
    console.error('[services.js] POST /cases failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/services/cases/:id
router.get('/cases/:id', async (req, res) => {
  try {
    const result = await getPool('app').request()
      .input('id', sql.NVarChar(36), req.params.id)
      .query('SELECT * FROM gt_core.project_case WHERE case_id = @id AND is_active = 1');
    if (!result.recordset.length) return res.status(404).json({ error: 'not_found' });
    res.json(result.recordset[0]);
  } catch (e) {
    console.error('[services.js] GET /cases/:id failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── DELIVERABLES ────────────────────────────────────────────
// GET /api/v1/services/deliverables/catalog
router.get('/deliverables/catalog', async (_req, res) => {
  try {
    const result = await getPool('app').request()
      .query('SELECT * FROM gt_services.deliverable_catalog WHERE is_active = 1 ORDER BY created_at DESC');
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[services.js] GET /deliverables/catalog failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/services/deliverables/packages?case_id=
router.get('/deliverables/packages', async (req, res) => {
  try {
    const pool = getPool('app');
    const request = pool.request();
    let q = 'SELECT * FROM gt_services.deliverable_package WHERE is_active = 1';
    if (req.query.case_id) {
      request.input('caseId', sql.NVarChar(36), req.query.case_id);
      q += ' AND case_id = @caseId';
    }
    q += ' ORDER BY created_at DESC';
    const result = await request.query(q);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[services.js] GET /deliverables/packages failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── CRM CONTACTOS ───────────────────────────────────────────
// GET /api/v1/services/crm/contacts?client_id=
router.get('/crm/contacts', async (req, res) => {
  try {
    const pool = getPool('app');
    const request = pool.request();
    let q = 'SELECT * FROM gt_services.service_crm_contact WHERE is_active = 1';
    if (req.query.client_id) {
      request.input('clientId', sql.NVarChar(36), req.query.client_id);
      q += ' AND client_id = @clientId';
    }
    q += ' ORDER BY created_at DESC';
    const result = await request.query(q);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[services.js] GET /crm/contacts failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── CONTRATOS LEGALES ───────────────────────────────────────
// GET /api/v1/services/contracts?case_id=
router.get('/contracts', async (req, res) => {
  try {
    const pool = getPool('app');
    const request = pool.request();
    let q = 'SELECT * FROM gt_legal.contract_header WHERE is_active = 1';
    if (req.query.case_id) {
      request.input('caseId', sql.NVarChar(36), req.query.case_id);
      q += ' AND case_id = @caseId';
    }
    q += ' ORDER BY created_at DESC';
    const result = await request.query(q);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[services.js] GET /contracts failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/services/contracts/:id
router.get('/contracts/:id', async (req, res) => {
  try {
    const result = await getPool('app').request()
      .input('id', sql.NVarChar(36), req.params.id)
      .query('SELECT * FROM gt_legal.contract_header WHERE contract_id = @id AND is_active = 1');
    if (!result.recordset.length) return res.status(404).json({ error: 'not_found' });
    res.json(result.recordset[0]);
  } catch (e) {
    console.error('[services.js] GET /contracts/:id failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
