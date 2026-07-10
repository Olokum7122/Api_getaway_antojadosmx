'use strict';
// Módulo: Planeación PRO/STORE (PL01-PL17)
// Esquemas: gt_diagnostic_parametric, gt_strategy
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

// ─── DIAGNÓSTICO PARAMÉTRICO ─────────────────────────────────
// GET /api/v1/planning/diagnostic/profiles
router.get('/diagnostic/profiles', async (req, res) => {
  try {
    const pool = getPool('app');
    const sponsorBizId = getSponsorBizIdFromHeaders(req);
    const request = pool.request();
    let q = 'SELECT * FROM gt_diagnostic_parametric.diagnostic_parametric_profile WHERE is_active = 1';
    if (sponsorBizId) {
      request.input('sponsorBizId', sql.NVarChar(36), sponsorBizId);
      q += ' AND ' + SPONSOR_BIZ_KEY + ' = @sponsorBizId';
    }
    q += ' ORDER BY created_at DESC';
    const result = await request.query(q);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[planning.js] GET /diagnostic/profiles failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/planning/diagnostic/runs — iniciar diagnóstico
router.post('/diagnostic/runs', async (req, res) => {
  try {
    const pool = getPool('app');
    const { parametric_profile_id, pv_id, case_id, client_id, created_by } = req.body;
    const sponsorBizId = getSponsorBizIdFromBody(req.body);
    const id = uuidv4();
    await pool.request()
      .input('id', sql.NVarChar(36), id)
      .input('parametric_profile_id', sql.NVarChar(36), parametric_profile_id)
      .input('pv_id', sql.NVarChar(36), pv_id)
      .input('sponsorBizId', sql.NVarChar(36), sponsorBizId)
      .input('case_id', sql.NVarChar(36), case_id)
      .input('client_id', sql.NVarChar(36), client_id)
      .input('created_by', sql.NVarChar(100), created_by || 'api')
      .query((`INSERT INTO gt_diagnostic_parametric.diagnostic_parametric_run
        (param_run_id, parametric_profile_id, pv_id, __BIZ_KEY__, case_id, client_id, status_code, created_by, updated_by)
        VALUES (@id, @parametric_profile_id, @pv_id, @sponsorBizId, @case_id, @client_id, 'OPEN', @created_by, @created_by)`).replace('__BIZ_KEY__', SPONSOR_BIZ_KEY));
    res.status(201).json({ param_run_id: id });
  } catch (e) {
    console.error('[planning.js] POST /diagnostic/runs failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/planning/diagnostic/runs/:id
router.get('/diagnostic/runs/:id', async (req, res) => {
  try {
    const result = await getPool('app').request()
      .input('id', sql.NVarChar(36), req.params.id)
      .query('SELECT * FROM gt_diagnostic_parametric.diagnostic_parametric_run WHERE param_run_id = @id AND is_active = 1');
    if (!result.recordset.length) return res.status(404).json({ error: 'not_found' });
    res.json(result.recordset[0]);
  } catch (e) {
    console.error('[planning.js] GET /diagnostic/runs/:id failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/planning/diagnostic/runs/:id/findings
router.get('/diagnostic/runs/:id/findings', async (req, res) => {
  try {
    const result = await getPool('app').request()
      .input('id', sql.NVarChar(36), req.params.id)
      .query(`SELECT * FROM gt_diagnostic_parametric.diagnostic_parametric_finding
              WHERE param_run_id = @id AND is_active = 1 ORDER BY severity_code DESC`);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[planning.js] GET /diagnostic/runs/:id/findings failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── ESTRATEGIA ───────────────────────────────────────────────
// POST /api/v1/planning/strategy/runs
router.post('/strategy/runs', async (req, res) => {
  try {
    const pool = getPool('app');
    const { case_id, client_id, run_code, strategy_type, created_by } = req.body;
    const sponsorBizId = getSponsorBizIdFromBody(req.body);
    const id = uuidv4();
    await pool.request()
      .input('id', sql.NVarChar(36), id)
      .input('sponsorBizId', sql.NVarChar(36), sponsorBizId)
      .input('case_id', sql.NVarChar(36), case_id)
      .input('client_id', sql.NVarChar(36), client_id)
      .input('run_code', sql.NVarChar(80), run_code || id)
      .input('strategy_type', sql.NVarChar(40), strategy_type || 'PRO')
      .input('created_by', sql.NVarChar(100), created_by || 'api')
      .query((`INSERT INTO gt_strategy.strategy_run
        (strategy_run_id, __BIZ_KEY__, case_id, client_id, run_code, strategy_type, status_code, created_by, updated_by)
        VALUES (@id, @sponsorBizId, @case_id, @client_id, @run_code, @strategy_type, 'DRAFT', @created_by, @created_by)`).replace('__BIZ_KEY__', SPONSOR_BIZ_KEY));
    res.status(201).json({ strategy_run_id: id });
  } catch (e) {
    console.error('[planning.js] POST /strategy/runs failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/planning/strategy/runs/:id
router.get('/strategy/runs/:id', async (req, res) => {
  try {
    const result = await getPool('app').request()
      .input('id', sql.NVarChar(36), req.params.id)
      .query('SELECT * FROM gt_strategy.strategy_run WHERE strategy_run_id = @id AND is_active = 1');
    if (!result.recordset.length) return res.status(404).json({ error: 'not_found' });
    res.json(result.recordset[0]);
  } catch (e) {
    console.error('[planning.js] GET /strategy/runs/:id failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/planning/strategy/runs/:id/foda
router.get('/strategy/runs/:id/foda', async (req, res) => {
  try {
    const result = await getPool('app').request()
      .input('id', sql.NVarChar(36), req.params.id)
      .query(`SELECT * FROM gt_strategy.foda_item
              WHERE strategy_run_id = @id AND is_active = 1 ORDER BY foda_type, item_order`);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[planning.js] GET /strategy/runs/:id/foda failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/planning/strategy/runs/:id/foda
router.post('/strategy/runs/:id/foda', async (req, res) => {
  try {
    const pool = getPool('app');
    const { foda_type, description, impact_score, item_order, created_by } = req.body;
    const sponsorBizId = getSponsorBizIdFromBody(req.body);
    const fid = uuidv4();
    await pool.request()
      .input('fid', sql.NVarChar(36), fid)
      .input('run_id', sql.NVarChar(36), req.params.id)
      .input('sponsorBizId', sql.NVarChar(36), sponsorBizId)
      .input('foda_type', sql.NVarChar(20), foda_type)
      .input('description', sql.NVarChar(sql.MAX), description)
      .input('impact_score', sql.Decimal(10, 4), impact_score || null)
      .input('item_order', sql.Int, item_order || 0)
      .input('created_by', sql.NVarChar(100), created_by || 'api')
      .query((`INSERT INTO gt_strategy.foda_item
        (foda_id, strategy_run_id, __BIZ_KEY__, foda_type, description, impact_score, item_order, created_by, updated_by)
        VALUES (@fid, @run_id, @sponsorBizId, @foda_type, @description, @impact_score, @item_order, @created_by, @created_by)`).replace('__BIZ_KEY__', SPONSOR_BIZ_KEY));
    res.status(201).json({ foda_id: fid });
  } catch (e) {
    console.error('[planning.js] POST /strategy/runs/:id/foda failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/planning/strategy/runs/:id/summary
router.get('/strategy/runs/:id/summary', async (req, res) => {
  try {
    const result = await getPool('app').request()
      .input('id', sql.NVarChar(36), req.params.id)
      .query(`SELECT * FROM gt_strategy.strategy_executive_summary
              WHERE strategy_run_id = @id AND is_active = 1`);
    if (!result.recordset.length) return res.status(404).json({ error: 'not_found' });
    res.json(result.recordset[0]);
  } catch (e) {
    console.error('[planning.js] GET /strategy/runs/:id/summary failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
