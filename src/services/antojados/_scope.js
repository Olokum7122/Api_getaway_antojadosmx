'use strict';
/**
 * _scope.js — Normalización de Filtros Geográficos
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Geo / Alcance Geográfico
 * RESPONSABLE:  Normalizar los parámetros scope_level / scope_code / city_code
 *               al formato canónico que esperan los queries de feed y geo.
 *
 * NO HACE:
 *   - No consulta BD
 *   - No resuelve contexto de usuario (lo hace geoResolver)
 *   - No valida contra catálogos (solo sintaxis)
 *
 * SCOPE_LEVELS VÁLIDOS:
 *   global, mexico, zona, metro, tu_zona, ciudad
 *
 * NOTA: 'metro' y 'tu_zona' se normalizan a 'zona' internamente.
 *       Estos niveles no están documentados en feed.md §11.2
 *       pero existen por compatibilidad con el frontend existente.
 *
 ══════════════════════════════════════════════════════════════════════════════
 */
const VALID_SCOPE_LEVELS = new Set(['global', 'mexico', 'zona', 'metro', 'tu_zona', 'ciudad']);

function normalizeScopeFilter(payload = {}) {
  const rawLevel = String(payload.scope_level || '').trim().toLowerCase();
  const rawCode = payload.scope_code == null ? null : String(payload.scope_code).trim();
  const legacyCityCode = payload.city_code == null ? null : String(payload.city_code).trim();

  if (VALID_SCOPE_LEVELS.has(rawLevel)) {
    if (rawLevel === 'global') {
      return { scope_level: 'global', scope_code: null, city_code_legacy: legacyCityCode || null };
    }
    if (rawLevel === 'mexico') {
      return { scope_level: 'mexico', scope_code: rawCode || null, city_code_legacy: legacyCityCode || null };
    }
    if (rawLevel === 'zona' || rawLevel === 'metro' || rawLevel === 'tu_zona') {
      return {
        scope_level: 'zona',
        scope_code: rawCode || null,
        city_code_legacy: legacyCityCode || null,
      };
    }
    return {
      scope_level: rawLevel,
      scope_code: rawCode || null,
      city_code_legacy: legacyCityCode || null,
    };
  }

  return {
    scope_level: null,
    scope_code: null,
    city_code_legacy: null,
  };
}

module.exports = { normalizeScopeFilter };
