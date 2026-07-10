'use strict';
/**
 * analyticsMapper.js — Mappers de Analíticas (GT Web)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Analíticas y Métricas (GT Web)
 * RESPONSABLE:  Transformar/validar registros de engagement, place scores,
 *               user scores, tenant summary, sponsor metrics y tile performance.
 *
 * NO HACE:
 *   - No consulta BD (lo hace analyticsResolver)
 *   - No contiene lógica de negocio (solo validación de arrays/objetos)
 *
 * MAPEADORES:
 *   mapEngagementList      → via assertArray
 *   mapPlaceScoreList      → via assertArray
 *   mapUserScore           → valida user_id presente
 *   mapUserSummary         → valida user_id presente
 *   mapTenantSummaryList   → via assertArray
 *   mapSponsorMetricsList  → via assertArray
 *   mapTilePerformanceList → via assertArray
 *
 * REFERENCIAS:
 *   - analyticsResolver.js, analytics.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

function assertArray(rows, name) {
  if (!Array.isArray(rows)) {
    throw new Error(`${name}: se esperaba array - ${typeof rows}`);
  }
  return rows;
}

function mapEngagementList(rows) {
  return assertArray(rows, 'analyticsMapper.mapEngagementList');
}

function mapPlaceScoreList(rows) {
  return assertArray(rows, 'analyticsMapper.mapPlaceScoreList');
}

function mapUserScore(raw) {
  if (raw == null) return null;
  if (!raw?.user_id) {
    throw new Error(`analyticsMapper.mapUserScore: user_id faltante - ${JSON.stringify(raw)}`);
  }
  return raw;
}

function mapUserSummary(raw) {
  if (raw == null) return null;
  if (!raw?.user_id) {
    throw new Error(`analyticsMapper.mapUserSummary: user_id faltante - ${JSON.stringify(raw)}`);
  }
  return raw;
}

function mapTenantSummaryList(rows) {
  return assertArray(rows, 'analyticsMapper.mapTenantSummaryList');
}

function mapSponsorMetricsList(rows) {
  return assertArray(rows, 'analyticsMapper.mapSponsorMetricsList');
}

function mapTilePerformanceList(rows) {
  return assertArray(rows, 'analyticsMapper.mapTilePerformanceList');
}

module.exports = {
  mapEngagementList,
  mapPlaceScoreList,
  mapUserScore,
  mapUserSummary,
  mapTenantSummaryList,
  mapSponsorMetricsList,
  mapTilePerformanceList,
};
