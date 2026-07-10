'use strict';
/**
 * authSocialResolver.js — Resolver de Registro Social (Usuarios)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Autenticación (Auth)
 * RESPONSABLE:  Registrar cuentas de usuario social (instance_type='user')
 *               con validación de payload, transacciones UPDLOCK/HOLDLOCK
 *               y creación automática de instancia de usuario.
 *
 * NO HACE:
 *   - No maneja registro de sponsors (lo hace authSponsorResolver)
 *   - No maneja login/perfiles (lo hace authResolver)
 *
 * TABLAS QUE TOCA:
 *   antojados_core.auth_identities → registro de cuenta
 *   antojados_core.sys_instancia   → creación de instancia user
 *
 * REFERENCIAS:
 *   - authResolver.js, auth.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql, randomUUID } = require('./_shared');

function validateSocialRegistrationPayload(payload) {
  const missingFields = [];
  if (!payload?.user_id) missingFields.push('user_id');
  if (!payload?.email_hash) missingFields.push('email_hash');
  if (!payload?.password_secret_ref) missingFields.push('password_secret_ref');
  if (!payload?.display_name) missingFields.push('display_name');

  if (missingFields.length) {
    throw Object.assign(
      new Error(`Campos faltantes para crear cuenta social: ${missingFields.join(', ')}`),
      { status: 400 },
    );
  }

  if (!/^[a-f0-9]{64}$/i.test(String(payload.email_hash))) {
    throw Object.assign(
      new Error('email_hash inválido: debe ser SHA-256 hexadecimal de 64 caracteres'),
      { status: 400 },
    );
  }

  if (!/^sha256:[a-f0-9]{64}$/i.test(String(payload.password_secret_ref))) {
    throw Object.assign(
      new Error('password_secret_ref inválido: debe usar formato sha256:<64 hex>'),
      { status: 400 },
    );
  }

  const confirmRef = payload.password_confirm_secret_ref || payload.confirm_password_secret_ref || null;
  if (confirmRef && String(confirmRef) !== String(payload.password_secret_ref)) {
    throw Object.assign(
      new Error('La confirmación de contraseña no coincide'),
      { status: 400 },
    );
  }
}

async function registerSocialUser({
  user_id,
  email_hash,
  display_name,
  username,
  city_code,
  device_id,
  id,
  password_secret_ref,
  password_confirm_secret_ref,
  confirm_password_secret_ref,
}) {
  validateSocialRegistrationPayload({
    user_id,
    email_hash,
    display_name,
    password_secret_ref,
    password_confirm_secret_ref,
    confirm_password_secret_ref,
  });

  const pool = getPool('antojados');
  const tr = new sql.Transaction(pool);

  let effectiveUserId = user_id;
  let userInstanceId = randomUUID();

  try {
    await tr.begin();

    const existingByEmail = await new sql.Request(tr)
      .input('emailHash', sql.NVarChar(128), email_hash)
      .query(`
        SELECT TOP 1 user_id, password_secret_ref
        FROM antojados_core.auth_identities WITH (UPDLOCK, HOLDLOCK)
        WHERE email_hash = @emailHash
      `);

    const existingEmailRow = existingByEmail.recordset[0] || null;

    if (existingEmailRow) {
      const existingEmailUserId = String(existingEmailRow.user_id || '').trim();
      if (existingEmailUserId !== String(user_id)) {
        throw Object.assign(
          new Error('El correo ya está asociado a otra cuenta. Inicia sesión o recupera contraseña.'),
          { status: 409 },
        );
      }

      effectiveUserId = existingEmailUserId;

      const existingSecret = String(existingEmailRow.password_secret_ref || '').trim();
      if (existingSecret && existingSecret !== String(password_secret_ref)) {
        throw Object.assign(
          new Error('La contraseña no coincide con la cuenta ya registrada para ese correo.'),
          { status: 409 },
        );
      }

      await new sql.Request(tr)
        .input('userId', sql.NVarChar(64), effectiveUserId)
        .input('displayName', sql.NVarChar(150), display_name || null)
        .input('username', sql.NVarChar(80), username || null)
        .input('cityCode', sql.NVarChar(30), city_code || null)
        .input('deviceId', sql.NVarChar(64), device_id || null)
        .input('placeId', sql.NVarChar(64), id || null)
        .input('passwordSecretRef', sql.NVarChar(200), password_secret_ref)
        .query(`
          UPDATE antojados_core.auth_identities
          SET display_name = COALESCE(@displayName, display_name),
              username = COALESCE(@username, username),
              city_code = COALESCE(@cityCode, city_code),
              device_id_first = COALESCE(@deviceId, device_id_first),
              id = COALESCE(@placeId, id),
              password_secret_ref = CASE
                WHEN password_secret_ref IS NULL OR LTRIM(RTRIM(password_secret_ref)) = ''
                  THEN @passwordSecretRef
                ELSE password_secret_ref
              END,
              updated_at = SYSUTCDATETIME()
          WHERE user_id = @userId
        `);
    } else {
      const existingByUser = await new sql.Request(tr)
        .input('userId', sql.NVarChar(64), user_id)
        .query(`
          SELECT TOP 1 user_id
          FROM antojados_core.auth_identities WITH (UPDLOCK, HOLDLOCK)
          WHERE user_id = @userId
        `);

      if (existingByUser.recordset[0]) {
        throw Object.assign(
          new Error('user_id ya registrado con otro correo. Usa el mismo correo del registro original.'),
          { status: 409 },
        );
      }

      await new sql.Request(tr)
        .input('userId', sql.NVarChar(64), user_id)
        .input('emailHash', sql.NVarChar(128), email_hash)
        .input('displayName', sql.NVarChar(150), display_name || null)
        .input('username', sql.NVarChar(80), username || null)
        .input('cityCode', sql.NVarChar(30), city_code || null)
        .input('deviceId', sql.NVarChar(64), device_id || null)
        .input('placeId', sql.NVarChar(64), id || null)
        .input('passwordSecretRef', sql.NVarChar(200), password_secret_ref)
        .query(`
          INSERT INTO antojados_core.auth_identities
            (user_id, email_hash, display_name, username, city_code, device_id_first,
             id, password_secret_ref,
             status, created_at, updated_at)
          VALUES
            (@userId, @emailHash, @displayName, @username, @cityCode, @deviceId,
             @placeId, @passwordSecretRef,
             'active', SYSUTCDATETIME(), SYSUTCDATETIME())
        `);
    }

    const existingInstance = await new sql.Request(tr)
      .input('userId', sql.NVarChar(64), effectiveUserId)
      .query(`
        SELECT TOP 1 instance_id
        FROM antojados_core.sys_instancia WITH (UPDLOCK, HOLDLOCK)
        WHERE cuenta_id = @userId
          AND instance_type = 'user'
        ORDER BY created_at DESC
      `);

    const existingUserInstanceId = existingInstance.recordset[0]?.instance_id || null;
    if (existingUserInstanceId) {
      userInstanceId = existingInstance.recordset[0].instance_id;
    } else {
      await new sql.Request(tr)
        .input('instanceId', sql.NVarChar(64), userInstanceId)
        .input('userId', sql.NVarChar(64), effectiveUserId)
        .query(`
          INSERT INTO antojados_core.sys_instancia
            (instance_id, cuenta_id, instance_type, tenant_id, status, created_at, updated_at)
          VALUES
            (@instanceId, @userId, 'user', NULL, 'active', SYSUTCDATETIME(), SYSUTCDATETIME())
        `);

      // User instances are now governed directly by DEFAULT_USER template.
      // No checked overlay seeding is created at signup time.
    }

    await tr.commit();
  } catch (e) {
    try {
      await tr.rollback();
    } catch (rollbackError) {
      console.warn('registerSocialUser.rollback_failed', rollbackError);
    }
    throw e;
  }

  return {
    user_id: effectiveUserId,
    instance_id: userInstanceId,
    tenant_user_id: null,
    instance_type: 'user',
    status: 'active',
    team_seed_count: 0,
  };
}

module.exports = {
  registerSocialUser,
};
