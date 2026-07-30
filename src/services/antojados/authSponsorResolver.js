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
const { assertRegistrationAvailable, getRegistrationRequest } = require('./authRegistrationShared');

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
}) {
  const effective_user_id = String(user_id || randomUUID()).trim();

  await assertRegistrationAvailable({
    request: getRegistrationRequest(),
    user_id: effective_user_id,
    email_hash,
  });

  const pool = getPool('antojados');
  const tr = new sql.Transaction(pool);
  const tenant_id = randomUUID();
  const instance_id = randomUUID();
  const tenant_user_id = randomUUID();
  const sponsor_business_name = String(
    business_name || display_name || username || `Tenant ${effective_user_id}`,
  ).trim();
  const sponsor_biz_type = String(biz_type || 'pending_setup').trim() || 'pending_setup';
  const sponsor_city_code = String(city_code || 'pending_setup').trim() || 'pending_setup';
  const sponsor_phone_e164 = String(phone || '').trim() || null;

  try {
    await tr.begin();

    const authInsertResult = await new sql.Request(tr)
      .input('user_id', sql.NVarChar(64), effective_user_id)
      .input('emailHash', sql.NVarChar(128), email_hash)
      .input('displayName', sql.NVarChar(150), display_name || null)
      .input('username', sql.NVarChar(80), username || null)
      .input('cityCode', sql.NVarChar(30), city_code || null)
      .input('deviceId', sql.NVarChar(64), device_id || null)
      .input('passwordSecretRef', sql.NVarChar(200), password_secret_ref || null)
      .input('phoneE164', sql.NVarChar(25), sponsor_phone_e164)
      .query(`
        INSERT INTO antojados_core.auth_identities
          (user_id, email_hash, display_name, username, city_code, device_id_first,
           password_secret_ref, phone_e164,
           status, created_at, updated_at)
        VALUES
          (@user_id, @emailHash, @displayName, @username, @cityCode, @deviceId,
           @passwordSecretRef, @phoneE164,
           'active', SYSUTCDATETIME(), SYSUTCDATETIME())
      `);
    if ((authInsertResult.rowsAffected?.[0] || 0) !== 1) {
      throw new Error('registerSponsorUser: no fue posible crear auth_identities.');
    }

    const tenantInsertResult = await new sql.Request(tr)
      .input('tenant_id', sql.NVarChar(64), tenant_id)
      .input('businessName', sql.NVarChar(400), sponsor_business_name)
      .input('bizType', sql.NVarChar(60), sponsor_biz_type)
      .input('cityCode', sql.NVarChar(60), sponsor_city_code)
      .input('phone', sql.NVarChar(60), phone || null)
      .query(`
        INSERT INTO antojados_core.biz_tenants
          (id, business_name, biz_type, city_code, phone, status, created_at, updated_at)
        VALUES
          (@tenant_id, @businessName, @bizType, @cityCode, @phone, 'pending_setup', SYSUTCDATETIME(), SYSUTCDATETIME())
      `);
    if ((tenantInsertResult.rowsAffected?.[0] || 0) !== 1) {
      throw new Error('registerSponsorUser: no fue posible crear biz_tenants.');
    }

    const instanceInsertResult = await new sql.Request(tr)
      .input('instance_id', sql.NVarChar(64), instance_id)
      .input('user_id', sql.NVarChar(64), effective_user_id)
      .input('tenant_id', sql.NVarChar(64), tenant_id)
      .query(`
        INSERT INTO antojados_core.sys_instancia
          (instance_id, cuenta_id, instance_type, tenant_id, status, created_at, updated_at)
        VALUES
          (@instance_id, @user_id, 'sponsor', @tenant_id, 'pending_setup', SYSUTCDATETIME(), SYSUTCDATETIME())
      `);
    if ((instanceInsertResult.rowsAffected?.[0] || 0) !== 1) {
      throw new Error('registerSponsorUser: no fue posible crear sys_instancia sponsor.');
    }

    const tenantUserInsertResult = await new sql.Request(tr)
      .input('tenant_user_id', sql.NVarChar(64), tenant_user_id)
      .input('instance_id', sql.NVarChar(64), instance_id)
      .input('user_id', sql.NVarChar(64), effective_user_id)
      .query(`
        INSERT INTO antojados_core.biz_tenant_users
          (id, instance_id, user_id, is_legal_representative, representative_declared_at, status, created_at, updated_at)
        VALUES
          (@tenant_user_id, @instance_id, @user_id, 0, NULL, 'active', SYSUTCDATETIME(), SYSUTCDATETIME())
      `);
    if ((tenantUserInsertResult.rowsAffected?.[0] || 0) !== 1) {
      throw new Error('registerSponsorUser: no fue posible crear biz_tenant_users owner.');
    }

    await tr.commit();
    return {
      user_id: effective_user_id,
      instance_id,
      tenant_user_id,
      instance_type: 'sponsor',
      status: 'pending_setup',
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
  const effective_user_id = String(user_id || randomUUID()).trim();
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
      user_id: effective_user_id,
      email_hash,
    });

    await new sql.Request(tr)
      .input('user_id', sql.NVarChar(64), effective_user_id)
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
          (@user_id, @emailHash, @displayName, @cityCode, @deviceId,
           @passwordSecretRef,
           'active', SYSUTCDATETIME(), SYSUTCDATETIME())
      `);

    const tenant_user_id = randomUUID();
    const instance_id = invite.instance_id;

    if (!instance_id) {
      throw Object.assign(new Error('La invitación no contiene instance_id válido.'), { status: 409 });
    }

    await new sql.Request(tr)
      .input('tenant_user_id', sql.NVarChar(64), tenant_user_id)
      .input('instance_id', sql.NVarChar(64), instance_id)
      .input('user_id', sql.NVarChar(64), effective_user_id)
      .input('profile_id', sql.NVarChar(64), invite.profile_id || null)
      .query(`
        IF EXISTS (
          SELECT 1
          FROM antojados_core.biz_tenant_users
          WHERE instance_id = @instance_id
            AND user_id = @user_id
        )
          THROW 51000, 'El usuario ya está vinculado a este negocio.', 1;

        INSERT INTO antojados_core.biz_tenant_users
          (id, instance_id, user_id, profile_id, status)
        VALUES
          (@tenant_user_id, @instance_id, @user_id, @profile_id, 'active')
      `);

    await new sql.Request(tr)
      .input('id', sql.NVarChar(64), randomUUID())
      .input('tenant_user_id', sql.NVarChar(64), tenant_user_id)
      .input('tenant_instance_id', sql.NVarChar(64), instance_id)
      .query(`
        INSERT INTO antojados_core.biz_tenant_user_components
          (id, tenant_user_id, tenant_instance_id, restrict_by_location)
        VALUES
          (@id, @tenant_user_id, @tenant_instance_id, 1)
      `);

    const redeemResult = await new sql.Request(tr)
      .input('inviteId', sql.NVarChar(64), invite.id)
      .input('user_id', sql.NVarChar(64), effective_user_id)
      .query(`
        UPDATE antojados_core.biz_tenant_invitations
        SET status = 'redeemed',
            invitee_user_id = @user_id,
            updated_at = SYSUTCDATETIME()
        WHERE id = @inviteId
          AND status = 'pending'
      `);

    if ((redeemResult.rowsAffected?.[0] || 0) !== 1) {
      throw Object.assign(new Error('No fue posible redimir la invitación.'), { status: 409 });
    }

    await tr.commit();
    return {
      user_id: effective_user_id,
      instance_id,
      tenant_user_id,
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
