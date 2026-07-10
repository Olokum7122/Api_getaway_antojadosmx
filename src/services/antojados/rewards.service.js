'use strict';
/**
 * rewards.service.js — Servicio de Recompensas / Cupones
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Recompensas y Cupones (rwd_*)
 * RESPONSABLE:  Orquestar llamadas a rewardsResolver con mapeo/validación
 *               de datos a través de rewardsMapper.
 *
 * NO HACE:
 *   - No consulta BD directamente (lo hace rewardsResolver)
 *   - No contiene lógica de negocio (solo orquestación)
 *
 * FUNCIONES:
 *   listCampaigns, getCampaign, listEligibility,
 *   redeemReward, listUserRedemptions
 *
 * REFERENCIAS:
 *   - rewardsResolver.js, rewardsMapper.js
  * ══════════════════════════════════════════════════════════════════════════════
 */
const rewardsResolver = require('./rewardsResolver');

const {
  mapCampaignList,
  mapCampaignDetail,
  mapEligibilityList,
  mapRedeemRewardResult,
  mapUserRedemptionsList,
} = require('./rewardsMapper');

async function listCampaigns(payload) {
  return mapCampaignList(await rewardsResolver.listCampaigns(payload));
}

async function getCampaign(campaignId) {
  return mapCampaignDetail(await rewardsResolver.getCampaign(campaignId));
}

async function listEligibility(payload) {
  return mapEligibilityList(await rewardsResolver.listEligibility(payload));
}

async function redeemReward(payload) {
  return mapRedeemRewardResult(await rewardsResolver.redeemReward(payload));
}

async function listUserRedemptions(payload) {
  return mapUserRedemptionsList(await rewardsResolver.listUserRedemptions(payload));
}

module.exports = { listCampaigns, getCampaign, listEligibility, redeemReward, listUserRedemptions };
