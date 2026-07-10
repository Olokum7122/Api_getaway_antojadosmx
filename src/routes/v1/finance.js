'use strict';
// Módulo: Modelos Financieros (MF01-MF16)
// Esquema: gt_finance
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

// GET /api/v1/finance/profiles
router.get('/profiles', async (req, res) => {
  try {
    const pool = getPool('app');
    const sponsorBizId = getSponsorBizIdFromHeaders(req);
    const request = pool.request();
    let q = 'SELECT * FROM gt_finance.financial_model_profile WHERE is_active = 1';
    if (sponsorBizId) {
      request.input('sponsorBizId', sql.NVarChar(36), sponsorBizId);
      q += ' AND ' + SPONSOR_BIZ_KEY + ' = @sponsorBizId';
    }
    q += ' ORDER BY created_at DESC';
    const result = await request.query(q);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[finance.js] GET /profiles failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/finance/runs — crear un run de modelo financiero
router.post('/runs', async (req, res) => {
  try {
    const pool = getPool('app');
    const { model_profile_id, case_id, client_id, run_code, scenario_type, period_start, period_end, created_by } = req.body;
    const sponsorBizId = getSponsorBizIdFromBody(req.body);
    const id = uuidv4();
    await pool.request()
      .input('id', sql.NVarChar(36), id)
      .input('model_profile_id', sql.NVarChar(36), model_profile_id)
      .input('sponsorBizId', sql.NVarChar(36), sponsorBizId)
      .input('case_id', sql.NVarChar(36), case_id)
      .input('client_id', sql.NVarChar(36), client_id)
      .input('run_code', sql.NVarChar(80), run_code || id)
      .input('scenario_type', sql.NVarChar(40), scenario_type || 'BASE')
      .input('period_start', sql.Date, period_start || null)
      .input('period_end', sql.Date, period_end || null)
      .input('created_by', sql.NVarChar(100), created_by || 'api')
      .query((`INSERT INTO gt_finance.financial_model_run
        (model_run_id, model_profile_id, __BIZ_KEY__, case_id, client_id, run_code, scenario_type, status_code, period_start, period_end, created_by, updated_by)
        VALUES (@id, @model_profile_id, @sponsorBizId, @case_id, @client_id, @run_code, @scenario_type, 'DRAFT', @period_start, @period_end, @created_by, @created_by)`).replace('__BIZ_KEY__', SPONSOR_BIZ_KEY));
    res.status(201).json({ model_run_id: id });
  } catch (e) {
    console.error('[finance.js] POST /runs failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/finance/runs/:id
router.get('/runs/:id', async (req, res) => {
  try {
    const result = await getPool('app').request()
      .input('id', sql.NVarChar(36), req.params.id)
      .query('SELECT * FROM gt_finance.financial_model_run WHERE model_run_id = @id AND is_active = 1');
    if (!result.recordset.length) return res.status(404).json({ error: 'not_found' });
    res.json(result.recordset[0]);
  } catch (e) {
    console.error('[finance.js] GET /runs/:id failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/finance/runs/:id/assumptions
router.get('/runs/:id/assumptions', async (req, res) => {
  try {
    const result = await getPool('app').request()
      .input('id', sql.NVarChar(36), req.params.id)
      .query('SELECT * FROM gt_finance.financial_assumption_value WHERE model_run_id = @id AND is_active = 1');
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[finance.js] GET /runs/:id/assumptions failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/finance/runs/:id/series
router.get('/runs/:id/series', async (req, res) => {
  try {
    const request = getPool('app').request();
    request.input('id', sql.NVarChar(36), req.params.id);
    let q = 'SELECT * FROM gt_finance.financial_series_item WHERE model_run_id = @id';
    if (req.query.series_code) {
      request.input('sc', sql.NVarChar(80), req.query.series_code);
      q += ' AND series_code = @sc';
    }
    q += ' ORDER BY series_code, period_label';
    const result = await request.query(q);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[finance.js] GET /runs/:id/series failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/finance/runs/:id/indicators
router.get('/runs/:id/indicators', async (req, res) => {
  try {
    const result = await getPool('app').request()
      .input('id', sql.NVarChar(36), req.params.id)
      .query(`SELECT * FROM gt_finance.financial_indicator_result
              WHERE model_run_id = @id AND is_active = 1 ORDER BY period_label`);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[finance.js] GET /runs/:id/indicators failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/finance/runs/:id/breakeven
router.get('/runs/:id/breakeven', async (req, res) => {
  try {
    const result = await getPool('app').request()
      .input('id', sql.NVarChar(36), req.params.id)
      .query('SELECT * FROM gt_finance.financial_breakeven_result WHERE model_run_id = @id AND is_active = 1');
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[finance.js] GET /runs/:id/breakeven failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/finance/runs/:id/scenarios
router.get('/runs/:id/scenarios', async (req, res) => {
  try {
    const result = await getPool('app').request()
      .input('id', sql.NVarChar(36), req.params.id)
      .query('SELECT * FROM gt_finance.financial_scenario WHERE model_run_id = @id AND is_active = 1');
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[finance.js] GET /runs/:id/scenarios failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/finance/indicators/catalog
router.get('/indicators/catalog', async (_req, res) => {
  try {
    const result = await getPool('app').request()
      .query('SELECT * FROM gt_finance.financial_indicator_catalog WHERE is_active = 1');
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[finance.js] GET /indicators/catalog failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
