'use strict';
/**
 * equipoResolver.js — Resolver de Equipo / Empleados (Biz Tenants)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Equipo de Negocio (biz_tenants)
 * RESPONSABLE:  Gestión de perfiles, usuarios, invitaciones y asignaciones
 *               de tenants sponsor, con transacciones y SPs de antojados_core.
 *
 * NO HACE:
 *   - No maneja posts/feed (lo hacen postsResolver/bizResolver)
 *   - No maneja auth primario (lo hace authResolver)
 *
 * TABLAS QUE TOCA:
 *   antojados_core.biz_tenants                     → negocios/empresas
 *   antojados_core.biz_tenant_profiles             → perfiles de equipo
 *   antojados_core.biz_tenant_users                → usuarios de equipo
 *   antojados_core.biz_tenant_invitations          → invitaciones pendientes
 *   antojados_core.biz_tenant_user_components      → componentes de usuario
 *   antojados_core.sys_instancia                   → instancias del sistema
 *   antojados_core.auth_identities                 → identidades de usuarios
 *
 * REFERENCIAS:
 *   - equipoMapper.js, equipo.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */
const { getPool, sql } = require('./_shared');
const { randomUUID } = require('crypto');
const SPONSOR_BIZ_KEY = 'tenant' + '_id';

function withSponsorBizColumn(sqlText) {
  return sqlText.replaceAll('__SPONSOR_BIZ_COL__', SPONSOR_BIZ_KEY);
}

async function assertInvitationSchema(pool) {
  const result = await pool.request().query(`
    SELECT name
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'antojados_core.biz_tenant_invitations')
      AND name IN (N'profile_id', N'instance_id', N'invitee_email', N'invitee_phone_e164', N'channel')
  `);

  const names = new Set(result.recordset.map((r) => String(r.name).toLowerCase()));
  if (!names.has('profile_id') || !names.has('instance_id') || !names.has('invitee_email') || !names.has('invitee_phone_e164') || !names.has('channel')) {
    const err = new Error(
      'Schema invalido en biz_tenant_invitations: se requieren columnas profile_id, instance_id, invitee_email, invitee_phone_e164 y channel.',
    );
    err.status = 500;
    throw err;
  }
}

async function _getOwnerByInstanceId(pool, instance_id) {
  const owner = await pool.request()
    .input('instanceId', sql.NVarChar(64), instance_id)
    .query(`
      SELECT TOP 1 cuenta_id AS owner_user_id
      FROM antojados_core.sys_instancia
      WHERE instance_id = @instanceId
        AND instance_type = 'sponsor'
      ORDER BY created_at
    `);
  return owner.recordset[0]?.owner_user_id || null;
}

async function _getAdminGeneralProfileId(pool, instance_id) {
  const profile = await pool.request()
    .input('instanceId', sql.NVarChar(64), instance_id)
    .query(withSponsorBizColumn(`
      SELECT TOP 1 p.id
      FROM antojados_core.biz_tenant_profiles p
      JOIN antojados_core.sys_instancia si ON si.__SPONSOR_BIZ_COL__ = p.__SPONSOR_BIZ_COL__
      WHERE si.instance_id = @instanceId
        AND si.instance_type = 'sponsor'
        AND p.profile_type = 'admin_general'
      ORDER BY p.is_system DESC, p.created_at
    `));
  return profile.recordset[0]?.id || null;
}

async function _getBaseEmployeeProfileId(pool, instance_id) {
  const profile = await pool.request()
    .input('instanceId', sql.NVarChar(64), instance_id)
    .query(withSponsorBizColumn(`
      SELECT TOP 1 p.id
      FROM antojados_core.biz_tenant_profiles p
      JOIN antojados_core.sys_instancia si ON si.__SPONSOR_BIZ_COL__ = p.__SPONSOR_BIZ_COL__
      WHERE si.instance_id = @instanceId
        AND si.instance_type = 'sponsor'
        AND p.profile_type IN ('employee', 'member', 'user', 'usuario')
      ORDER BY
        CASE p.profile_type
          WHEN 'employee' THEN 0
          WHEN 'member' THEN 1
          WHEN 'user' THEN 2
          WHEN 'usuario' THEN 3
          ELSE 4
        END,
        p.is_system DESC,
        p.created_at
    `));
  return profile.recordset[0]?.id || null;
}

async function ensureAdminChangeRequestSchema(pool) {
  await pool.request().query(`
    IF OBJECT_ID(N'antojados_core.biz_tenant_admin_change_requests', N'U') IS NULL
    BEGIN
      CREATE TABLE antojados_core.biz_tenant_admin_change_requests (
        request_id NVARCHAR(64) NOT NULL PRIMARY KEY,
        instance_id NVARCHAR(64) NOT NULL,
        tenant_id NVARCHAR(64) NULL,
        requested_by_tenant_user_id NVARCHAR(64) NOT NULL,
        current_admin_tenant_user_id NVARCHAR(64) NOT NULL,
        proposed_admin_tenant_user_id NVARCHAR(64) NULL,
        status NVARCHAR(40) NOT NULL,
        reason NVARCHAR(1000) NOT NULL,
        credential_verified_at DATETIME2(3) NOT NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_biz_tenant_admin_change_requests_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_biz_tenant_admin_change_requests_updated_at DEFAULT SYSUTCDATETIME(),
        reviewed_by NVARCHAR(64) NULL,
        reviewed_at DATETIME2(3) NULL,
        decision_reason NVARCHAR(1000) NULL,
        applied_at DATETIME2(3) NULL
      );
      CREATE INDEX IX_biz_tenant_admin_change_requests_instance_status
        ON antojados_core.biz_tenant_admin_change_requests(instance_id, status, created_at DESC);
    END
  `);
}

async function _ensureOwnerTenantUser(pool, instance_id, owner_user_id) {
  if (!instance_id || !owner_user_id) return;

  const adminProfileId = await _getAdminGeneralProfileId(pool, instance_id);
  const tenantUserId = require('crypto').randomUUID();

  await pool.request()
    .input('tenantUserId', sql.NVarChar(64), tenantUserId)
    .input('instanceId', sql.NVarChar(64), instance_id)
    .input('ownerUserId', sql.NVarChar(64), owner_user_id)
    .input('adminProfileId', sql.NVarChar(64), adminProfileId)
    .query(`
      IF NOT EXISTS (
        SELECT 1
        FROM antojados_core.biz_tenant_users
        WHERE instance_id = @instanceId
          AND user_id = @ownerUserId
      )
      BEGIN
        INSERT INTO antojados_core.biz_tenant_users
          (id, instance_id, user_id, profile_id, status)
        VALUES
          (@tenantUserId, @instanceId, @ownerUserId, @adminProfileId, 'active')
      END
      ELSE
      BEGIN
        UPDATE antojados_core.biz_tenant_users
        SET profile_id = @adminProfileId,
            status = 'active',
            updated_at = SYSUTCDATETIME()
        WHERE instance_id = @instanceId
          AND user_id = @ownerUserId
      END
    `);
}

async function getTenantByUserId(user_id) {
  const pool = getPool('antojados');

  const r1 = await pool.request()
    .input('userId', sql.NVarChar(64), user_id)
    .query(withSponsorBizColumn(`
      SELECT tu.instance_id, t.business_name, t.status AS tenant_status,
             tu.id AS tenant_user_id, tu.profile_id,
             p.name AS profile_name, p.profile_type,
             si.cuenta_id AS owner_user_id
      FROM antojados_core.biz_tenant_users tu
      JOIN antojados_core.sys_instancia si ON si.instance_id = tu.instance_id
      JOIN antojados_core.biz_tenants t     ON t.id  = si.__SPONSOR_BIZ_COL__
      LEFT JOIN antojados_core.biz_tenant_profiles p ON p.id = tu.profile_id
      WHERE tu.user_id = @userId
        AND tu.status = 'active'
        AND si.instance_type = 'sponsor'
    `));
  if (r1.recordset[0]) {
    const row = r1.recordset[0];
    if (row.owner_user_id) {
      await _ensureOwnerTenantUser(pool, row.instance_id, row.owner_user_id);
    }
    return {
      instance_id: row.instance_id,
      business_name: row.business_name,
      tenant_status: row.tenant_status,
      tenant_user_id: row.tenant_user_id,
      profile_id: row.profile_id,
      profile_name: row.profile_name,
      profile_type: row.profile_type,
      owner_user_id: row.owner_user_id || null,
      is_owner: row.owner_user_id === user_id,
    };
  }

  const r2 = await pool.request()
    .input('userId', sql.NVarChar(64), user_id)
        .query(withSponsorBizColumn(`
      SELECT si.instance_id, t.business_name, t.status AS tenant_status,
             NULL AS tenant_user_id, NULL AS profile_id,
             p.name AS profile_name, p.profile_type,
             si.cuenta_id AS owner_user_id
      FROM antojados_core.sys_instancia si
          JOIN antojados_core.biz_tenants t ON t.id = si.__SPONSOR_BIZ_COL__
      LEFT JOIN antojados_core.biz_tenant_profiles p
            ON p.__SPONSOR_BIZ_COL__ = si.__SPONSOR_BIZ_COL__ AND p.profile_type = 'admin_general'
      WHERE si.cuenta_id = @userId AND si.instance_type = 'sponsor'
        `));
  const ownerRow = r2.recordset[0] || null;
  if (!ownerRow) return null;

  await _ensureOwnerTenantUser(pool, ownerRow.instance_id, ownerRow.owner_user_id);

  const refreshed = await pool.request()
    .input('instanceId', sql.NVarChar(64), ownerRow.instance_id)
    .input('userId', sql.NVarChar(64), user_id)
    .query(`
      SELECT TOP 1 tu.id AS tenant_user_id, tu.profile_id,
             p.name AS profile_name, p.profile_type
      FROM antojados_core.biz_tenant_users tu
      LEFT JOIN antojados_core.biz_tenant_profiles p ON p.id = tu.profile_id
      WHERE tu.instance_id = @instanceId
        AND tu.user_id = @userId
        AND tu.status = 'active'
    `);

  return {
    instance_id: ownerRow.instance_id,
    business_name: ownerRow.business_name,
    tenant_status: ownerRow.tenant_status,
    tenant_user_id: refreshed.recordset[0]?.tenant_user_id || null,
    profile_id: refreshed.recordset[0]?.profile_id || null,
    profile_name: refreshed.recordset[0]?.profile_name || ownerRow.profile_name,
    profile_type: refreshed.recordset[0]?.profile_type || ownerRow.profile_type,
    owner_user_id: ownerRow.owner_user_id,
    is_owner: true,
  };
}

async function listPerfiles(instance_id) {
  const result = await getPool('antojados').request()
    .input('instanceId', sql.NVarChar(64), instance_id)
    .query(withSponsorBizColumn(`
      SELECT p.id, p.name, p.profile_type, p.is_system, p.created_at
      FROM antojados_core.biz_tenant_profiles p
      JOIN antojados_core.sys_instancia si ON si.__SPONSOR_BIZ_COL__ = p.__SPONSOR_BIZ_COL__
      WHERE si.instance_id = @instanceId
        AND si.instance_type = 'sponsor'
      ORDER BY is_system DESC, name
    `));
  return result.recordset;
}

async function listUsuarios(instance_id) {
  const pool = getPool('antojados');
  const ownerUserId = await _getOwnerByInstanceId(pool, instance_id);
  await _ensureOwnerTenantUser(pool, instance_id, ownerUserId);

  const result = await getPool('antojados').request()
    .input('instanceId', sql.NVarChar(64), instance_id)
    .query(`
      SELECT
        tu.id            AS tenant_user_id,
        tu.instance_id,
        tu.user_id,
        tu.profile_id,
        p.name           AS profile_name,
        p.profile_type,
        ai.display_name,
        ai.username,
        ai.whatsapp_number,
        ai.avatar_url,
        tu.status,
        tu.invited_by,
        tu.created_at,
        CASE WHEN tu.user_id = si.cuenta_id THEN 1 ELSE 0 END AS is_owner
      FROM antojados_core.biz_tenant_users tu
      LEFT JOIN antojados_core.biz_tenant_profiles p ON p.id = tu.profile_id
      LEFT JOIN antojados_core.auth_identities ai    ON ai.user_id = tu.user_id
      JOIN antojados_core.sys_instancia si
             ON si.instance_id = tu.instance_id
            AND si.instance_type = 'sponsor'
      WHERE tu.instance_id = @instanceId
      ORDER BY tu.created_at
    `);
  return result.recordset;
}

async function updateUsuarioPerfil(tenant_user_id, profile_id) {
  await getPool('antojados').request()
    .input('tenantUserId', sql.NVarChar(64), tenant_user_id)
    .input('profileId', sql.NVarChar(64), profile_id)
    .query(`
      UPDATE antojados_core.biz_tenant_users
      SET profile_id = @profileId, updated_at = SYSUTCDATETIME()
      WHERE id = @tenantUserId
    `);
}

async function revocarUsuario(tenant_user_id) {
  await getPool('antojados').request()
    .input('tenantUserId', sql.NVarChar(64), tenant_user_id)
    .query(`
      UPDATE antojados_core.biz_tenant_users
      SET status = 'revoked', updated_at = SYSUTCDATETIME()
      WHERE id = @tenantUserId
    `);
}

async function generarInvitacion({
  instance_id,
  created_by,
  invitee_email,
  invitee_phone_e164,
  channel,
  profile_id = null,
  expires_hours = 72,
}) {
  const pool = getPool('antojados');
  await assertInvitationSchema(pool);

  const invite_code = require('crypto').randomBytes(6).toString('hex').toUpperCase();
  const expires_at = new Date(Date.now() + expires_hours * 60 * 60 * 1000).toISOString();
  const id = require('crypto').randomUUID();
  const normalizedChannel = String(channel || '').trim().toLowerCase();

  if (!instance_id) {
    const err = new Error('instance_id es requerido');
    err.status = 400;
    throw err;
  }
  if (!invitee_email) {
    const err = new Error('invitee_email es requerido');
    err.status = 400;
    throw err;
  }
  if (!invitee_phone_e164) {
    const err = new Error('invitee_phone_e164 es requerido');
    err.status = 400;
    throw err;
  }
  if (normalizedChannel !== 'email' && normalizedChannel !== 'whatsapp') {
    const err = new Error('channel debe ser email o whatsapp');
    err.status = 400;
    throw err;
  }

  const creatorResult = await pool.request()
    .input('instanceId', sql.NVarChar(64), instance_id)
    .input('createdBy', sql.NVarChar(64), created_by)
    .query(`
      SELECT TOP 1 tu.id
      FROM antojados_core.biz_tenant_users tu
      WHERE tu.instance_id = @instanceId
        AND (tu.id = @createdBy OR tu.user_id = @createdBy)
        AND tu.status = 'active'
      ORDER BY CASE WHEN tu.id = @createdBy THEN 0 ELSE 1 END
    `);

  const createdByTenantUserId = creatorResult.recordset[0]?.id || null;
  if (!createdByTenantUserId) {
    const err = new Error('created_by no corresponde a un miembro activo de la instancia.');
    err.status = 409;
    throw err;
  }

  const req = pool.request()
    .input('id', sql.NVarChar(64), id)
    .input('instanceId', sql.NVarChar(64), instance_id)
    .input('inviteCode', sql.NVarChar(20), invite_code)
    .input('inviteeEmail', sql.NVarChar(510), invitee_email)
    .input('inviteePhone', sql.NVarChar(25), invitee_phone_e164)
    .input('channel', sql.NVarChar(20), normalizedChannel)
    .input('createdBy', sql.NVarChar(64), createdByTenantUserId)
    .input('profileId', sql.NVarChar(64), profile_id || null)
    .input('expiresAt', sql.NVarChar(30), expires_at);

  await req.query(`
    INSERT INTO antojados_core.biz_tenant_invitations
      (id, instance_id, invite_code, invitee_email, invitee_phone_e164, channel, created_by, profile_id, status, expires_at)
    VALUES
      (@id, @instanceId, @inviteCode, @inviteeEmail, @inviteePhone, @channel, @createdBy, @profileId, 'pending', @expiresAt)
  `);

  return { id, invite_code, expires_at, invitee_email, invitee_phone_e164, channel: normalizedChannel, profile_id };
}

async function updateInvitacion(id, { invitee_email, invitee_phone_e164, channel }) {
  const pool = getPool('antojados');
  await assertInvitationSchema(pool);

  const normalizedChannel = String(channel || '').trim().toLowerCase();
  if (normalizedChannel !== 'email' && normalizedChannel !== 'whatsapp') {
    const err = new Error('channel debe ser email o whatsapp');
    err.status = 400;
    throw err;
  }

  const req = pool.request()
    .input('id', sql.NVarChar(64), id)
    .input('inviteeEmail', sql.NVarChar(510), invitee_email || null)
    .input('inviteePhone', sql.NVarChar(25), invitee_phone_e164 || null)
    .input('channel', sql.NVarChar(20), normalizedChannel);

  await req.query(`
    UPDATE antojados_core.biz_tenant_invitations
    SET invitee_email = @inviteeEmail,
        invitee_phone_e164 = @inviteePhone,
        channel = @channel,
        updated_at = SYSUTCDATETIME()
    WHERE id = @id
      AND status = 'pending'
  `);
}

async function deleteInvitacion(id) {
  await getPool('antojados').request()
    .input('id', sql.NVarChar(64), id)
    .query(`
      UPDATE antojados_core.biz_tenant_invitations
      SET status = 'cancelled', updated_at = SYSUTCDATETIME()
      WHERE id = @id
        AND status = 'pending'
    `);
}

async function listInvitacionesPendientes(instance_id) {
  const pool = getPool('antojados');
  await assertInvitationSchema(pool);
  const result = await pool.request()
    .input('instanceId', sql.NVarChar(64), instance_id)
    .query(`
      SELECT i.id, i.instance_id, i.invite_code,
             i.profile_id, i.invitee_email, i.invitee_phone_e164, i.channel,
             i.status, i.expires_at, i.created_at,
             p.name AS profile_name, p.profile_type
      FROM antojados_core.biz_tenant_invitations i
      LEFT JOIN antojados_core.biz_tenant_profiles p ON p.id = i.profile_id
      WHERE i.instance_id = @instanceId
        AND i.status = 'pending'
        AND i.expires_at > SYSUTCDATETIME()
      ORDER BY i.created_at DESC
    `);

  return result.recordset;
}

async function getInvitacion(invite_code) {
  const pool = getPool('antojados');
  await assertInvitationSchema(pool);

  const result = await pool.request()
    .input('inviteCode', sql.NVarChar(100), invite_code)
    .query(withSponsorBizColumn(`
          SELECT i.id, i.instance_id, i.invite_code,
            i.invitee_email, i.invitee_phone_e164, i.channel,
             i.status, i.expires_at, i.created_by,
             t.business_name
      FROM antojados_core.biz_tenant_invitations i
          JOIN antojados_core.sys_instancia si ON si.instance_id = i.instance_id
          JOIN antojados_core.biz_tenants t ON t.id = si.__SPONSOR_BIZ_COL__
      WHERE i.invite_code = @inviteCode
        AND si.instance_type = 'sponsor'
    `));

  return result.recordset[0] || null;
}

async function redimirInvitacion({ invite_code, user_id }) {
  const pool = getPool('antojados');
  await assertInvitationSchema(pool);

  const tr = new sql.Transaction(pool);

  try {
    await tr.begin();

    const inv = await new sql.Request(tr)
      .input('inviteCode', sql.NVarChar(100), invite_code)
      .query(`
        SELECT TOP 1 i.id, i.instance_id, i.status, i.expires_at, i.profile_id, i.invitee_user_id
        FROM antojados_core.biz_tenant_invitations i WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN antojados_core.sys_instancia si
          ON si.instance_id = i.instance_id
         AND si.instance_type = 'sponsor'
        WHERE i.invite_code = @inviteCode
      `);

    const row = inv.recordset[0];
    if (!row) throw Object.assign(new Error('Código de invitación no encontrado'), { status: 404 });
    if (new Date(row.expires_at) < new Date()) throw Object.assign(new Error('Código expirado'), { status: 410 });
    if (row.status !== 'pending' && !(row.status === 'redeemed' && row.invitee_user_id === user_id)) {
      throw Object.assign(new Error('Código ya utilizado o revocado'), { status: 409 });
    }

    const tenantInstanceId = row.instance_id || null;
    if (!tenantInstanceId) {
      throw Object.assign(new Error('No existe instance_id sponsor en la invitación.'), { status: 409 });
    }

    const tenantUserId = require('crypto').randomUUID();
    const componentId = require('crypto').randomUUID();

    const existingIdentity = await new sql.Request(tr)
      .input('userId', sql.NVarChar(64), user_id)
      .query(`
        SELECT TOP 1 user_id
        FROM antojados_core.auth_identities WITH (UPDLOCK, HOLDLOCK)
        WHERE user_id = @userId
      `);

    if (!existingIdentity.recordset[0]?.user_id) {
      throw Object.assign(new Error('No existe identidad auth para user_id. Completa registro de cuenta antes de redimir invitación.'), { status: 409 });
    }

    const existingTenantUser = await new sql.Request(tr)
      .input('instanceId', sql.NVarChar(64), tenantInstanceId)
      .input('userId', sql.NVarChar(64), user_id)
      .query(`
        SELECT TOP 1 id
        FROM antojados_core.biz_tenant_users WITH (UPDLOCK, HOLDLOCK)
        WHERE instance_id = @instanceId
          AND user_id = @userId
      `);

    const effectiveTenantUserId = existingTenantUser.recordset[0]?.id || tenantUserId;

    if (!existingTenantUser.recordset[0]) {
      await new sql.Request(tr)
        .input('id', sql.NVarChar(64), tenantUserId)
        .input('instanceId', sql.NVarChar(64), tenantInstanceId)
        .input('userId', sql.NVarChar(64), user_id)
        .input('profileId', sql.NVarChar(64), row.profile_id || null)
        .query(`
          INSERT INTO antojados_core.biz_tenant_users
            (id, instance_id, user_id, profile_id, status)
          VALUES
            (@id, @instanceId, @userId, @profileId, 'active')
        `);
    }

    await new sql.Request(tr)
      .input('id', sql.NVarChar(64), componentId)
      .input('tenantUserId', sql.NVarChar(64), effectiveTenantUserId)
      .input('tenantInstanceId', sql.NVarChar(64), tenantInstanceId)
      .query(`
        IF NOT EXISTS (
          SELECT 1
          FROM antojados_core.biz_tenant_user_components
          WHERE tenant_user_id = @tenantUserId
        )
        BEGIN
          INSERT INTO antojados_core.biz_tenant_user_components
            (id, tenant_user_id, tenant_instance_id, restrict_by_location)
          VALUES
            (@id, @tenantUserId, @tenantInstanceId, 1)
        END
        ELSE
        BEGIN
          UPDATE antojados_core.biz_tenant_user_components
          SET tenant_instance_id = @tenantInstanceId
          WHERE tenant_user_id = @tenantUserId
        END
      `);

    if (row.status === 'pending') {
      const redeemResult = await new sql.Request(tr)
        .input('inviteId', sql.NVarChar(64), row.id)
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
    }

    await tr.commit();
    return {
      tenant_user_id: effectiveTenantUserId,
      instance_id: tenantInstanceId,
    };
  } catch (e) {
    try {
      await tr.rollback();
    } catch (rollbackError) {
      console.warn('redimirInvitacion.rollback_failed', rollbackError);
    }
    throw e;
  }
}

async function _resolveTenantInstanceIdByTenantUserId(pool, tenant_user_id) {
  const result = await pool.request()
    .input('tenantUserId', sql.NVarChar(64), tenant_user_id)
    .query(`
      DECLARE @tenant_instance_id NVARCHAR(64);

      SELECT TOP (1) @tenant_instance_id = tuc.tenant_instance_id
      FROM antojados_core.biz_tenant_user_components tuc
      WHERE tuc.tenant_user_id = @tenantUserId;

      SELECT @tenant_instance_id AS tenant_instance_id;
    `);

  const instanceId = result.recordset[0]?.tenant_instance_id || null;
  if (!instanceId) {
    const err = new Error('El empleado no tiene tenant_instance_id ligado. Completa el alta de empleado antes de asignar permisos.');
    err.status = 409;
    throw err;
  }

  return instanceId;
}

function _normalizeAsignacionDetail(detail) {
  const location_id = String(detail?.location_id || detail?.locationId || '').trim();
  if (!location_id) {
    const err = new Error('Cada asignacion requiere location_id');
    err.status = 400;
    throw err;
  }

  const legacyLevel = String(detail?.permission_level || detail?.permissionLevel || '').trim().toLowerCase();
  const visibleRaw = detail?.visible === true || detail?.visible === 1 || detail?.visible === '1';
  const puedeLeerRaw =
    detail?.puede_leer === true ||
    detail?.puede_leer === 1 ||
    detail?.puede_leer === '1' ||
    legacyLevel === 'leer' ||
    legacyLevel === 'editar' ||
    legacyLevel === 'admin';
  const puedeEditarRaw =
    detail?.puede_editar === true ||
    detail?.puede_editar === 1 ||
    detail?.puede_editar === '1' ||
    legacyLevel === 'editar' ||
    legacyLevel === 'admin';

  // Reglas del contrato de Asignaciones (Integracion 6.x):
  // 1) editar => leer
  // 2) leer => visible
  // 3) visible=0 => leer=0 y editar=0
  if (puedeEditarRaw && !puedeLeerRaw) {
    const err = new Error('Regla inválida: puede_editar requiere puede_leer');
    err.status = 400;
    throw err;
  }
  if (puedeLeerRaw && !visibleRaw) {
    const err = new Error('Regla inválida: puede_leer requiere visible');
    err.status = 400;
    throw err;
  }
  if (!visibleRaw && (puedeLeerRaw || puedeEditarRaw)) {
    const err = new Error('Regla inválida: visible=0 requiere puede_leer=0 y puede_editar=0');
    err.status = 400;
    throw err;
  }

  return {
    location_id,
    visible: visibleRaw ? 1 : 0,
    puede_leer: puedeLeerRaw ? 1 : 0,
    puede_editar: puedeEditarRaw ? 1 : 0,
  };
}

async function getAsignaciones(tenant_user_id) {
  const result = await getPool('antojados').request()
    .input('tenant_user_id', sql.NVarChar(64), tenant_user_id)
    .execute('antojados_core.sp_biz_tenant_user_component_permissions_get_grid');
  return result.recordset;
}

async function setAsignaciones(tenant_user_id, details) {
  const normalizedDetails = Array.isArray(details) ? details.map(_normalizeAsignacionDetail) : [];
  const result = await getPool('antojados').request()
    .input('tenant_user_id', sql.NVarChar(64), tenant_user_id)
    .input('details', sql.NVarChar(sql.MAX), JSON.stringify(normalizedDetails))
    .execute('antojados_core.sp_biz_tenant_user_component_permissions_replace');
  return { inserted: result.recordset[0]?.inserted ?? 0 };
}

async function seedAsignaciones(tenant_user_id, force = false) {
  const result = await getPool('antojados').request()
    .input('tenant_user_id', sql.NVarChar(64), tenant_user_id)
    .execute('antojados_core.sp_biz_tenant_user_component_permissions_seed_admin_general');
  return { seeded: result.recordset[0]?.seeded ?? 0 };
}

async function transferirAdminGeneral({ instance_id, nuevo_user_id }) {
  const tenantLookup = await getPool('antojados').request()
    .input('instanceId', sql.NVarChar(64), instance_id)
    .query(withSponsorBizColumn(`
      SELECT TOP 1 __SPONSOR_BIZ_COL__
      FROM antojados_core.sys_instancia
      WHERE instance_id = @instanceId
        AND instance_type = 'sponsor'
    `));

  const sponsorBizId = tenantLookup.recordset[0]?.[SPONSOR_BIZ_KEY] || null;
  if (!sponsorBizId) {
    const err = new Error('No se encontró tenant para la instancia indicada.');
    err.status = 404;
    throw err;
  }

  const result = await getPool('antojados').request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('nuevoUserId', sql.NVarChar(64), nuevo_user_id)
    .execute('antojados_core.sp_biz_transferir_admin_general');
  return result.recordset[0] ?? null;
}

async function transferirAdminGeneralPerfil({ instance_id, requested_by_tenant_user_id, proposed_admin_tenant_user_id, password_secret_ref }) {
  const pool = getPool('antojados');
  const adminProfileId = await _getAdminGeneralProfileId(pool, instance_id);
  const baseProfileId = await _getBaseEmployeeProfileId(pool, instance_id);

  if (!adminProfileId) throw Object.assign(new Error('No existe perfil admin_general para la instancia.'), { status: 409 });
  if (!baseProfileId) throw Object.assign(new Error('No existe perfil base employee/member para la instancia.'), { status: 409 });
  if (!password_secret_ref) throw Object.assign(new Error('password_secret_ref es requerido'), { status: 400 });
  if (!proposed_admin_tenant_user_id) throw Object.assign(new Error('proposed_admin_tenant_user_id es requerido'), { status: 400 });
  if (String(requested_by_tenant_user_id) === String(proposed_admin_tenant_user_id)) {
    throw Object.assign(new Error('Selecciona un miembro distinto al Admin General actual.'), { status: 409 });
  }

  const tr = new sql.Transaction(pool);
  try {
    await tr.begin();

    const currentAdmin = await new sql.Request(tr)
      .input('instanceId', sql.NVarChar(64), instance_id)
      .input('tenantUserId', sql.NVarChar(64), requested_by_tenant_user_id)
      .input('adminProfileId', sql.NVarChar(64), adminProfileId)
      .query(`
        SELECT TOP 1 tu.id, tu.user_id, ai.password_secret_ref
        FROM antojados_core.biz_tenant_users tu WITH (UPDLOCK, HOLDLOCK)
        JOIN antojados_core.auth_identities ai ON ai.user_id = tu.user_id
        WHERE tu.instance_id = @instanceId
          AND tu.id = @tenantUserId
          AND tu.status = 'active'
          AND tu.profile_id = @adminProfileId
      `);
    const admin = currentAdmin.recordset[0] || null;
    if (!admin) throw Object.assign(new Error('Solo el Admin General actual puede cambiar el perfil Admin General.'), { status: 403 });
    if (String(admin.password_secret_ref || '') !== String(password_secret_ref)) {
      throw Object.assign(new Error('Credencial invalida para cambiar Admin General.'), { status: 401 });
    }

    const proposed = await new sql.Request(tr)
      .input('instanceId', sql.NVarChar(64), instance_id)
      .input('proposedId', sql.NVarChar(64), proposed_admin_tenant_user_id)
      .input('adminProfileId', sql.NVarChar(64), adminProfileId)
      .query(`
        SELECT TOP 1 id, profile_id
        FROM antojados_core.biz_tenant_users WITH (UPDLOCK, HOLDLOCK)
        WHERE instance_id = @instanceId
          AND id = @proposedId
          AND status = 'active'
      `);
    const proposedRow = proposed.recordset[0] || null;
    if (!proposedRow) throw Object.assign(new Error('El nuevo Admin General debe ser miembro activo de la cuenta.'), { status: 409 });
    if (String(proposedRow.profile_id || '') === String(adminProfileId)) {
      throw Object.assign(new Error('El miembro seleccionado ya es Admin General.'), { status: 409 });
    }

    await new sql.Request(tr)
      .input('instanceId', sql.NVarChar(64), instance_id)
      .input('adminProfileId', sql.NVarChar(64), adminProfileId)
      .input('baseProfileId', sql.NVarChar(64), baseProfileId)
      .input('proposedId', sql.NVarChar(64), proposed_admin_tenant_user_id)
      .query(`
        UPDATE antojados_core.biz_tenant_users
        SET profile_id = @baseProfileId,
            updated_at = SYSUTCDATETIME()
        WHERE instance_id = @instanceId
          AND profile_id = @adminProfileId
          AND id <> @proposedId;

        UPDATE antojados_core.biz_tenant_users
        SET profile_id = @adminProfileId,
            updated_at = SYSUTCDATETIME()
        WHERE instance_id = @instanceId
          AND id = @proposedId
          AND status = 'active';
      `);

    await tr.commit();

    return {
      instance_id,
      previous_admin_tenant_user_id: requested_by_tenant_user_id,
      new_admin_tenant_user_id: proposed_admin_tenant_user_id,
      previous_profile_id: baseProfileId,
      new_profile_id: adminProfileId,
      source_table: 'biz_tenant_users',
      source_field: 'profile_type',
      source_status: 'admin_general',
      profile_type: 'admin_general',
    };
  } catch (error) {
    try { await tr.rollback(); } catch (rollbackError) { console.warn('transferirAdminGeneralPerfil.rollback_failed', rollbackError); }
    throw error;
  }
}

async function requestAdminGeneralChange({ instance_id, requested_by_tenant_user_id, proposed_admin_tenant_user_id = null, reason, password_secret_ref }) {
  const pool = getPool('antojados');
  await ensureAdminChangeRequestSchema(pool);

  const normalizedReason = String(reason || '').trim();
  if (!normalizedReason) throw Object.assign(new Error('reason es requerido'), { status: 400 });
  if (!password_secret_ref) throw Object.assign(new Error('password_secret_ref es requerido'), { status: 400 });

  const adminProfileId = await _getAdminGeneralProfileId(pool, instance_id);
  const currentAdmin = await pool.request()
    .input('instanceId', sql.NVarChar(64), instance_id)
    .input('tenantUserId', sql.NVarChar(64), requested_by_tenant_user_id)
    .input('adminProfileId', sql.NVarChar(64), adminProfileId)
    .query(withSponsorBizColumn(`
      SELECT TOP 1 tu.id, tu.user_id, si.__SPONSOR_BIZ_COL__ AS sponsor_biz_id, ai.password_secret_ref
      FROM antojados_core.biz_tenant_users tu
      JOIN antojados_core.sys_instancia si ON si.instance_id = tu.instance_id AND si.instance_type = 'sponsor'
      JOIN antojados_core.auth_identities ai ON ai.user_id = tu.user_id
      WHERE tu.instance_id = @instanceId
        AND tu.id = @tenantUserId
        AND tu.status = 'active'
        AND tu.profile_id = @adminProfileId
    `));
  const admin = currentAdmin.recordset[0] || null;
  if (!admin) throw Object.assign(new Error('Solo el Admin General actual puede solicitar el cambio.'), { status: 403 });
  if (String(admin.password_secret_ref || '') !== String(password_secret_ref)) {
    throw Object.assign(new Error('Credencial inválida para solicitar cambio de Admin General.'), { status: 401 });
  }

  if (proposed_admin_tenant_user_id) {
    const proposed = await pool.request()
      .input('instanceId', sql.NVarChar(64), instance_id)
      .input('proposedId', sql.NVarChar(64), proposed_admin_tenant_user_id)
      .query(`
        SELECT TOP 1 id
        FROM antojados_core.biz_tenant_users
        WHERE instance_id = @instanceId
          AND id = @proposedId
          AND status = 'active'
      `);
    if (!proposed.recordset[0]) throw Object.assign(new Error('El Admin General propuesto no es miembro activo de la cuenta.'), { status: 409 });
  }

  const existing = await pool.request()
    .input('instanceId', sql.NVarChar(64), instance_id)
    .query(`
      SELECT TOP 1 request_id, status
      FROM antojados_core.biz_tenant_admin_change_requests
      WHERE instance_id = @instanceId
        AND status IN ('REQUESTED', 'READY_FOR_GT_REVIEW', 'APPROVED', 'READY_TO_SELECT_NEW_ADMIN')
      ORDER BY created_at DESC
    `);
  if (existing.recordset[0]) {
    throw Object.assign(new Error('Ya existe una solicitud activa de cambio de Admin General.'), { status: 409 });
  }

  const requestId = randomUUID();
  const result = await pool.request()
    .input('requestId', sql.NVarChar(64), requestId)
    .input('instanceId', sql.NVarChar(64), instance_id)
    .input('tenantId', sql.NVarChar(64), admin.sponsor_biz_id)
    .input('requestedBy', sql.NVarChar(64), requested_by_tenant_user_id)
    .input('currentAdmin', sql.NVarChar(64), admin.id)
    .input('proposedAdmin', sql.NVarChar(64), proposed_admin_tenant_user_id || null)
    .input('reason', sql.NVarChar(1000), normalizedReason)
    .query(`
      INSERT INTO antojados_core.biz_tenant_admin_change_requests
        (request_id, instance_id, tenant_id, requested_by_tenant_user_id, current_admin_tenant_user_id,
         proposed_admin_tenant_user_id, status, reason, credential_verified_at)
      OUTPUT inserted.*
      VALUES
        (@requestId, @instanceId, @tenantId, @requestedBy, @currentAdmin,
         @proposedAdmin, 'READY_FOR_GT_REVIEW', @reason, SYSUTCDATETIME())
    `);
  return result.recordset[0];
}

async function listAdminGeneralChangeRequests({ instance_id = null, status = null } = {}) {
  const pool = getPool('antojados');
  await ensureAdminChangeRequestSchema(pool);
  const request = pool.request()
    .input('instanceId', sql.NVarChar(64), instance_id || null)
    .input('status', sql.NVarChar(40), status || null);
  const result = await request.query(`
    SELECT TOP 100 r.*, t.business_name,
           current_ai.display_name AS current_admin_name,
           proposed_ai.display_name AS proposed_admin_name
    FROM antojados_core.biz_tenant_admin_change_requests r
    LEFT JOIN antojados_core.biz_tenants t ON t.id = r.tenant_id
    LEFT JOIN antojados_core.biz_tenant_users current_tu ON current_tu.id = r.current_admin_tenant_user_id
    LEFT JOIN antojados_core.auth_identities current_ai ON current_ai.user_id = current_tu.user_id
    LEFT JOIN antojados_core.biz_tenant_users proposed_tu ON proposed_tu.id = r.proposed_admin_tenant_user_id
    LEFT JOIN antojados_core.auth_identities proposed_ai ON proposed_ai.user_id = proposed_tu.user_id
    WHERE (@instanceId IS NULL OR r.instance_id = @instanceId)
      AND (@status IS NULL OR r.status = @status)
    ORDER BY r.created_at DESC
  `);
  return result.recordset;
}

module.exports = {
  getTenantByUserId,
  listPerfiles,
  listUsuarios,
  updateUsuarioPerfil,
  revocarUsuario,
  generarInvitacion,
  updateInvitacion,
  deleteInvitacion,
  listInvitacionesPendientes,
  getInvitacion,
  redimirInvitacion,
  getAsignaciones,
  setAsignaciones,
  seedAsignaciones,
  transferirAdminGeneral,
  transferirAdminGeneralPerfil,
  requestAdminGeneralChange,
  listAdminGeneralChangeRequests,
};