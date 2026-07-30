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
 * ID GLOSSARY:
 *   auth_identities.user_id      → identidad SOC/Auth generada en backend.
 *   sys_instancia.instance_id    → instancia user creada para cuenta social.
 *   sys_instancia.cuenta_id      → FK fisica a auth_identities.user_id.
 *   sys_instancia.tenant_id      → NULL en cuenta social.
 *   La ubicacion del negocio pertenece al registro de instancia, no a Auth.
 *
 * REFERENCIAS:
 *   - authResolver.js, auth.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql, randomUUID } = require('./_shared');

function validateSocialRegistrationPayload(payload) {
  const missingFields = [];
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

  let effective_user_id = String(user_id || randomUUID()).trim();
  let user_instance_id = randomUUID();

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
      const existing_email_user_id = String(existingEmailRow.user_id || '').trim();
      if (user_id && existing_email_user_id !== String(user_id)) {
        throw Object.assign(
          new Error('El correo ya está asociado a otra cuenta. Inicia sesión o recupera contraseña.'),
          { status: 409 },
        );
      }

      effective_user_id = existing_email_user_id;

      const existingSecret = String(existingEmailRow.password_secret_ref || '').trim();
      if (existingSecret && existingSecret !== String(password_secret_ref)) {
        throw Object.assign(
          new Error('La contraseña no coincide con la cuenta ya registrada para ese correo.'),
          { status: 409 },
        );
      }

      await new sql.Request(tr)
        .input('user_id', sql.NVarChar(64), effective_user_id)
        .input('displayName', sql.NVarChar(150), display_name || null)
        .input('username', sql.NVarChar(80), username || null)
        .input('cityCode', sql.NVarChar(30), city_code || null)
        .input('deviceId', sql.NVarChar(64), device_id || null)
        .input('passwordSecretRef', sql.NVarChar(200), password_secret_ref)
        .query(`
          UPDATE antojados_core.auth_identities
          SET display_name = COALESCE(@displayName, display_name),
              username = COALESCE(@username, username),
              city_code = COALESCE(@cityCode, city_code),
              device_id_first = COALESCE(@deviceId, device_id_first),
              password_secret_ref = CASE
                WHEN password_secret_ref IS NULL OR LTRIM(RTRIM(password_secret_ref)) = ''
                  THEN @passwordSecretRef
                ELSE password_secret_ref
              END,
              updated_at = SYSUTCDATETIME()
          WHERE user_id = @user_id
        `);
    } else {
      const existingByUser = await new sql.Request(tr)
        .input('user_id', sql.NVarChar(64), effective_user_id)
        .query(`
          SELECT TOP 1 user_id
          FROM antojados_core.auth_identities WITH (UPDLOCK, HOLDLOCK)
          WHERE user_id = @user_id
        `);

      if (existingByUser.recordset[0]) {
        throw Object.assign(
          new Error('user_id ya registrado con otro correo. Usa el mismo correo del registro original.'),
          { status: 409 },
        );
      }

      await new sql.Request(tr)
        .input('user_id', sql.NVarChar(64), effective_user_id)
        .input('emailHash', sql.NVarChar(128), email_hash)
        .input('displayName', sql.NVarChar(150), display_name || null)
        .input('username', sql.NVarChar(80), username || null)
        .input('cityCode', sql.NVarChar(30), city_code || null)
        .input('deviceId', sql.NVarChar(64), device_id || null)
        .input('passwordSecretRef', sql.NVarChar(200), password_secret_ref)
        .query(`
          INSERT INTO antojados_core.auth_identities
            (user_id, email_hash, display_name, username, city_code, device_id_first,
             password_secret_ref,
             status, created_at, updated_at)
          VALUES
            (@user_id, @emailHash, @displayName, @username, @cityCode, @deviceId,
             @passwordSecretRef,
             'active', SYSUTCDATETIME(), SYSUTCDATETIME())
        `);
    }

    const existingInstance = await new sql.Request(tr)
      .input('user_id', sql.NVarChar(64), effective_user_id)
      .query(`
        SELECT TOP 1 instance_id
        FROM antojados_core.sys_instancia WITH (UPDLOCK, HOLDLOCK)
        WHERE cuenta_id = @user_id
          AND instance_type = 'user'
        ORDER BY created_at DESC
      `);

    const existingUserInstanceId = existingInstance.recordset[0]?.instance_id || null;
    if (existingUserInstanceId) {
      user_instance_id = existingInstance.recordset[0].instance_id;
    } else {
      await new sql.Request(tr)
        .input('instance_id', sql.NVarChar(64), user_instance_id)
        .input('user_id', sql.NVarChar(64), effective_user_id)
        .query(`
          INSERT INTO antojados_core.sys_instancia
            (instance_id, cuenta_id, instance_type, tenant_id, status, created_at, updated_at)
          VALUES
            (@instance_id, @user_id, 'user', NULL, 'active', SYSUTCDATETIME(), SYSUTCDATETIME())
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
    user_id: effective_user_id,
    instance_id: user_instance_id,
    tenant_user_id: null,
    instance_type: 'user',
    status: 'active',
  };
}

module.exports = {
  registerSocialUser,
};
