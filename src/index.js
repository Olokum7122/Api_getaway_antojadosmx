'use strict';
/**
 * index.js (raíz) — API Gateway AntojadosMX
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — API Gateway
 * RESPONSABLE:  Configuración principal del servidor Express.
 *               Monta middlewares globales (CORS, JSON, proxies),
 *               routers del dominio Antojados, y documentación Swagger/OpenAPI.
 *
 * PROXIES CONFIGURADOS:
 *   /api/media/*            → Media Engine V3 (puerto 4100)
 *   /api/v1/explorer/*      → Explorer API (puerto 4101)
 *   /api/v1/antojados/gt/*  → GT API (puerto 4010) — transversal
 *   /api/v1/config/*        → GT API (puerto 4010)
 *   /api/v1/solutions/*     → GT API (puerto 4010)
 *   /api/v1/services/*      → GT API (puerto 4010)
 *   /api/v1/planning/*      → GT API (puerto 4010)
 *   /api/v1/finance/*       → GT API (puerto 4010)
 *   /api/v1/analytics/*     → GT API (puerto 4010)
 *
 * SUB-ROUTERS MONTADOS (solo dominio Antojados):
 *   /api/v1/antojados       → antojadosRouter
 *
 * ARQUITECTURA:
 *   Vertical:   UI → Antojados API → SQL (antojados_core.*)
 *   Transversal: Antojados API → [proxy] → GT API (:4010) → SQL (dorado.*)
 *               Antojados API → [proxy] → Media Engine (:4100) → SQL (me.*)
 *               Antojados API → [proxy] → Explorer API (:4101) → SQL (dorado.*)
 *
 * NO HACE:
 *   - No contiene lógica de negocio de GT (todo se delega vía proxy)
 *   - No escribe en tablas dorado.* (lo hace GT API)
 *   - No procesa multimedia (lo hace Media Engine)
 *
 * REFERENCIAS:
 *   - antojadosmx/docs/feed.md
 *   - PLAN_REESTRUCTURACION_CONSUMO.md
 * ══════════════════════════════════════════════════════════════════════════════
 */
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { connectAll } = require('./db');

const healthRouter       = require('./routes/health');
const antojadosRouter    = require('./routes/v1/antojados');
const app = express();

// ─── GT Base URL ──────────────────────────────────────────────────────
const GT_API_URL = process.env.GT_API_URL || 'http://localhost:4010';

// ─── CORS ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization,X-App-Version,X-App-Env,X-Device-Platform',
  );
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Media Engine Proxy (NUNCA consumido por UI directo) ──────────────
const MEDIA_ENGINE_URL = process.env.MEDIA_ENGINE_URL || 'http://localhost:4100';
app.options('/api/media/*', (req, res) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-App-Version,X-App-Env,X-Device-Platform');
  res.sendStatus(204);
});
app.use(
  '/api/media',
  createProxyMiddleware({
    target: MEDIA_ENGINE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/media': '/api/media' },
    on: {
      proxyReq: (_proxyReq, req) => {
        console.log(`[media-proxy] ${req.method} /api/media${req.url} → ${MEDIA_ENGINE_URL}`);
      },
      proxyRes: (proxyRes, req) => {
        const origin = req.headers.origin || '*';
        proxyRes.headers['Access-Control-Allow-Origin'] = origin;
        proxyRes.headers['Vary'] = 'Origin';
        console.log(`[media-proxy] ${req.method} /api/media${req.url} ← ${proxyRes.statusCode}`);
      },
      error: (err, req, res) => {
        console.error(`[media-proxy] Error: ${err.message}`);
        res.status(502).json({
          error: 'media_engine_unreachable',
          message: 'El servicio de medios no está disponible. Intenta de nuevo.',
        });
      },
    },
  }),
);

// ── Explorer API Proxy ───────────────────────────────────────────────
const EXPLORER_API_URL = process.env.EXPLORER_API_URL || 'http://localhost:4101';
app.use(
  '/api/v1/explorer',
  createProxyMiddleware({
    target: EXPLORER_API_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/explorer': '/api/v1/explorer' },
    on: {
      proxyReq: (_proxyReq, req) => {
        console.log(`[explorer-proxy] ${req.method} /api/v1/explorer${req.url} → ${EXPLORER_API_URL}`);
      },
      proxyRes: (proxyRes, req) => {
        const origin = req.headers.origin || '*';
        proxyRes.headers['Access-Control-Allow-Origin'] = origin;
        proxyRes.headers['Vary'] = 'Origin';
        console.log(`[explorer-proxy] ${req.method} /api/v1/explorer${req.url} ← ${proxyRes.statusCode}`);
      },
      error: (err, req, res) => {
        console.error(`[explorer-proxy] Error: ${err.message}`);
        res.status(502).json({
          error: 'explorer_api_unreachable',
          message: 'El servicio Explorer no está disponible.',
        });
      },
    },
  }),
);

// ── GT API Proxy (transversal: Antojados API → GT API) ──────────────
// V4 resuelta: GT ya no se monta localmente, se delega a GT API.
// Los módulos GT (config, solutions, services, planning, finance, analytics)
// corren en su propio proceso Express independiente (:4010).
// V5 resuelta: El frontend sigue consumiendo /api/v1/antojados/gt/*
// pero ahora este Gateway proxea a GT API en vez de resolver localmente.
function createGtProxy() {
  return createProxyMiddleware({
    target: GT_API_URL,
    changeOrigin: true,
    on: {
      proxyReq: (_proxyReq, req) => {
        console.log(`[gt-proxy] ${req.method} ${req.path} → ${GT_API_URL}`);
      },
      proxyRes: (proxyRes, req) => {
        const origin = req.headers.origin || '*';
        proxyRes.headers['Access-Control-Allow-Origin'] = origin;
        proxyRes.headers['Vary'] = 'Origin';
        console.log(`[gt-proxy] ${req.method} ${req.path} ← ${proxyRes.statusCode}`);
      },
      error: (err, req, res) => {
        console.error(`[gt-proxy] Error: ${err.message}`);
        res.status(502).json({
          error: 'gt_api_unreachable',
          message: 'El servicio GT no está disponible.',
        });
      },
    },
  });
}

// Módulos GT → proxy a GT API (:4010)
app.use('/api/v1/config',      createGtProxy());
app.use('/api/v1/solutions',   createGtProxy());
app.use('/api/v1/services',    createGtProxy());
app.use('/api/v1/planning',    createGtProxy());
app.use('/api/v1/finance',     createGtProxy());
app.use('/api/v1/analytics',   createGtProxy());
app.use('/api/v1/antojados/zonad', createGtProxy());

// ── JSON parser ──────────────────────────────────────────────────────
app.use(express.json({ limit: '220mb' }));

app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'El video es demasiado grande para subirlo en base64. Recortalo o selecciona uno mas ligero.',
    });
  }
  return next(err);
});

// Servir media subida
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Servir descargas de instalador Android (APK) y landing de update por URL/QR
const downloadsDir = path.join(__dirname, '..', 'downloads');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
app.use('/downloads', express.static(downloadsDir));

// Health
app.use('/health', healthRouter);

// Router único del dominio Antojados (vertical)
app.use('/api/v1/antojados', antojadosRouter);

// Swagger / OpenAPI
try {
  const openApiRaw = fs.readFileSync(path.join(__dirname, '..', 'docs', 'openapi.yaml'), 'utf8');
  const openApiSpec = yaml.load(openApiRaw);
  app.get('/openapi.json', (_req, res) => res.json(openApiSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { explorer: true }));
  console.log('[docs] Swagger disponible en /docs');
} catch (err) {
  console.warn('[docs] No se pudo cargar openapi.yaml:', err.message);
}

// 404 genérico
app.use((req, res) => res.status(404).json({ error: 'endpoint_not_found' }));

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 8010;

connectAll()
  .then(() => {
    app.listen(PORT, HOST, () => console.log(`[api-gateway-antojadosmx] corriendo en ${HOST}:${PORT}`));
  })
  .catch((err) => {
    console.error('[db] Error conectando pools:', err.message);
    app.listen(PORT, HOST, () => console.log(`[api-gateway-antojadosmx] corriendo sin DB en ${HOST}:${PORT}`));
  });