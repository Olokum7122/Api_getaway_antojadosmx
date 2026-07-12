'use strict';
/**
 * geoResolver.js — Resolver de Geografía / Contexto Geoespacial
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Sistema de Geografía y Contexto (Geo)
 * RESPONSABLE:  Consultar scope levels, ciudades, y resolver contexto
 *               de barra (ciudad/barrio) basado en coordenadas geográficas
 *               usando stored procedures de antojados_core.
 *
 * NO HACE:
 *   - No transforma datos (lo hace geoMapper)
 *   - No expone rutas HTTP (lo hace geo.routes.js)
 *
 * FUNCIONES:
 *   listScopes        → SP antojados_core.usp_geo_scope_catalog_list
 *   searchCities      → SP antojados_core.usp_geo_city_search
 *   resolveBarContext → SP antojados_core.usp_geo_bar_context_resolve
 *
 * REFERENCIAS:
 *   - antojadosmx/docs/feed.md (Sección 11.2: Estructura del Feed — GEO)
 *   - geoMapper.js, geo.service.js, geo.routes.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql } = require('./_shared');

async function listScopes({ scope_level, parent_scope_code, q, limit }) {
  const result = await getPool('antojados').request()
    .input('scope_level', sql.NVarChar(20), scope_level || null)
    .input('parent_scope_code', sql.NVarChar(64), parent_scope_code || null)
    .input('q', sql.NVarChar(120), q || null)
    .input('limit', sql.Int, limit || 100)
    .execute('antojados_core.usp_geo_scope_catalog_list');

  return result.recordset;
}

async function searchCities({ q, limit }) {
  const result = await getPool('antojados').request()
    .input('q', sql.NVarChar(120), q || null)
    .input('limit', sql.Int, limit || 50)
    .execute('antojados_core.usp_geo_city_search');

  return result.recordset;
}

async function resolveBarContext({ lat, lng }) {
  const normalizedLat = lat == null || lat === '' ? null : Number(lat);
  const normalizedLng = lng == null || lng === '' ? null : Number(lng);

  const result = await getPool('antojados').request()
    .input('lat', sql.Decimal(9, 6), Number.isFinite(normalizedLat) ? normalizedLat : null)
    .input('lng', sql.Decimal(9, 6), Number.isFinite(normalizedLng) ? normalizedLng : null)
    .execute('antojados_core.usp_geo_bar_context_resolve');

  return {
    context: result.recordsets[0]?.[0] || null,
    normalBar: result.recordsets[1] || [],
    barrioBar: result.recordsets[2] || [],
  };
}

module.exports = {
  listScopes,
  searchCities,
  resolveBarContext,
};

