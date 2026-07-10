'use strict';
/**
 * _helpers.js — Utilidades compartidas para rutas de Antojados
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — API Gateway
 * RESPONSABLE:  Proveer funciones helper reutilizables para los route handlers
 *               del dominio Antojados.
 *
 * FUNCIONES:
 *   parsePage(q) → { page, limit, offset }  — paginación desde query params
 *   send(res, promise, status)              — enviar respuesta JSON estándar
 *
 * NO HACE:
 *   - No contiene lógica de negocio
 *   - No depende de ningún resolver/mapper en particular
 *
 * REFERENCIAS:
 *   - apps-antojados/docs/feed.md
 * ══════════════════════════════════════════════════════════════════════════════
 */

function parsePage(q) {
  const page  = Math.max(1, parseInt(q.page  || 1,  10));
  const limit = Math.min(100, Math.max(1, parseInt(q.limit || 20, 10)));
  return { page, limit, offset: (page - 1) * limit };
}

function send(res, promise, status = 200) {
  promise
    .then(data => data != null ? res.status(status).json(data) : res.status(404).json({ error: 'not_found' }))
    .catch(e  => res.status(e.status || 500).json({ error: e.message }));
}

module.exports = { parsePage, send };

