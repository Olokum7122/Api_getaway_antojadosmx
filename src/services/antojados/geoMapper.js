'use strict';
/**
 * geoMapper.js — Mappers de Geografía / Contexto Geoespacial
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Sistema de Geografía y Contexto (Geo)
 * RESPONSABLE:  Transformar/mapear registros de scope levels, ciudades,
 *               items de barra y contexto geoespacial a objetos planos.
 *
 * NO HACE:
 *   - No consulta BD (lo hace geoResolver)
 *   - No contiene lógica de negocio (solo mapeo de datos)
 *
 * MAPEADORES:
 *   mapScope    → scope_code, scope_level, scope_label, parent, city, zone
 *   mapCity     → city_scope_code, city_code, city_label, zone, country
 *   mapBarItem  → order, scope_level, scope_code, enabled, isDefault
 *   mapContext  → device, coverage, country, zone, city, defaults
 *   mapBarContext → wrapper que mapea context + normalBar + barrioBar
 *
 * REFERENCIAS:
 *   - apps-antojados/docs/feed.md (Sección 11.2: GEO)
 *   - geoResolver.js, geo.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

function toBool(value) {
  return value === true || Number(value || 0) === 1;
}

function toNumberOrNull(value) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapScope(row) {
  return {
    scopeCode: row.scope_code,
    scopeLevel: row.scope_level,
    scopeLabel: row.scope_label,
    parentScopeCode: row.parent_scope_code || null,
    countryCode: row.country_code || null,
    cityCode: row.city_code || null,
    zoneCode: row.zone_code || null,
    status: row.status,
  };
}

function mapCity(row) {
  return {
    cityScopeCode: row.city_scope_code,
    cityCode: row.city_code,
    cityLabel: row.city_label,
    zoneScopeCode: row.zone_scope_code,
    zoneCode: row.zone_code,
    zoneLabel: row.zone_label,
    countryScopeCode: row.country_scope_code,
    countryCode: row.country_code,
    countryLabel: row.country_label,
  };
}

function mapBarItem(row) {
  return {
    order: Number(row.item_order || 0),
    scopeLevel: row.scope_level,
    scopeCode: row.scope_code || null,
    scopeLabel: row.scope_label || null,
    enabled: toBool(row.enabled),
    isDefault: toBool(row.is_default),
  };
}

function mapContext(row) {
  if (!row) return null;

  return {
    deviceResolved: toBool(row.device_resolved),
    deviceInCoverage: toBool(row.device_in_coverage),
    countryScopeCode: row.country_scope_code,
    countryCode: row.country_code,
    countryLabel: row.country_label,
    zoneScopeCode: row.zone_scope_code || null,
    zoneCode: row.zone_code || null,
    zoneLabel: row.zone_label || null,
    cityScopeCode: row.city_scope_code || null,
    cityCode: row.city_code || null,
    cityLabel: row.city_label || null,
    normalDefaultScopeLevel: row.normal_default_scope_level,
    normalDefaultScopeCode: row.normal_default_scope_code,
    barrioDefaultScopeLevel: row.barrio_default_scope_level,
    barrioDefaultScopeCode: row.barrio_default_scope_code,
    globalAvailable: toBool(row.global_available),
    searchRequiredForZoneCity: toBool(row.search_required_for_zone_city),
    deviceDistanceKm: toNumberOrNull(row.device_distance_km),
    detectionConfidence: toNumberOrNull(row.detection_confidence),
    detectionSourceType: row.detection_source_type || null,
  };
}

function mapBarContext(payload) {
  return {
    context: mapContext(payload.context),
    normalBar: payload.normalBar.map(mapBarItem),
    barrioBar: payload.barrioBar.map(mapBarItem),
  };
}

module.exports = {
  mapBarContext,
  mapCity,
  mapScope,
};

