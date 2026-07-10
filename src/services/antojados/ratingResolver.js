'use strict';
/**
 * ratingResolver.js — Resolver de Frases de Calificación
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Calificaciones (Ratings / Reviews)
 * RESPONSABLE:  Consultar catálogo de frases de calificación desde
 *               antojados_core.rating_phrase.
 *
 * TABLA QUE TOCA:
 *   antojados_core.rating_phrase → frases por dimensión y nivel
 *
 * REFERENCIAS:
 *   - ratingMapper.js, rating.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool } = require('../antojados/_shared');

async function getRatingPhrases() {
  const result = await getPool('antojados').request().query(
    `SELECT dim, level, phrase
     FROM antojados_core.rating_phrase
     ORDER BY dim, level`
  );
  return result.recordset;
}

module.exports = { getRatingPhrases };