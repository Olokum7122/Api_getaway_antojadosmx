'use strict';
// Módulo: Analítica (AN01-AN22)
// DBs: ATLX_GT_ANALYTICS (pools: analytics)
//      ATLX_GT_APP para señales (pool: app)
const { Router } = require('express');
const { getPool, sql } = require('../../db');

const router = Router();
const SPONSOR_BIZ_KEY = 'tenant' + '_id';

function getSponsorBizId(query) {
  return query?.sponsor_biz_id || query?.[SPONSOR_BIZ_KEY] || null;
}

const FORWARDED_HEADERS = new Set([
  'accept',
  'authorization',
  'content-type',
  'x-tenant-id',
  'x-user-id',
  'x-corp-api-key',
  'x-request-id',
]);

function getGtBaseUrl() {
  const base = (process.env.GT_API_BASE_URL || '').trim();
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function buildForwardHeaders(req) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!FORWARDED_HEADERS.has(key)) continue;
    if (value === undefined) continue;
    headers[key] = value;
  }
  return headers;
}

// Migracion gradual: GT API primero, fallback local en 404/error.
router.use(async (req, res, next) => {
  const base = getGtBaseUrl();
  if (!base) return next();

  const targetUrl = `${base}${req.originalUrl}`;
  const headers = buildForwardHeaders(req);
  const init = { method: req.method, headers };

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
    init.body = JSON.stringify(req.body);
    if (!headers['content-type']) headers['content-type'] = 'application/json';
  }

  try {
    const upstream = await fetch(targetUrl, init);
    if (upstream.status === 404) return next();
    if (upstream.status >= 500) {
      console.error(`[analytics.proxy] upstream ${upstream.status}, fallback local`);
      return next();
    }

    const contentType = upstream.headers.get('content-type') || 'application/json';
    const raw = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', contentType);
    if (!raw) return res.end();
    if (!contentType.includes('application/json')) return res.send(raw);

    try {
      return res.send(JSON.parse(raw));
    } catch (err) {
      console.error('[analytics.proxy] json parse failed:', err.message);
      return res.send(raw);
    }
  } catch (err) {
    console.error('[analytics.proxy] gt forward failed, fallback local:', err.message);
    return next();
  }
});

// ─── KPIs MATERIALIZADOS ─────────────────────────────────────
// GET /api/v1/analytics/kpis/centro-reportes?sponsor_biz_id=&year=&month=
router.get('/kpis/centro-reportes', async (req, res) => {
  try {
    const pool = getPool('analytics');
    const request = pool.request();
    let q = 'SELECT * FROM gt_analytics.centro_reportes_pmonth WHERE 1=1';
    const sponsorBizId = getSponsorBizId(req.query);
    if (sponsorBizId) {
      request.input('sponsorBizId', sql.NVarChar(36), sponsorBizId);
      q += ' AND ' + SPONSOR_BIZ_KEY + ' = @sponsorBizId';
    }
    if (req.query.year) {
      request.input('year', sql.Int, parseInt(req.query.year, 10));
      q += ' AND period_year = @year';
    }
    if (req.query.month) {
      request.input('month', sql.Int, parseInt(req.query.month, 10));
      q += ' AND period_month = @month';
    }
    q += ' ORDER BY period_year DESC, period_month DESC, report_domain, kpi_code';
    const result = await request.query(q);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[analytics.js] kpis/centro-reportes failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/analytics/kpis/pro-lite?sponsor_biz_id=&year=&month=
router.get('/kpis/pro-lite', async (req, res) => {
  try {
    const pool = getPool('analytics');
    const request = pool.request();
    let q = 'SELECT * FROM gt_analytics.metricas_pro_lite_pmonth WHERE 1=1';
    const sponsorBizId = getSponsorBizId(req.query);
    if (sponsorBizId) {
      request.input('sponsorBizId', sql.NVarChar(36), sponsorBizId);
      q += ' AND ' + SPONSOR_BIZ_KEY + ' = @sponsorBizId';
    }
    if (req.query.year) {
      request.input('year', sql.Int, parseInt(req.query.year, 10));
      q += ' AND period_year = @year';
    }
    if (req.query.month) {
      request.input('month', sql.Int, parseInt(req.query.month, 10));
      q += ' AND period_month = @month';
    }
    if (req.query.metric_code) {
      request.input('mc', sql.NVarChar(80), req.query.metric_code);
      q += ' AND metric_code = @mc';
    }
    q += ' ORDER BY period_year DESC, period_month DESC, metric_code';
    const result = await request.query(q);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[analytics.js] kpis/pro-lite failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/analytics/kpis/store?sponsor_biz_id=&year=&month=
router.get('/kpis/store', async (req, res) => {
  try {
    const pool = getPool('analytics');
    const request = pool.request();
    let q = 'SELECT * FROM gt_analytics.metricas_store_pmonth WHERE 1=1';
    const sponsorBizId = getSponsorBizId(req.query);
    if (sponsorBizId) {
      request.input('sponsorBizId', sql.NVarChar(36), sponsorBizId);
      q += ' AND ' + SPONSOR_BIZ_KEY + ' = @sponsorBizId';
    }
    if (req.query.year) {
      request.input('year', sql.Int, parseInt(req.query.year, 10));
      q += ' AND period_year = @year';
    }
    if (req.query.month) {
      request.input('month', sql.Int, parseInt(req.query.month, 10));
      q += ' AND period_month = @month';
    }
    q += ' ORDER BY period_year DESC, period_month DESC, metric_code';
    const result = await request.query(q);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[analytics.js] kpis/store failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── ENCUESTAS ────────────────────────────────────────────────
// GET /api/v1/analytics/surveys/daily?sponsor_biz_id=&survey_code=
router.get('/surveys/daily', async (req, res) => {
  try {
    const pool = getPool('analytics');
    const request = pool.request();
    let q = 'SELECT * FROM gt_analytics.cs_encuestas_pday WHERE 1=1';
    const sponsorBizId = getSponsorBizId(req.query);
    if (sponsorBizId) {
      request.input('sponsorBizId', sql.NVarChar(36), sponsorBizId);
      q += ' AND ' + SPONSOR_BIZ_KEY + ' = @sponsorBizId';
    }
    if (req.query.survey_code) {
      request.input('sc', sql.NVarChar(80), req.query.survey_code);
      q += ' AND survey_code = @sc';
    }
    q += ' ORDER BY period_date DESC';
    const result = await request.query(q);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[analytics.js] surveys/daily failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── SEÑALES ──────────────────────────────────────────────────
// GET /api/v1/analytics/signals/catalog
router.get('/signals/catalog', async (_req, res) => {
  try {
    const result = await getPool('analytics').request()
      .query('SELECT * FROM gt_analytics_signal.signal_catalog WHERE is_active = 1 ORDER BY signal_domain, signal_code');
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[analytics.js] signals/catalog failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/analytics/signals/recent?sponsor_biz_id=&limit=20
router.get('/signals/recent', async (req, res) => {
  try {
    const pool = getPool('analytics');
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 200);
    const request = pool.request();
    request.input('limit', sql.Int, limit);
    let q = `SELECT TOP (@limit) sp.*, sc.signal_name, sc.signal_domain
             FROM gt_analytics_signal.signal_publication sp
             LEFT JOIN gt_analytics_signal.signal_catalog sc ON sp.signal_code = sc.signal_code
             WHERE 1=1`;
    const sponsorBizId = getSponsorBizId(req.query);
    if (sponsorBizId) {
      request.input('sponsorBizId', sql.NVarChar(36), sponsorBizId);
      q += ' AND sp.' + SPONSOR_BIZ_KEY + ' = @sponsorBizId';
    }
    q += ' ORDER BY sp.published_at DESC';
    const result = await request.query(q);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[analytics.js] signals/recent failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── MODELO ANALÍTICO ─────────────────────────────────────────
// GET /api/v1/analytics/models/results?sponsor_biz_id=&entity_type=
router.get('/models/results', async (req, res) => {
  try {
    const pool = getPool('analytics');
    const request = pool.request();
    let q = `SELECT TOP 100 amr.*, amn.model_code, amn.model_version
             FROM gt_analytics.analytic_model_result amr
             JOIN gt_analytics.analytic_model_run amn ON amr.model_run_id = amn.model_run_id
             WHERE 1=1`;
    const sponsorBizId = getSponsorBizId(req.query);
    if (sponsorBizId) {
      request.input('sponsorBizId', sql.NVarChar(36), sponsorBizId);
      q += ' AND amr.' + SPONSOR_BIZ_KEY + ' = @sponsorBizId';
    }
    if (req.query.entity_type) {
      request.input('et', sql.NVarChar(60), req.query.entity_type);
      q += ' AND amr.entity_type = @et';
    }
    q += ' ORDER BY amr.created_at DESC';
    const result = await request.query(q);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[analytics.js] models/results failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/analytics/metrics/definitions
router.get('/metrics/definitions', async (_req, res) => {
  try {
    const result = await getPool('analytics').request()
      .query('SELECT * FROM gt_analytics.metric_definition WHERE is_active = 1 ORDER BY metric_domain, metric_code');
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (e) {
    console.error('[analytics.js] metrics/definitions failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
