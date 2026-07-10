'use strict';
/**
 * rewardsMapper.js — Mappers de Recompensas / Cupones
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Recompensas y Cupones (rwd_*)
 * RESPONSABLE:  Transformar/validar datos de campañas, elegibilidades
 *               y redenciones de recompensas.
 *
 * NO HACE:
 *   - No consulta BD (lo hacen los resolvers)
 *   - No contiene lógica de negocio (solo validación de presencia)
 *
 * MAPEADORES:
 *   mapCampaignList          → valida array de campañas
 *   mapCampaignDetail        → valida campaign_id presente
 *   mapEligibilityList       → valida array de elegibilidades
 *   mapRedeemRewardResult    → valida redemption_id + redemption_code
 *   mapUserRedemptionsList   → valida array de redenciones
 *
 * REFERENCIAS:
 *   - rewardsResolver.js, rewards.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name}: se esperaba array`);
  }
  return value;
}

function mapCampaignList(rows) { return assertArray(rows, 'rewardsMapper.mapCampaignList'); }

function mapCampaignDetail(raw) {
  if (raw == null) return null;
  if (!raw.campaign_id) throw new Error('rewardsMapper.mapCampaignDetail: campaign_id faltante');
  return raw;
}

function mapEligibilityList(rows) { return assertArray(rows, 'rewardsMapper.mapEligibilityList'); }

function mapRedeemRewardResult(raw) {
  if (raw == null) return null;
  if (!raw.redemption_id || !raw.redemption_code) throw new Error('rewardsMapper.mapRedeemRewardResult: payload incompleto');
  return raw;
}

function mapUserRedemptionsList(rows) { return assertArray(rows, 'rewardsMapper.mapUserRedemptionsList'); }

module.exports = {
  mapCampaignList,
  mapCampaignDetail,
  mapEligibilityList,
  mapRedeemRewardResult,
  mapUserRedemptionsList,
};