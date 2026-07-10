'use strict';
/**
 * rewardsResolver.js — Resolver de Recompensas / Cupones
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Recompensas y Cupones (rwd_*)
 * RESPONSABLE:  CRUD de campañas de recompensas, consulta de elegibilidad,
 *               y proceso de redención con transacciones.
 *
 * NO HACE:
 *   - No maneja places/social (lo hacen placesResolver/socialResolver)
 *
 * TABLAS QUE TOCA:
 *   antojados_core.rwd_campaigns     → campañas de recompensas
 *   antojados_core.rwd_eligibilities → elegibilidades de usuarios
 *   antojados_core.rwd_redemptions   → redenciones realizadas
 *   antojados_core.soc_places        → JOIN para lugar de campaña
 *
 * REFERENCIAS:
 *   - rewardsMapper.js, rewards.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql, randomUUID, _emitEvent } = require('./_shared');

async function listCampaigns({ id, city_code }) {
  const req = getPool('antojados').request();
  let where = "WHERE rc.status = 'active' AND rc.starts_at <= SYSUTCDATETIME() AND rc.ends_at >= SYSUTCDATETIME()";
  if (id) { req.input('instanceId', sql.NVarChar(64), id); where += ' AND rc.id = @instanceId'; }
  if (city_code) { req.input('cityCode', sql.NVarChar(30), city_code); where += ' AND p.city_code = @cityCode'; }
  const result = await req.query(`
    SELECT rc.campaign_id, rc.campaign_name, rc.reward_type, rc.id,
           rc.starts_at, rc.ends_at, rc.rules_json, rc.sponsored_priority,
           p.name AS place_name, p.city_code
    FROM antojados_core.rwd_campaigns rc
    LEFT JOIN antojados_core.soc_places p ON p.id = rc.id
    ${where}
    ORDER BY rc.sponsored_priority DESC, rc.starts_at ASC
  `);
  return result.recordset;
}

async function getCampaign(campaignId) {
  const result = await getPool('antojados').request()
    .input('campaignId', sql.NVarChar(64), campaignId)
    .query(`
      SELECT rc.campaign_id, rc.campaign_name, rc.reward_type, rc.id,
             rc.starts_at, rc.ends_at, rc.rules_json, rc.budget_json,
             rc.sponsored_priority, rc.status,
             p.name AS place_name, p.city_code, p.address
      FROM antojados_core.rwd_campaigns rc
      LEFT JOIN antojados_core.soc_places p ON p.id = rc.id
      WHERE rc.campaign_id = @campaignId
    `);
  return result.recordset[0] || null;
}

async function listEligibility({ user_id, campaign_id }) {
  const req = getPool('antojados').request().input('userId', sql.NVarChar(64), user_id);
  let where = 're.user_id = @userId';
  if (campaign_id) { req.input('campaignId', sql.NVarChar(64), campaign_id); where += ' AND re.campaign_id = @campaignId'; }
  const result = await req.query(`
    SELECT re.id, re.campaign_id, re.post_id, re.engagement_score,
           re.eligibility_status, re.decided_at,
           rc.campaign_name, rc.reward_type
    FROM antojados_core.rwd_eligibilities re
    JOIN antojados_core.rwd_campaigns rc ON rc.campaign_id = re.campaign_id
    WHERE ${where}
    ORDER BY re.decided_at DESC
  `);
  return result.recordset;
}

async function redeemReward({ campaign_id, user_id, post_id }) {
  const pool = getPool('antojados');
  const tr = new sql.Transaction(pool);

  try {
    await tr.begin();

    const eligCheck = await new sql.Request(tr)
      .input('campaignId', sql.NVarChar(64), campaign_id)
      .input('userId', sql.NVarChar(64), user_id)
      .input('postId', sql.NVarChar(64), post_id)
      .query(`
        SELECT id, eligibility_status
        FROM antojados_core.rwd_eligibilities
        WHERE campaign_id = @campaignId AND user_id = @userId AND post_id = @postId
      `);

    if (!eligCheck.recordset.length) {
      await tr.rollback();
      const err = new Error('no_eligibility_record');
      err.status = 403;
      throw err;
    }
    const elig = eligCheck.recordset[0];
    if (elig.eligibility_status !== 'eligible') {
      await tr.rollback();
      const err = new Error(`eligibility_status_invalid:${elig.eligibility_status}`);
      err.status = 409;
      throw err;
    }

    const redemptionId = randomUUID();
    const redemptionCode = `ANT-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    await new sql.Request(tr)
      .input('redemptionId', sql.NVarChar(64), redemptionId)
      .input('campaignId', sql.NVarChar(64), campaign_id)
      .input('userId', sql.NVarChar(64), user_id)
      .input('postId', sql.NVarChar(64), post_id)
      .input('redemptionCode', sql.NVarChar(64), redemptionCode)
      .query(`
        INSERT INTO antojados_core.rwd_redemptions
          (redemption_id, campaign_id, user_id, post_id, redemption_code, redemption_status)
        VALUES
          (@redemptionId, @campaignId, @userId, @postId, @redemptionCode, 'issued')
      `);

    await new sql.Request(tr)
      .input('eligId', sql.NVarChar(64), elig.id)
      .query(`
        UPDATE antojados_core.rwd_eligibilities
        SET eligibility_status = 'redeemed', decided_at = SYSUTCDATETIME()
        WHERE id = @eligId
      `);

    await tr.commit();

    _emitEvent({
      user_id, post_id, campaign_id,
      event_type: 'reward_redeemed',
      payload: { redemption_code: redemptionCode },
    });

    return { redemption_id: redemptionId, redemption_code: redemptionCode };
  } catch (e) {
    try { await tr.rollback(); } catch (_) {}
    throw e;
  }
}

async function listUserRedemptions({ user_id, limit, offset }) {
  const result = await getPool('antojados').request()
    .input('userId', sql.NVarChar(64), user_id)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT r.redemption_id, r.campaign_id, r.post_id,
             r.redemption_code, r.redemption_status, r.redeemed_at, r.created_at,
             c.campaign_name, c.reward_type, c.id
      FROM antojados_core.rwd_redemptions r
      JOIN antojados_core.rwd_campaigns c ON c.campaign_id = r.campaign_id
      WHERE r.user_id = @userId
      ORDER BY r.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  return result.recordset;
}

module.exports = { listCampaigns, getCampaign, listEligibility, redeemReward, listUserRedemptions };