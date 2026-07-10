'use strict';

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
  const base = String(process.env.GT_API_BASE_URL || '').trim();
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function buildForwardHeaders(sourceHeaders = {}) {
  const headers = {};
  for (const [key, value] of Object.entries(sourceHeaders || {})) {
    const normalized = String(key || '').toLowerCase();
    if (!FORWARDED_HEADERS.has(normalized)) continue;
    if (value === undefined) continue;
    headers[normalized] = value;
  }
  return headers;
}

async function callGt({ path, method = 'GET', payload, sourceHeaders }) {
  const base = getGtBaseUrl();
  if (!base) {
    const error = new Error('GT_API_BASE_URL no configurado');
    error.status = 503;
    throw error;
  }

  const headers = buildForwardHeaders(sourceHeaders);
  const init = { method, headers };

  if (method !== 'GET' && method !== 'HEAD' && payload !== undefined) {
    init.body = JSON.stringify(payload);
    if (!headers['content-type']) headers['content-type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(`${base}${path}`, init);
  } catch (err) {
    const error = new Error(`gt_efirma_upstream_unreachable: ${err.message}`);
    error.status = 502;
    throw error;
  }

  const raw = await response.text();
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const data = contentType.includes('application/json')
    ? (() => {
        try { return raw ? JSON.parse(raw) : {}; } catch { return { raw }; }
      })()
    : { raw };

  if (!response.ok) {
    const message = data?.error || data?.detail || `GT upstream failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.detail = data;
    throw error;
  }

  return data;
}

function normalizePayload(raw = {}) {
  if (!raw || typeof raw !== 'object') return {};
  if (raw.ok === true) return raw;
  return { ok: true, ...raw };
}

async function createElectronicSignature(payload, sourceHeaders) {
  const data = await callGt({
    path: '/api/v1/antojados/gt/efirma/create',
    method: 'POST',
    payload,
    sourceHeaders,
  });
  return normalizePayload(data);
}

async function sendElectronicSignatureActivation(payload, sourceHeaders) {
  const data = await callGt({
    path: '/api/v1/antojados/gt/efirma/send-activation',
    method: 'POST',
    payload,
    sourceHeaders,
  });
  return normalizePayload(data);
}

async function acceptElectronicSignatureActivation(payload, sourceHeaders) {
  const data = await callGt({
    path: '/api/v1/antojados/gt/efirma/accept-activation',
    method: 'POST',
    payload,
    sourceHeaders,
  });
  return normalizePayload(data);
}

async function authorizeElectronicSignatureAction(payload, sourceHeaders) {
  const data = await callGt({
    path: '/api/v1/antojados/gt/efirma/authorize-action',
    method: 'POST',
    payload,
    sourceHeaders,
  });
  return normalizePayload(data);
}

async function getElectronicSignatureStatus(instanceId, sourceHeaders) {
  const encoded = encodeURIComponent(String(instanceId || '').trim());
  const data = await callGt({
    path: `/api/v1/antojados/gt/efirma/status?instance_id=${encoded}`,
    method: 'GET',
    sourceHeaders,
  });
  return normalizePayload(data);
}

module.exports = {
  createElectronicSignature,
  sendElectronicSignatureActivation,
  acceptElectronicSignatureActivation,
  authorizeElectronicSignatureAction,
  getElectronicSignatureStatus,
};
