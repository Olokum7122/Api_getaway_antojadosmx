'use strict';
/**
 * authSponsorResolver.js — Resolver de Registro Sponsor (Negocios)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Autenticación (Auth)
 * RESPONSABLE:  Registrar cuentas de sponsor (instance_type='sponsor')
 *               con creación de biz_tenants, sys_instancia sponsor,
 *               perfiles admin, plantillas de overlays, y seed de invitaciones.
 *
 * NO HACE:
 *   - No maneja registro de usuarios (lo hace authSocialResolver)
 *   - No maneja login/perfiles (lo hace authResolver)
 *
 * TABLAS QUE TOCA:
 *   antojados_core.auth_identities              → registro de cuenta
 *   antojados_core.biz_tenants                  → negocio sponsor
 *   antojados_core.sys_instancia                → instancia sponsor
 *   antojados_core.biz_tenant_users             → usuario owner
 *   antojados_core.sys_dimension_location_template → plantillas
 *   antojados_core.biz_tenant_invitations       → seed de invitaciones
 *
 * REFERENCIAS:
 *   - authResolver.js, auth.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql, randomUUID } = require('./_shared');
const { randomBytes } = require('crypto');
const { assertRegistrationAvailable, getRegistrationRequest } = require('./authRegistrationShared');
const { INSTANCE_TYPE, SCOPE_TYPE } = require('../../constants/instancias');

const TEMPLATE_CODE_SPONSOR = 'DEFAULT_SPONSOR';

async function bootstrapCheckedOverlayFromTemplate(tr, { instanceId, templateCode, scopeType, forceAllEnabled = false }) {
  const dimTemplateRows = await new sql.Request(tr)
    .input('templateCode', sql.NVarChar(100), templateCode)
    .input('scopeType', sql.NVarChar(20), scopeType)
    .query(`
      SELECT template_location_id, visible, enabled
      FROM antojados_core.sys_dimension_location_template
      WHERE template_code = @templateCode
        AND scope_type IN ('all', @scopeType)
        AND is_active = 1
    `);

  const dimDetails = dimTemplateRows.recordset.map((row) => {
    const visible = forceAllEnabled ? true : row.visible === true;
    const enabled = forceAllEnabled ? true : row.enabled === true;
    return {
      template_location_id: row.template_location_id,
      visible,
      enabled,
      checked: visible || enabled,
    };
  });

  await new sql.Request(tr)
    .input('instance_id', sql.NVarChar(64), instanceId)
    .input('template_code', sql.NVarChar(100), templateCode)
    .input('scope_type', sql.NVarChar(20), scopeType)
    .input('details', sql.NVarChar(sql.MAX), JSON.stringify(dimDetails))
    .execute('antojados_core.sp_sys_dimension_location_checked_replace');

  const subTemplateRows = await new sql.Request(tr)
    .input('templateCode', sql.NVarChar(100), templateCode)
    .input('scopeType', sql.NVarChar(20), scopeType)
    .query(`
      SELECT template_sub_location_id, enabled
      FROM antojados_core.sys_sub_dimension_location_template
      WHERE template_code = @templateCode
        AND scope_type IN ('all', @scopeType)
        AND is_active = 1
    `);

  const subDetails = subTemplateRows.recordset.map((row) => {
    const enabled = forceAllEnabled ? true : row.enabled === true;
    return {
      template_sub_location_id: row.template_sub_location_id,
      visible: true,
      enabled,
      checked: enabled,
    };
  });

  await new sql.Request(tr)
    .input('instance_id', sql.NVarChar(64), instanceId)
    .input('template_code', sql.NVarChar(100), templateCode)
    .input('scope_type', sql.NVarChar(20), scopeType)
    .input('details', sql.NVarChar(sql.MAX), JSON.stringify(subDetails))
    .execute('antojados_core.sp_sys_sub_dimension_location_checked_replace');
}

function normalizeTeamSeed(team_seed) {
  if (!Array.isArray(team_seed)) return [];

  return team_seed
    .map((raw) => {
      const email = String(raw?.invitee_email || raw?.email || '').trim() || null;
      const phone = String(raw?.invitee_phone_e164 || raw?.phone || '').trim() || null;
      let channel = String(raw?.channel || '').trim().toLowerCase();

      if (!email && !phone) return null;

      if (channel !== 'email' && channel !== 'whatsapp') {
        channel = phone ? 'whatsapp' : 'email';
      }

      return {
        invitee_email: email,
        invitee_phone_e164: phone,
        channel,
      };
    })
    .filter((item) => item !== null)
    .slice(0, 30);
}

async function registerSponsorUser({
  user_id,
  email_hash,
  display_name,
  username,
  city_code,
  device_id,
  password_secret_ref,
  business_name,
  biz_type,
  phone,
  team_seed,
}) {
  await assertRegistrationAvailable({
    request: getRegistrationRequest(),
    user_id,
    email_hash,
  });

  const pool = getPool('antojados');
  const tr = new sql.Transaction(pool);
  const sponsorBizId = randomUUID();
  const sponsorInstanceId = randomUUID();
  const tenantUserId = randomUUID();
  const sponsorBusinessName = String(
    business_name || display_name || username || `Tenant ${user_id}`,
  ).trim();
  const sponsorBizType = String(biz_type || 'pending_setup').trim() || 'pending_setup';
  const sponsorCityCode = String(city_code || 'pending_setup').trim() || 'pending_setup';
  const seedInvitations = normalizeTeamSeed(team_seed);
  const sponsorPhoneE164 = String(phone || '').trim() || null;

  try {
    await tr.begin();

    const authInsertResult = await new sql.Request(tr)
      .input('userId', sql.NVarChar(64), user_id)
      .input('emailHash', sql.NVarChar(128), email_hash)
      .input('displayName', sql.NVarChar(150), display_name || null)
      .input('username', sql.NVarChar(80), username || null)
      .input('cityCode', sql.NVarChar(30), city_code || null)
      .input('deviceId', sql.NVarChar(64), device_id || null)
      .input('passwordSecretRef', sql.NVarChar(200), password_secret_ref || null)
      .input('phoneE164', sql.NVarChar(25), sponsorPhoneE164)
      .query(`
        INSERT INTO antojados_core.auth_identities
          (user_id, email_hash, display_name, username, city_code, device_id_first,
           password_secret_ref, phone_e164,
           status, created_at, updated_at)
        VALUES
          (@userId, @emailHash, @displayName, @username, @cityCode, @deviceId,
           @passwordSecretRef, @phoneE164,
           'active', SYSUTCDATETIME(), SYSUTCDATETIME())
      `);
    if ((authInsertResult.rowsAffected?.[0] || 0) !== 1) {
      throw new Error('registerSponsorUser: no fue posible crear auth_identities.');
    }

    const tenantInsertResult = await new sql.Request(tr)
      .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
      .input('businessName', sql.NVarChar(400), sponsorBusinessName)
      .input('bizType', sql.NVarChar(60), sponsorBizType)
      .input('cityCode', sql.NVarChar(60), sponsorCityCode)
      .input('phone', sql.NVarChar(60), phone || null)
      .query(`
        INSERT INTO antojados_core.biz_tenants
          (id, business_name, biz_type, city_code, phone, status, created_at, updated_at)
        VALUES
          (@sponsorBizId, @businessName, @bizType, @cityCode, @phone, 'pending_setup', SYSUTCDATETIME(), SYSUTCDATETIME())
      `);
    if ((tenantInsertResult.rowsAffected?.[0] || 0) !== 1) {
      throw new Error('registerSponsorUser: no fue posible crear biz_tenants.');
    }

    const instanceInsertResult = await new sql.Request(tr)
      .input('instanceId', sql.NVarChar(64), sponsorInstanceId)
      .input('userId', sql.NVarChar(64), user_id)
      .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
      .query(`
        INSERT INTO antojados_core.sys_instancia
          (instance_id, cuenta_id, instance_type, tenant_id, status, created_at, updated_at)
        VALUES
          (@instanceId, @userId, 'sponsor', @sponsorBizId, 'pending_setup', SYSUTCDATETIME(), SYSUTCDATETIME())
      `);
    if ((instanceInsertResult.rowsAffected?.[0] || 0) !== 1) {
      throw new Error('registerSponsorUser: no fue posible crear sys_instancia sponsor.');
    }

    const tenantUserInsertResult = await new sql.Request(tr)
      .input('tenantUserId', sql.NVarChar(64), tenantUserId)
      .input('instanceId', sql.NVarChar(64), sponsorInstanceId)
      .input('userId', sql.NVarChar(64), user_id)
      .query(`
        INSERT INTO antojados_core.biz_tenant_users
          (id, instance_id, user_id, is_legal_representative, representative_declared_at, status, created_at, updated_at)
        VALUES
          (@tenantUserId, @instanceId, @userId, 0, NULL, 'active', SYSUTCDATETIME(), SYSUTCDATETIME())
      `);
    if ((tenantUserInsertResult.rowsAffected?.[0] || 0) !== 1) {
      throw new Error('registerSponsorUser: no fue posible crear biz_tenant_users owner.');
    }

    await bootstrapCheckedOverlayFromTemplate(tr, {
      instanceId: sponsorInstanceId,
      templateCode: TEMPLATE_CODE_SPONSOR,
      scopeType: SCOPE_TYPE.SPONSOR,
      forceAllEnabled: true,
    });

    for (const seed of seedInvitations) {
      const inviteId = randomUUID();
      const inviteCode = randomBytes(6).toString('hex').toUpperCase();
      const expiresAt = new Date(Date.now() + (72 * 60 * 60 * 1000)).toISOString();

      await new sql.Request(tr)
        .input('id', sql.NVarChar(64), inviteId)
        .input('instanceId', sql.NVarChar(64), sponsorInstanceId)
        .input('inviteCode', sql.NVarChar(20), inviteCode)
        .input('inviteeEmail', sql.NVarChar(510), seed.invitee_email)
        .input('inviteePhone', sql.NVarChar(25), seed.invitee_phone_e164)
        .input('channel', sql.NVarChar(20), seed.channel)
        .input('createdBy', sql.NVarChar(64), tenantUserId)
        .input('expiresAt', sql.NVarChar(30), expiresAt)
        .query(`
          INSERT INTO antojados_core.biz_tenant_invitations
            (id, instance_id, invite_code, invitee_email, invitee_phone_e164, channel, created_by, profile_id, status, expires_at)
          VALUES
            (@id, @instanceId, @inviteCode, @inviteeEmail, @inviteePhone, @channel, @createdBy, NULL, 'pending', @expiresAt)
        `);
    }

    await tr.commit();
    return {
      user_id,
      instance_id: sponsorInstanceId,
      tenant_user_id: tenantUserId,
      instance_type: 'sponsor',
      status: 'pending_setup',
      team_seed_count: seedInvitations.length,
    };
  } catch (e) {
    try {
      await tr.rollback();
    } catch (rollbackError) {
      console.warn('registerSponsorUser.rollback_failed', rollbackError);
    }
    throw e;
  }
}

async function registerEmployeeWithInvite({
  user_id,
  email_hash,
  display_name,
  city_code,
  device_id,
  password_secret_ref,
  invite_code,
}) {
  const pool = getPool('antojados');
  const tr = new sql.Transaction(pool);

  try {
    await tr.begin();

    const inviteRequest = new sql.Request(tr)
      .input('inviteCode', sql.NVarChar(100), invite_code);
    const inviteResult = await inviteRequest.query(`
      SELECT TOP 1 i.id, i.instance_id, i.status, i.expires_at, i.profile_id
      FROM antojados_core.biz_tenant_invitations i WITH (UPDLOCK, HOLDLOCK)
      INNER JOIN antojados_core.sys_instancia si
        ON si.instance_id = i.instance_id
       AND si.instance_type = 'sponsor'
      WHERE i.invite_code = @inviteCode
    `);

    const invite = inviteResult.recordset[0] || null;
    if (!invite) {
      throw Object.assign(new Error('Código de invitación no encontrado'), { status: 404 });
    }
    if (invite.status !== 'pending') {
      throw Object.assign(new Error('Código ya utilizado o revocado'), { status: 409 });
    }
    if (new Date(invite.expires_at) < new Date()) {
      throw Object.assign(new Error('Código expirado'), { status: 410 });
    }

    await assertRegistrationAvailable({
      request: new sql.Request(tr),
      user_id,
      email_hash,
    });

    await new sql.Request(tr)
      .input('userId', sql.NVarChar(64), user_id)
      .input('emailHash', sql.NVarChar(128), email_hash)
      .input('displayName', sql.NVarChar(150), display_name || null)
      .input('cityCode', sql.NVarChar(30), city_code || null)
      .input('deviceId', sql.NVarChar(64), device_id || null)
      .input('passwordSecretRef', sql.NVarChar(200), password_secret_ref || null)
      .query(`
        INSERT INTO antojados_core.auth_identities
          (user_id, email_hash, display_name, city_code, device_id_first,
           password_secret_ref,
           status, created_at, updated_at)
        VALUES
          (@userId, @emailHash, @displayName, @cityCode, @deviceId,
           @passwordSecretRef,
           'active', SYSUTCDATETIME(), SYSUTCDATETIME())
      `);

    const tenantUserId = randomUUID();
    const sponsorInstanceId = invite.instance_id;

    if (!sponsorInstanceId) {
      throw Object.assign(new Error('La invitación no contiene instance_id válido.'), { status: 409 });
    }

    await new sql.Request(tr)
      .input('tenantUserId', sql.NVarChar(64), tenantUserId)
      .input('instanceId', sql.NVarChar(64), sponsorInstanceId)
      .input('userId', sql.NVarChar(64), user_id)
      .input('profileId', sql.NVarChar(64), invite.profile_id || null)
      .query(`
        IF EXISTS (
          SELECT 1
          FROM antojados_core.biz_tenant_users
          WHERE instance_id = @instanceId
            AND user_id = @userId
        )
          THROW 51000, 'El usuario ya está vinculado a este negocio.', 1;

        INSERT INTO antojados_core.biz_tenant_users
          (id, instance_id, user_id, profile_id, status)
        VALUES
          (@tenantUserId, @instanceId, @userId, @profileId, 'active')
      `);

    await new sql.Request(tr)
      .input('id', sql.NVarChar(64), randomUUID())
      .input('tenantUserId', sql.NVarChar(64), tenantUserId)
      .input('tenantInstanceId', sql.NVarChar(64), sponsorInstanceId)
      .query(`
        INSERT INTO antojados_core.biz_tenant_user_components
          (id, tenant_user_id, tenant_instance_id, restrict_by_location)
        VALUES
          (@id, @tenantUserId, @tenantInstanceId, 1)
      `);

    const redeemResult = await new sql.Request(tr)
      .input('inviteId', sql.NVarChar(64), invite.id)
      .input('userId', sql.NVarChar(64), user_id)
      .query(`
        UPDATE antojados_core.biz_tenant_invitations
        SET status = 'redeemed',
            invitee_user_id = @userId,
            updated_at = SYSUTCDATETIME()
        WHERE id = @inviteId
          AND status = 'pending'
      `);

    if ((redeemResult.rowsAffected?.[0] || 0) !== 1) {
      throw Object.assign(new Error('No fue posible redimir la invitación.'), { status: 409 });
    }

    await tr.commit();
    return {
      user_id,
      instance_id: sponsorInstanceId,
      tenant_user_id: tenantUserId,
    };
  } catch (e) {
    try {
      await tr.rollback();
    } catch (rollbackError) {
      console.warn('registerEmployeeWithInvite.rollback_failed', rollbackError);
    }
    if (e?.number === 51000 && !e.status) {
      throw Object.assign(new Error(e.message), { status: 409 });
    }
    throw e;
  }
}

module.exports = {
  registerSponsorUser,
  registerEmployeeWithInvite,
};
