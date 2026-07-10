'use strict';
// Módulo: Soluciones (S01-S16)
// Esquema: gt_solutions
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

// GET /api/v1/solutions/catalog
router.get('/catalog', async (_req, res) => {
  try {
    const pool = getPool('app');
    const result = await pool.request()
      .query('SELECT * FROM gt_solutions.solution_catalog WHERE is_active = 1 ORDER BY created_at DESC');
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[solutions.js] GET /catalog failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/solutions/registry — tenant registrations
router.get('/registry', async (req, res) => {
  try {
    const pool = getPool('app');
    const sponsorBizId = getSponsorBizIdFromHeaders(req);
    const request = pool.request();
    let q = 'SELECT * FROM gt_solutions.tenant_solution_registry WHERE is_active = 1';
    if (sponsorBizId) {
      request.input('sponsorBizId', sql.NVarChar(36), sponsorBizId);
      q += ' AND ' + SPONSOR_BIZ_KEY + ' = @sponsorBizId';
    }
    q += ' ORDER BY created_at DESC';
    const result = await request.query(q);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[solutions.js] GET /registry failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/solutions/registry — registrar solución a tenant
router.post('/registry', async (req, res) => {
  try {
    const pool = getPool('app');
    const { solution_catalog_id, activated_by } = req.body;
    const sponsorBizId = getSponsorBizIdFromBody(req.body);
    const id = uuidv4();
    await pool.request()
      .input('id', sql.NVarChar(36), id)
      .input('sponsorBizId', sql.NVarChar(36), sponsorBizId)
      .input('solution_catalog_id', sql.NVarChar(36), solution_catalog_id)
      .input('activated_by', sql.NVarChar(100), activated_by || 'api')
      .query((`INSERT INTO gt_solutions.tenant_solution_registry
        (registry_id, __BIZ_KEY__, solution_catalog_id, status_code, created_by, updated_by)
        VALUES (@id, @sponsorBizId, @solution_catalog_id, 'ACTIVE', @activated_by, @activated_by)`).replace('__BIZ_KEY__', SPONSOR_BIZ_KEY));
    res.status(201).json({ registry_id: id });
  } catch (e) {
    console.error('[solutions.js] POST /registry failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/solutions/:sponsorBizId/status — estado operacional
router.get('/:sponsorBizId/status', async (req, res) => {
  try {
    const pool = getPool('app');
    const result = await pool.request()
      .input('sponsorBizId', sql.NVarChar(36), req.params.sponsorBizId)
            .query(('SELECT TOP 1 * FROM gt_solutions.tenant_operational_status_log\n'
              + '              WHERE __BIZ_KEY__ = @sponsorBizId ORDER BY created_at DESC').replace('__BIZ_KEY__', SPONSOR_BIZ_KEY));
    if (!result.recordset.length) return res.status(404).json({ error: 'not_found' });
    res.json(result.recordset[0]);
  } catch (e) {
    console.error('[solutions.js] GET /:sponsorBizId/status failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/solutions/:sponsorBizId/module-requests
router.get('/:sponsorBizId/module-requests', async (req, res) => {
  try {
    const pool = getPool('app');
    const result = await pool.request()
      .input('sponsorBizId', sql.NVarChar(36), req.params.sponsorBizId)
            .query(('SELECT * FROM gt_solutions.tenant_module_request\n'
              + '              WHERE __BIZ_KEY__ = @sponsorBizId AND is_active = 1\n'
              + '              ORDER BY created_at DESC').replace('__BIZ_KEY__', SPONSOR_BIZ_KEY));
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[solutions.js] GET /:sponsorBizId/module-requests failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/solutions/:sponsorBizId/billing
router.get('/:sponsorBizId/billing', async (req, res) => {
  try {
    const pool = getPool('app');
    const result = await pool.request()
      .input('sponsorBizId', sql.NVarChar(36), req.params.sponsorBizId)
            .query(('SELECT TOP 1 * FROM gt_solutions.tenant_billing_read_model\n'
              + '              WHERE __BIZ_KEY__ = @sponsorBizId ORDER BY created_at DESC').replace('__BIZ_KEY__', SPONSOR_BIZ_KEY));
    if (!result.recordset.length) return res.status(404).json({ error: 'not_found' });
    res.json(result.recordset[0]);
  } catch (e) {
    console.error('[solutions.js] GET /:sponsorBizId/billing failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
