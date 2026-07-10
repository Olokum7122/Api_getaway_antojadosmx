'use strict';
/**
 * rating.service.js — Servicio de Frases de Calificación
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Calificaciones (Ratings / Reviews)
 * RESPONSABLE:  Obtener catálogo de frases predefinidas para calificaciones
 *               de posts/social (rating_phrase).
 *
 * FUNCIONES:
 *   getRatingPhrases → obtiene frases por dimensión (dim, level, phrase)
 *
 * REFERENCIAS:
 *   - ratingResolver.js, ratingMapper.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const ratingResolver = require('./ratingResolver');
const { mapRatingPhraseList } = require('./ratingMapper');

async function getRatingPhrases() {
  return mapRatingPhraseList(await ratingResolver.getRatingPhrases());
}

module.exports = { getRatingPhrases };
