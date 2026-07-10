'use strict';
const { Router } = require('express');
const router = Router();

// GT API proxy — redirige a GT_API_BASE_URL si está configurado
const GT_API_BASE_URL = process.env.GT_API_BASE_URL || null;

if (GT_API_BASE_URL) {
  const { createProxyMiddleware } = require('http-proxy-middleware');
  router.use('/gt', createProxyMiddleware({
    target: GT_API_BASE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/antojados/gt': '/api/v1/gt' },
  }));
}

module.exports = router;