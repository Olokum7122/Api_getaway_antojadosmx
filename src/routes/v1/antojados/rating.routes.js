'use strict';
/**
 * rating.routes.js — Rutas de Frases de Calificación
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Calificaciones (Ratings / Reviews)
 * RESPONSABLE:  Exponer endpoint REST para obtener frases predefinidas
 *               de calificación.
 *
 * ENDPOINTS:
 *   GET /rating-phrases → catálogo de frases por dimensión y nivel
 *
 * REFERENCIAS:
 *   - rating.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { Router } = require('express');
const svc = require('../../../services/antojados/rating.service');
const { send } = require('./_helpers');

const router = Router();

// GET /api/v1/antojados/rating-phrases
router.get('/rating-phrases', (req, res) => {
  send(res, svc.getRatingPhrases());
});

module.exports = router;
