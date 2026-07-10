'use strict';
/**
 * index.js (raíz) — API Gateway AntojadosMX
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — API Gateway
 * RESPONSABLE:  Configuración principal del servidor Express.
 *               Monta middlewares globales (CORS, JSON, proxies),
 *               routers de módulos (antojados, config, analytics, etc.),
 *               y documentación Swagger/OpenAPI.
 *
 * PROXIES CONFIGURADOS:
 *   /api/media/*       → Media Engine V3 (puerto 4100)
 *   /api/v1/explorer/* → Explorer API (puerto 4101)
 *
 * SUB-ROUTERS MONTADOS:
 *   /api/v1/config      → configRouter
 *   /api/v1/solutions   → solutionsRouter
 *   /api/v1/services    → servicesRouter
 *   /api/v1/planning    → planningRouter
 *   /api/v1/finance     → financeRouter
 *   /api/v1/analytics   → analyticsRouter
 *   /api/v1/antojados   → antojadosRouter
 *
 * REFERENCIAS:
 *   - apps-antojados/docs/feed.md
 *   - docs/feed.auditoria.progreso.md
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
const configRouter       = require('./routes/v1/config');
const solutionsRouter    = require('./routes/v1/solutions');
const servicesRouter     = require('./routes/v1/services');
const planningRouter     = require('./routes/v1/planning');
const financeRouter      = require('./routes/v1/finance');
const analyticsRouter    = require('./routes/v1/analytics');
const antojadosRouter    = require('./routes/v1/antojados');
const zonadRouter        = require('./routes/v1/zonad');
const app = express();

// CORS — permite peticiones desde WebViews (Capacitor/Android/Web) y navegadores
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

// ── Media Engine Proxy ──
// Redirige /api/media/* al Media Engine V3 (puerto 4100).
// NOTA: OPTIONS debe responderse antes del proxy para que CORS funcione
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

// ── Explorer API Proxy ──
// Redirige /api/v1/explorer/* al Explorer API (puerto 4101).
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

// Health (sin versión para facilidad de monitoreo)
app.use('/health', healthRouter);

// Módulos GT bajo /api/v1
app.use('/api/v1/config',    configRouter);
app.use('/api/v1/solutions', solutionsRouter);
app.use('/api/v1/services',  servicesRouter);
app.use('/api/v1/planning',  planningRouter);
app.use('/api/v1/finance',   financeRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/antojados', antojadosRouter);
app.use('/api/v1/antojados/zonad', zonadRouter);

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
