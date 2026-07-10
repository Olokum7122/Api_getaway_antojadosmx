'use strict';
/**
 * ratingMapper.js — Mapper de Frases de Calificación
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Calificaciones (Ratings / Reviews)
 * RESPONSABLE:  Validar array de frases de calificación.
 *
 * MAPEADOR:
 *   mapRatingPhraseList → valida que rows sea array
 *
 * REFERENCIAS:
 *   - ratingResolver.js, rating.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

function mapRatingPhraseList(rows) {
  if (!Array.isArray(rows)) {
    throw new Error('ratingMapper.mapRatingPhraseList: se esperaba array');
  }
  return rows;
}

module.exports = { mapRatingPhraseList };