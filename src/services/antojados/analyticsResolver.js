'use strict';
/**
 * analyticsResolver.js — Resolver de Analíticas (GT Web)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Analíticas y Métricas (GT Web)
 * RESPONSABLE:  Consultar engagement, place scores, user scores,
 *               tenant summary, sponsor metrics y tile performance
 *               desde la base de datos de analíticas (esquema gt_antojados).
 *
 * NO HACE:
 *   - No transforma datos (lo hace analyticsMapper)
 *   - No expone rutas HTTP
 *
 * TABLAS QUE TOCA:
 *   gt_antojados.usp_api_engagement_v2         → engagement
 *   gt_antojados.usp_api_place_scores_v2        → place scores
 *   gt_antojados.food_user_score_pmonth         → user score
 *   gt_antojados.analytics_antojados_user_summary → user summary
 *   gt_antojados.usp_api_tenant_summary_v2      → tenant summary
 *   gt_antojados.usp_api_sponsor_metrics_v2     → sponsor metrics
 *   gt_antojados.food_tile_performance_pmonth   → tile performance
 *
 * REFERENCIAS:
 *   - analyticsMapper.js, analytics.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql } = require('./_shared');
const { normalizeScopeFilter } = require('./_scope');

async function getEngagement({ id, city_code, year, month }) {
  const scope = normalizeScopeFilter(arguments[0] || {});
  const result = await getPool('analytics').request()
    .input('id', sql.NVarChar(64), id || null)
    .input('scope_level', sql.NVarChar(20), scope.scope_level || null)
    .input('scope_code', sql.NVarChar(64), scope.scope_code || null)
    .input('city_code', sql.NVarChar(30), scope.city_code_legacy || null)
    .input('year', sql.SmallInt, year ? parseInt(year, 10) : null)
    .input('month', sql.TinyInt, month ? parseInt(month, 10) : null)
    .execute('gt_antojados.usp_api_engagement_v2');
  return result.recordset;
}

async function getPlaceScores(payload) {
  const { year, month, category, limit } = payload;
  const scope = normalizeScopeFilter(payload);
  const result = await getPool('analytics').request()
    .input('scope_level', sql.NVarChar(20), scope.scope_level || null)
    .input('scope_code', sql.NVarChar(64), scope.scope_code || null)
    .input('city_code', sql.NVarChar(30), scope.city_code_legacy || null)
    .input('year', sql.SmallInt, year ? parseInt(year, 10) : null)
    .input('month', sql.TinyInt, month ? parseInt(month, 10) : null)
    .input('category', sql.NVarChar(80), category || null)
    .input('limit', sql.Int, limit)
    .execute('gt_antojados.usp_api_place_scores_v2');
  return result.recordset;
}

async function getUserScore({ user_id, year, month }) {
  const now = new Date();
  const y = parseInt(year || now.getFullYear(), 10);
  const m = parseInt(month || now.getMonth() + 1, 10);
  const result = await getPool('analytics').request()
    .input('userId', sql.NVarChar(64), user_id)
    .input('year', sql.SmallInt, y)
    .input('month', sql.TinyInt, m)
    .query(`
      SELECT user_id, period_year, period_month, city_code,
             post_count, likes_total, comments_total, shares_total,
             verified_visits_count, unique_places_visited,
             rewards_earned, engagement_score, reputation_rank_in_city,
             materialized_at
      FROM gt_antojados.food_user_score_pmonth
      WHERE user_id = @userId AND period_year = @year AND period_month = @month
  `);
  return result.recordset[0] || null;
}

async function getUserSummary({ user_id }) {
  const result = await getPool('analytics').request()
    .input('userId', sql.NVarChar(64), user_id)
    .query(`
      SELECT user_id, display_name, username, city_code, avatar_url,
             reputation_level, verified_reviewer,
             period_year, period_month,
             posts_total, likes_received_total, comments_received_total, shares_received_total,
             saved_places_total, following_total, following_users_total, following_places_total,
             followers_total,
             posts_created_month, likes_given_month, comments_made_month, shares_made_month,
             verified_visits_count, unique_places_visited, rewards_earned,
             engagement_score, reputation_rank_in_city, materialized_at
      FROM gt_antojados.analytics_antojados_user_summary
      WHERE user_id = @userId
    `);
  return result.recordset[0] || null;
}

async function getTenantSummary(payload) {
  const { id, tenant_instance_id, category, year, month, limit } = payload;
  const scope = normalizeScopeFilter(payload);
  const result = await getPool('analytics').request()
    .input('tenant_instance_id', sql.NVarChar(64), tenant_instance_id || null)
    .input('id', sql.NVarChar(64), id || null)
    .input('scope_level', sql.NVarChar(20), scope.scope_level || null)
    .input('scope_code', sql.NVarChar(64), scope.scope_code || null)
    .input('city_code', sql.NVarChar(30), scope.city_code_legacy || null)
    .input('category', sql.NVarChar(80), category || null)
    .input('year', sql.SmallInt, year ? parseInt(year, 10) : null)
    .input('month', sql.TinyInt, month ? parseInt(month, 10) : null)
    .input('limit', sql.Int, limit)
    .execute('gt_antojados.usp_api_tenant_summary_v2');
  return result.recordset;
}

async function getSponsorMetrics(payload) {
  const { tenant_instance_id, id, category, feed_type, year, month, limit } = payload;
  const scope = normalizeScopeFilter(payload);
  const result = await getPool('analytics').request()
    .input('tenant_instance_id', sql.NVarChar(64), tenant_instance_id || null)
    .input('id', sql.NVarChar(64), id || null)
    .input('scope_level', sql.NVarChar(20), scope.scope_level || null)
    .input('scope_code', sql.NVarChar(64), scope.scope_code || null)
    .input('city_code', sql.NVarChar(30), scope.city_code_legacy || null)
    .input('category', sql.NVarChar(80), category || null)
    .input('feed_type', sql.NVarChar(40), feed_type || null)
    .input('year', sql.SmallInt, year ? parseInt(year, 10) : null)
    .input('month', sql.TinyInt, month ? parseInt(month, 10) : null)
    .input('limit', sql.Int, limit)
    .execute('gt_antojados.usp_api_sponsor_metrics_v2');
  return result.recordset;
}

async function getTilePerformance({ tenant_id, tile_id, placement, city_code, year, month, limit }) {
  const req = getPool('analytics').request().input('limit', sql.Int, limit);
  let where = 'WHERE 1=1';
  if (tenant_id) { req.input('tenantId', sql.NVarChar(64), tenant_id); where += ' AND tenant_id = @tenantId'; }
  if (tile_id) { req.input('tileId', sql.NVarChar(64), tile_id); where += ' AND tile_id = @tileId'; }
  if (placement) { req.input('placement', sql.NVarChar(50), placement); where += ' AND placement = @placement'; }
  if (city_code) { req.input('cityCode', sql.NVarChar(30), city_code); where += ' AND city_code = @cityCode'; }
  if (year) { req.input('year', sql.SmallInt, parseInt(year, 10)); where += ' AND period_year = @year'; }
  if (month) { req.input('month', sql.TinyInt, parseInt(month, 10)); where += ' AND period_month = @month'; }
  const result = await req.query(`
    SELECT TOP (@limit)
           tile_id, tenant_id, placement, city_code,
           period_year, period_month,
           views_count, clicks_count, follows_count, ctr, follow_rate, materialized_at
    FROM gt_antojados.food_tile_performance_pmonth
    ${where}
    ORDER BY period_year DESC, period_month DESC, views_count DESC, tile_id ASC
  `);
  return result.recordset;
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
