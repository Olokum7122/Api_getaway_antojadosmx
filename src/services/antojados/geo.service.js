'use strict';
/**
 * geo.service.js — Servicio de Geografía / Contexto Geoespacial
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Sistema de Geografía y Contexto (Geo)
 * RESPONSABLE:  Orquestar llamadas a geoResolver con mapeo de datos
 *               a través de geoMapper.
 *
 * NO HACE:
 *   - No consulta BD directamente (lo hace geoResolver)
 *   - No contiene lógica de negocio (solo orquestación)
 *
 * FUNCIONES:
 *   listScopes        → listar catálogo de scopes geográficos
 *   searchCities      → buscar ciudades por nombre
 *   resolveBarContext → resolver contexto de barra por coordenadas
 *
 * REFERENCIAS:
 *   - apps-antojados/docs/feed.md (Sección 11.2)
 *   - geoResolver.js, geoMapper.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const geoResolver = require('./geoResolver');
const { mapBarContext, mapCity, mapScope } = require('./geoMapper');

async function listScopes(payload) {
  return (await geoResolver.listScopes(payload)).map(mapScope);
}

async function searchCities(payload) {
  return (await geoResolver.searchCities(payload)).map(mapCity);
}

async function resolveBarContext(payload) {
  return mapBarContext(await geoResolver.resolveBarContext(payload));
}

module.exports = {
  listScopes,
  searchCities,
  resolveBarContext,
};

