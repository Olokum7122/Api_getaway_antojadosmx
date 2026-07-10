'use strict';
const { Router } = require('express');
const { getPool, sql } = require('../db');

const router = Router();

// GET /health
router.get('/', async (_req, res) => {
  const pool = getPool('app');
  if (!pool) {
    return res.status(503).json({ status: 'error', message: 'DB pool not connected' });
  }
  try {
    await pool.request().query('SELECT 1 AS ok');
    res.json({ status: 'ok', db: 'ATLX_GT_APP', ts: new Date().toISOString() });
  } catch (e) {
    console.error('[health.js] health check failed:', e.message);
    res.status(503).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
