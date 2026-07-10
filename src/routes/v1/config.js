'use strict';
const { Router } = require('express');

const router = Router();

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

// Owner unico: GT API. Este router no mantiene logica local para evitar revivir endpoints legacy.
router.use(async (req, res) => {
  const base = getGtBaseUrl();
  if (!base) {
    return res.status(503).json({ error: 'gt_proxy_not_configured' });
  }

  const targetUrl = `${base}${req.originalUrl}`;
  const headers = buildForwardHeaders(req);
  const init = { method: req.method, headers };

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
    init.body = JSON.stringify(req.body);
    if (!headers['content-type']) headers['content-type'] = 'application/json';
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const raw = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', contentType);
    if (!raw) return res.end();
    if (!contentType.includes('application/json')) return res.send(raw);

    try {
      return res.send(JSON.parse(raw));
    } catch (err) {
      console.error('[config.proxy] json parse failed:', err.message);
      return res.send(raw);
    }
  } catch (err) {
    console.error('[config.proxy] gt forward failed:', err.message);
    return res.status(502).json({
      error: 'gt_proxy_unreachable',
      detail: err.message,
    });
  }
});

module.exports = router;
