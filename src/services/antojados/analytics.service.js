'use strict';
/**
 * analytics.service.js — Servicio de Analíticas
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Analíticas y Métricas (GT Web)
 * RESPONSABLE:  Orquestar llamadas a analyticsResolver con mapeo
 *               de datos a través de analyticsMapper.
 *
 * NO HACE:
 *   - No consulta BD directamente (lo hace analyticsResolver)
 *   - No contiene lógica de negocio (solo orquestación)
 *
 * FUNCIONES:
 *   getEngagement, getPlaceScores, getUserScore, getUserSummary,
 *   getTenantSummary, getSponsorMetrics, getTilePerformance
 *
 * REFERENCIAS:
 *   - analyticsResolver.js, analyticsMapper.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const analyticsResolver = require('./analyticsResolver');
const {
  mapEngagementList,
  mapPlaceScoreList,
  mapUserScore,
  mapUserSummary,
  mapTenantSummaryList,
  mapSponsorMetricsList,
  mapTilePerformanceList,
} = require('./analyticsMapper');

async function getEngagement(payload) {
  return mapEngagementList(await analyticsResolver.getEngagement(payload));
}

async function getPlaceScores(payload) {
  return mapPlaceScoreList(await analyticsResolver.getPlaceScores(payload));
}

async function getUserScore(payload) {
  return mapUserScore(await analyticsResolver.getUserScore(payload));
}

async function getUserSummary(payload) {
  return mapUserSummary(await analyticsResolver.getUserSummary(payload));
}

async function getTenantSummary(payload) {
  return mapTenantSummaryList(await analyticsResolver.getTenantSummary(payload));
}

async function getSponsorMetrics(payload) {
  return mapSponsorMetricsList(await analyticsResolver.getSponsorMetrics(payload));
}

async function getTilePerformance(payload) {
  return mapTilePerformanceList(await analyticsResolver.getTilePerformance(payload));
}

module.exports = {
  getEngagement,
  getPlaceScores,
  getUserScore,
  getUserSummary,
  getTenantSummary,
  getSponsorMetrics,
  getTilePerformance,
};
