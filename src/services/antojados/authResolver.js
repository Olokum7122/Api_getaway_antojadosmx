'use strict';
/**
 * authResolver.js — Resolver de Autenticación y Usuarios
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Autenticación (Auth)
 * RESPONSABLE:  Registro, login, perfil de usuarios, recuperación de
 *               contraseña (con transacciones), gestión de exploradores
 *               y asociaciones.
 *
 * NO HACE:
 *   - No maneja posts/feed (lo hacen postsResolver/bizResolver)
 *   - No maneja places (lo hace placesResolver)
 *
 * TABLAS QUE TOCA:
 *   antojados_core.auth_identities             → usuarios/identidades
 *   antojados_core.auth_password_recovery       → solicitudes de recuperación
 *   antojados_core.sys_instancia                → instancias de usuario/sponsor
 *   antojados_core.explorer_associations        → asociaciones de exploradores
 *
 * REFERENCIAS:
 *   - authMapper.js, auth.service.js
 *   - authSocialResolver.js (registro social)
 *   - authSponsorResolver.js (registro sponsor)
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql, randomUUID } = require('./_shared');
const { createHash } = require('crypto');
const { registerSocialUser } = require('./authSocialResolver');
const { registerSponsorUser, registerEmployeeWithInvite } = require('./authSponsorResolver');
const {
  deliverRecoveryCode,
  normalizeChannel,
  resolveTarget,
} = require('./passwordRecoveryDelivery');

function hashRecoveryCode(code) {
  return createHash('sha256').update(String(code || '').trim(), 'utf8').digest('hex');
}

function createRecoveryCode() {
  const code = Math.floor(100000 + Math.random() * 900000);
  return String(code);
}

async function ensurePasswordRecoverySchema(request) {
  await request.query(`
    IF OBJECT_ID(N'antojados_core.auth_password_recovery', N'U') IS NULL
    BEGIN
      CREATE TABLE antojados_core.auth_password_recovery (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        user_id NVARCHAR(64) NOT NULL,
        email_hash NVARCHAR(128) NOT NULL,
        recovery_code_hash NVARCHAR(64) NOT NULL,
        status NVARCHAR(20) NOT NULL,
        attempt_count INT NOT NULL CONSTRAINT DF_auth_password_recovery_attempt_count DEFAULT 0,
        max_attempts INT NOT NULL CONSTRAINT DF_auth_password_recovery_max_attempts DEFAULT 5,
        expires_at DATETIME2(3) NOT NULL,
        verified_at DATETIME2(3) NULL,
        used_at DATETIME2(3) NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_auth_password_recovery_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_auth_password_recovery_updated_at DEFAULT SYSUTCDATETIME()
      );

      CREATE INDEX IX_auth_password_recovery_email_status
        ON antojados_core.auth_password_recovery(email_hash, status, created_at DESC);
      CREATE INDEX IX_auth_password_recovery_user_status
        ON antojados_core.auth_password_recovery(user_id, status, created_at DESC);
    END

    IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'delivery_channel') IS NULL
      ALTER TABLE antojados_core.auth_password_recovery ADD delivery_channel NVARCHAR(20) NULL;
    IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'delivery_target_masked') IS NULL
      ALTER TABLE antojados_core.auth_password_recovery ADD delivery_target_masked NVARCHAR(150) NULL;
    IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'delivery_status') IS NULL
      ALTER TABLE antojados_core.auth_password_recovery ADD delivery_status NVARCHAR(30) NULL;
    IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'delivery_provider') IS NULL
      ALTER TABLE antojados_core.auth_password_recovery ADD delivery_provider NVARCHAR(60) NULL;
    IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'provider_message_id') IS NULL
      ALTER TABLE antojados_core.auth_password_recovery ADD provider_message_id NVARCHAR(160) NULL;
    IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'delivery_error') IS NULL
      ALTER TABLE antojados_core.auth_password_recovery ADD delivery_error NVARCHAR(1000) NULL;
    IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'sent_at') IS NULL
      ALTER TABLE antojados_core.auth_password_recovery ADD sent_at DATETIME2(3) NULL;
    IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'delivered_at') IS NULL
      ALTER TABLE antojados_core.auth_password_recovery ADD delivered_at DATETIME2(3) NULL;

    IF OBJECT_ID(N'antojados_core.auth_password_recovery_delivery_log', N'U') IS NULL
    BEGIN
      CREATE TABLE antojados_core.auth_password_recovery_delivery_log (
        delivery_log_id NVARCHAR(64) NOT NULL PRIMARY KEY,
        recovery_request_id NVARCHAR(64) NOT NULL,
        user_id NVARCHAR(64) NOT NULL,
        delivery_channel NVARCHAR(20) NOT NULL,
        delivery_target_masked NVARCHAR(150) NULL,
        provider NVARCHAR(60) NULL,
        provider_message_id NVARCHAR(160) NULL,
        status NVARCHAR(30) NOT NULL,
        error_message NVARCHAR(1000) NULL,
        raw_response NVARCHAR(MAX) NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_auth_recovery_delivery_log_created DEFAULT SYSUTCDATETIME()
      );
    END
  `);
}

async function ensureExplorerSchema(request) {
  await request.query(`
    IF COL_LENGTH(N'antojados_core.auth_identities', N'social_account_role_code') IS NULL
      ALTER TABLE antojados_core.auth_identities ADD social_account_role_code NVARCHAR(40) NULL;

    IF COL_LENGTH(N'antojados_core.auth_identities', N'collaboration_type_code') IS NULL
      ALTER TABLE antojados_core.auth_identities ADD collaboration_type_code NVARCHAR(40) NULL;

    IF COL_LENGTH(N'antojados_core.auth_identities', N'corp_instance_id') IS NULL
      ALTER TABLE antojados_core.auth_identities ADD corp_instance_id NVARCHAR(64) NULL;

    IF COL_LENGTH(N'antojados_core.auth_identities', N'program_instance_id') IS NULL
      ALTER TABLE antojados_core.auth_identities ADD program_instance_id NVARCHAR(64) NULL;

    IF COL_LENGTH(N'antojados_core.auth_identities', N'commission_profile_code') IS NULL
      ALTER TABLE antojados_core.auth_identities ADD commission_profile_code NVARCHAR(40) NULL;

    IF COL_LENGTH(N'antojados_core.auth_identities', N'economic_status') IS NULL
      ALTER TABLE antojados_core.auth_identities ADD economic_status NVARCHAR(40) NULL;

    IF OBJECT_ID(N'antojados_core.explorer_associations', N'U') IS NULL
    BEGIN
      CREATE TABLE antojados_core.explorer_associations (
        association_id       NVARCHAR(64)  NOT NULL PRIMARY KEY,
        explorer_user_id     NVARCHAR(64)  NOT NULL,
        explorer_instance_id NVARCHAR(64)  NOT NULL,
        target_type          NVARCHAR(20)  NOT NULL,
        associated_instance_id NVARCHAR(64) NOT NULL,
        association_source   NVARCHAR(30)  NOT NULL CONSTRAINT DF_explorer_assoc_source DEFAULT (N'manual'),
        status               NVARCHAR(20)  NOT NULL CONSTRAINT DF_explorer_assoc_status DEFAULT (N'active'),
        notes                NVARCHAR(500) NULL,
        created_by           NVARCHAR(64)  NULL,
        created_at           DATETIME2(3)  NOT NULL CONSTRAINT DF_explorer_assoc_created_at DEFAULT SYSUTCDATETIME(),
        updated_at           DATETIME2(3)  NOT NULL CONSTRAINT DF_explorer_assoc_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_explorer_assoc_target_type CHECK (target_type IN (N'user', N'sponsor')),
        CONSTRAINT CK_explorer_assoc_status CHECK (status IN (N'active', N'inactive')),
        CONSTRAINT FK_explorer_assoc_explorer FOREIGN KEY (explorer_user_id)
          REFERENCES antojados_core.auth_identities(user_id),
        CONSTRAINT FK_explorer_assoc_explorer_instance FOREIGN KEY (explorer_instance_id)
          REFERENCES antojados_core.sys_instancia(instance_id),
        CONSTRAINT FK_explorer_assoc_associated_instance FOREIGN KEY (associated_instance_id)
          REFERENCES antojados_core.sys_instancia(instance_id)
      );
    END;

    IF COL_LENGTH(N'antojados_core.explorer_associations', N'explorer_instance_id') IS NULL
      ALTER TABLE antojados_core.explorer_associations ADD explorer_instance_id NVARCHAR(64) NULL;

    IF COL_LENGTH(N'antojados_core.explorer_associations', N'associated_instance_id') IS NULL
      ALTER TABLE antojados_core.explorer_associations ADD associated_instance_id NVARCHAR(64) NULL;

    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE parent_object_id = OBJECT_ID(N'antojados_core.explorer_associations')
        AND name = N'CK_explorer_assoc_target_required'
    )
      ALTER TABLE antojados_core.explorer_associations DROP CONSTRAINT CK_explorer_assoc_target_required;

    UPDATE ea
    SET explorer_instance_id = si.instance_id,
        updated_at = SYSUTCDATETIME()
    FROM antojados_core.explorer_associations ea
    INNER JOIN antojados_core.sys_instancia si
      ON si.cuenta_id = ea.explorer_user_id
     AND si.instance_type = N'user'
    WHERE ea.explorer_instance_id IS NULL;

    IF COL_LENGTH(N'antojados_core.explorer_associations', N'associated_user_id') IS NOT NULL
    BEGIN
      EXEC('
        UPDATE ea
        SET associated_instance_id = si.instance_id,
            updated_at = SYSUTCDATETIME()
        FROM antojados_core.explorer_associations ea
        INNER JOIN antojados_core.sys_instancia si
          ON si.cuenta_id = ea.associated_user_id
         AND si.instance_type = ea.target_type
        WHERE ea.associated_instance_id IS NULL
          AND ea.associated_user_id IS NOT NULL
      ');
    END;

    IF COL_LENGTH(N'antojados_core.explorer_associations', N'associated_user_id') IS NOT NULL
    BEGIN
      EXEC('
        UPDATE ea
        SET associated_instance_id = si.instance_id,
            updated_at = SYSUTCDATETIME()
        FROM antojados_core.explorer_associations ea
        INNER JOIN antojados_core.sys_instancia si
          ON si.user_id = ea.associated_user_id
         AND si.instance_type = N''sponsor''
        WHERE ea.associated_instance_id IS NULL
          AND ea.target_type = N''sponsor''
          AND ea.associated_user_id IS NOT NULL
      ');
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE object_id = OBJECT_ID(N'antojados_core.explorer_associations')
        AND name = N'IX_explorer_assoc_explorer'
    )
      CREATE INDEX IX_explorer_assoc_explorer
        ON antojados_core.explorer_associations(explorer_user_id, status, target_type);

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE object_id = OBJECT_ID(N'antojados_core.explorer_associations')
        AND name = N'IX_explorer_assoc_explorer_instance'
    )
      CREATE INDEX IX_explorer_assoc_explorer_instance
        ON antojados_core.explorer_associations(explorer_instance_id, status, target_type)
        WHERE explorer_instance_id IS NOT NULL;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE object_id = OBJECT_ID(N'antojados_core.explorer_associations')
        AND name = N'IX_explorer_assoc_associated_instance'
    )
      CREATE INDEX IX_explorer_assoc_associated_instance
        ON antojados_core.explorer_associations(associated_instance_id, status)
        WHERE associated_instance_id IS NOT NULL;

  `);
}

async function registerUser(payload) {
  const effectiveInstanceType = String(payload?.instance_type || 'user').trim().toLowerCase();
  if (effectiveInstanceType === 'sponsor') {
    return registerSponsorUser(payload);
  }
  return registerSocialUser(payload);
}

async function loginUser({ email_hash, login_identifier, password_secret_ref }) {
  const result = await getPool('antojados').request()
    .input('emailHash', sql.NVarChar(128), email_hash)
    .input('loginIdentifier', sql.NVarChar(150), login_identifier ? String(login_identifier).trim().toLowerCase() : null)
    .input('passwordSecretRef', sql.NVarChar(200), password_secret_ref)
    .query(`
      SELECT TOP 1 ai.user_id, ai.display_name, ai.username,
             ai.avatar_url, ai.bio,
             ai.social_account_role_code, ai.collaboration_type_code,
             ai.corp_instance_id, ai.program_instance_id, ai.commission_profile_code,
             ai.economic_status, ai.status,
             COALESCE(sponsor_ctx.instance_id, user_ctx.instance_id) AS instance_id,
             sponsor_ctx.tenant_user_id,
             CASE
               WHEN sponsor_ctx.instance_id IS NOT NULL THEN 'sponsor'
               WHEN user_ctx.instance_id IS NOT NULL THEN 'user'
               ELSE NULL
             END AS instance_type
      FROM antojados_core.auth_identities ai
      OUTER APPLY (
        SELECT TOP 1 si.instance_id, btu.id AS tenant_user_id
        FROM antojados_core.biz_tenant_users btu
        INNER JOIN antojados_core.sys_instancia si
          ON si.instance_id = btu.instance_id
         AND si.instance_type = 'sponsor'
        WHERE btu.user_id = ai.user_id
          AND btu.status = 'active'
        ORDER BY btu.created_at DESC
      ) sponsor_ctx
      OUTER APPLY (
        SELECT TOP 1 si.instance_id
        FROM antojados_core.sys_instancia si
        WHERE si.cuenta_id = ai.user_id
          AND si.instance_type = 'user'
        ORDER BY si.created_at DESC
      ) user_ctx
      WHERE (
             ai.email_hash = @emailHash
          OR LOWER(ai.username) = @loginIdentifier
      )
        AND ai.password_secret_ref = @passwordSecretRef
        AND ai.status = 'active'
    `);
  // ⚠️ DB-V002 corregido: ya NO se devuelve city_code en login.
  // La ciudad debe resolverse desde geoResolver.resolveBarContext().
  return result.recordset[0] || null;
}

async function getProfile(user_id) {
  const result = await getPool('antojados').request()
    .input('user_id', sql.NVarChar(64), user_id)
    .query(`
      SELECT user_id, display_name, username,
             avatar_url, bio,
             instagram_handle, facebook_url, tiktok_handle, x_handle, whatsapp_number,
             follower_count, following_count, reputation_level,
             verified_reviewer, social_account_role_code, collaboration_type_code,
             corp_instance_id, program_instance_id, commission_profile_code,
             economic_status, status, created_at
      FROM antojados_core.auth_identities
      WHERE user_id = @user_id
    `);
  // ⚠️ DB-V002 corregido: ya NO se devuelve city_code desde auth_identities.
  // La ciudad de contexto se resuelve desde geoResolver.resolveBarContext().
  return result.recordset[0] || null;
}

async function setExplorerStatus(user_id, payload = {}) {
  const enabled = payload.enabled !== false;
  const updated_by = payload.updated_by || null;
  const pool = getPool('antojados');
  await ensureExplorerSchema(pool.request());

  const result = await pool.request()
    .input('user_id', sql.NVarChar(64), user_id)
    .input('enabled', sql.Bit, enabled ? 1 : 0)
    .input('corp_instance_id', sql.NVarChar(64), payload.corp_instance_id || null)
    .input('program_instance_id', sql.NVarChar(64), payload.program_instance_id || null)
    .input('commission_profile_code', sql.NVarChar(40), payload.commission_profile_code || null)
    .input('economic_status', sql.NVarChar(40), enabled ? (payload.economic_status || 'active') : 'inactive')
    .execute('antojados_core.sp_explorer_status_set');

  const row = result.recordset[0] || null;
  if (!row) throw Object.assign(new Error('Usuario no encontrado o sin instancia user activa'), { status: 404 });
  return { ...row, updated_by: updated_by || null };
}

async function listExplorers({ city_code = null, limit = 50, offset = 0 } = {}) {
  const pool = getPool('antojados');
  await ensureExplorerSchema(pool.request());
  const result = await pool.request()
    .input('city_code', sql.NVarChar(30), city_code || null)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .execute('antojados_core.sp_explorers_list');
  return result.recordset;
}

function normalizeExplorerTarget(payload) {
  const targetType = String(payload?.target_type || '').trim().toLowerCase();
  if (!['user', 'sponsor'].includes(targetType)) {
    throw Object.assign(new Error('target_type debe ser user o sponsor'), { status: 400 });
  }

  const associatedInstanceId = String(
    payload?.associated_instance_id || payload?.target_instance_id || '',
  ).trim() || null;
  if (!associatedInstanceId) {
    throw Object.assign(new Error('associated_instance_id es requerido'), { status: 400 });
  }

  return { targetType, associatedInstanceId };
}

async function linkExplorerAssociation(explorer_user_id, payload = {}) {
  const { targetType, associatedInstanceId } = normalizeExplorerTarget(payload);
  const pool = getPool('antojados');
  await ensureExplorerSchema(pool.request());

  try {
    const result = await pool.request()
      .input('explorer_user_id', sql.NVarChar(64), explorer_user_id)
      .input('target_type', sql.NVarChar(20), targetType)
      .input('associated_instance_id', sql.NVarChar(64), associatedInstanceId)
      .input('association_source', sql.NVarChar(30), String(payload.association_source || 'manual').trim().slice(0, 30))
      .input('notes', sql.NVarChar(500), payload.notes ? String(payload.notes).slice(0, 500) : null)
      .input('created_by', sql.NVarChar(64), payload.created_by || null)
      .execute('antojados_core.sp_explorer_association_upsert');
    return result.recordset[0];
  } catch (e) {
    if (e?.number >= 51000 && e?.number <= 51002) {
      e.status = e.number === 51000 || e.number === 51002 ? 404 : 400;
    }
    throw e;
  }
}

async function listExplorerAssociations(explorer_user_id, { status = 'active', target_type = null, limit = 100, offset = 0 } = {}) {
  const pool = getPool('antojados');
  await ensureExplorerSchema(pool.request());
  const result = await pool.request()
    .input('explorer_user_id', sql.NVarChar(64), explorer_user_id)
    .input('status', sql.NVarChar(20), status || null)
    .input('target_type', sql.NVarChar(20), target_type || null)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .execute('antojados_core.sp_explorer_association_list');
  return result.recordset;
}

async function updateExplorerAssociation(explorer_user_id, association_id, { status, notes = null, updated_by = null } = {}) {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (!['active', 'inactive'].includes(normalizedStatus)) {
    throw Object.assign(new Error('status debe ser active o inactive'), { status: 400 });
  }

  const pool = getPool('antojados');
  await ensureExplorerSchema(pool.request());
  const result = await pool.request()
    .input('explorer_user_id', sql.NVarChar(64), explorer_user_id)
    .input('association_id', sql.NVarChar(64), association_id)
    .input('status', sql.NVarChar(20), normalizedStatus)
    .input('notes', sql.NVarChar(500), notes ? String(notes).slice(0, 500) : null)
    .execute('antojados_core.sp_explorer_association_status_set');

  const row = result.recordset[0] || null;
  if (!row) throw Object.assign(new Error('Asociacion no encontrada para este explorador'), { status: 404 });
  return { ...row, updated_by: updated_by || null };
}

async function getExplorerActivity(explorer_user_id, { days = 14 } = {}) {
  const normalizedDays = Math.min(90, Math.max(1, parseInt(days || 14, 10)));
  const pool = getPool('antojados');
  await ensureExplorerSchema(pool.request());
  const result = await pool.request()
    .input('explorer_user_id', sql.NVarChar(64), explorer_user_id)
    .input('days', sql.Int, normalizedDays)
    .execute('antojados_core.sp_explorer_activity_get');

  return {
    explorer_user_id,
    days: normalizedDays,
    summary: result.recordsets?.[0]?.[0] || {},
    associations: result.recordsets?.[1] || [],
  };
}

async function listExplorersActivity({ city_code = null, days = 14, limit = 50, offset = 0 } = {}) {
  const normalizedDays = Math.min(90, Math.max(1, parseInt(days || 14, 10)));
  const pool = getPool('antojados');
  await ensureExplorerSchema(pool.request());
  const result = await pool.request()
    .input('city_code', sql.NVarChar(30), city_code || null)
    .input('days', sql.Int, normalizedDays)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .execute('antojados_core.sp_explorers_activity_list');

  return {
    days: normalizedDays,
    data: result.recordset,
    limit,
    offset,
  };
}

async function updateProfile(user_id, { display_name, username, bio, avatar_url, city_code,
  instagram_handle, facebook_url, tiktok_handle, x_handle, whatsapp_number }) {
  // ⚠️ DB-V002 corregido: city_code NO se actualiza en auth_identities.
  // La ciudad del usuario se resuelve desde geoResolver.resolveBarContext(),
  // no desde el perfil. El parámetro city_code se ignora intencionalmente.
  await getPool('antojados').request()
    .input('user_id', sql.NVarChar(64), user_id)
    .input('displayName', sql.NVarChar(150), display_name ?? null)
    .input('username', sql.NVarChar(80), username ?? null)
    .input('bio', sql.NVarChar(500), bio ?? null)
    .input('avatarUrl', sql.NVarChar(500), avatar_url ?? null)
    .input('instagramHandle', sql.NVarChar(100), instagram_handle ?? null)
    .input('facebookUrl', sql.NVarChar(300), facebook_url ?? null)
    .input('tiktokHandle', sql.NVarChar(100), tiktok_handle ?? null)
    .input('xHandle', sql.NVarChar(100), x_handle ?? null)
    .input('whatsappNumber', sql.NVarChar(30), whatsapp_number ?? null)
    .query(`
      UPDATE antojados_core.auth_identities
      SET display_name     = COALESCE(@displayName, display_name),
          username         = COALESCE(@username, username),
          bio              = COALESCE(@bio, bio),
          avatar_url       = COALESCE(@avatarUrl, avatar_url),
          instagram_handle = COALESCE(@instagramHandle, instagram_handle),
          facebook_url     = COALESCE(@facebookUrl, facebook_url),
          tiktok_handle    = COALESCE(@tiktokHandle, tiktok_handle),
          x_handle         = COALESCE(@xHandle, x_handle),
          whatsapp_number  = COALESCE(@whatsappNumber, whatsapp_number),
          updated_at       = SYSUTCDATETIME()
      WHERE user_id = @user_id
        AND (
          @displayName IS NOT NULL OR @username IS NOT NULL OR @bio IS NOT NULL OR
          @avatarUrl IS NOT NULL OR @instagramHandle IS NOT NULL OR
          @facebookUrl IS NOT NULL OR @tiktokHandle IS NOT NULL OR @xHandle IS NOT NULL OR
          @whatsappNumber IS NOT NULL
        )
    `);
}

async function recordPasswordRecoveryDelivery({
  recovery_request_id,
  user_id,
  delivery_channel,
  delivery_target_masked,
  delivery,
}) {
  const status = delivery.status || 'unknown';
  const rawResponse = delivery.rawResponse ? JSON.stringify(delivery.rawResponse).slice(0, 4000) : null;

  await getPool('antojados').request()
    .input('id', sql.NVarChar(64), recovery_request_id)
    .input('deliveryLogId', sql.NVarChar(64), randomUUID())
    .input('user_id', sql.NVarChar(64), user_id)
    .input('channel', sql.NVarChar(20), delivery_channel)
    .input('targetMasked', sql.NVarChar(150), delivery_target_masked)
    .input('status', sql.NVarChar(30), status)
    .input('provider', sql.NVarChar(60), delivery.provider || null)
    .input('providerMessageId', sql.NVarChar(160), delivery.providerMessageId || null)
    .input('errorMessage', sql.NVarChar(1000), delivery.error || null)
    .input('rawResponse', sql.NVarChar(sql.MAX), rawResponse)
    .query(`
      UPDATE antojados_core.auth_password_recovery
      SET delivery_channel = @channel,
          delivery_target_masked = @targetMasked,
          delivery_status = @status,
          delivery_provider = @provider,
          provider_message_id = @providerMessageId,
          delivery_error = @errorMessage,
          sent_at = CASE WHEN @status IN (N'sent', N'dev_direct_response') THEN SYSUTCDATETIME() ELSE sent_at END,
          updated_at = SYSUTCDATETIME()
      WHERE id = @id;

      INSERT INTO antojados_core.auth_password_recovery_delivery_log
        (delivery_log_id, recovery_request_id, user_id, delivery_channel, delivery_target_masked,
         provider, provider_message_id, status, error_message, raw_response)
      VALUES
        (@deliveryLogId, @id, @user_id, @channel, @targetMasked,
         @provider, @providerMessageId, @status, @errorMessage, @rawResponse);
    `);
}

async function requestPasswordRecovery({ email_hash, delivery_channel, email }) {
  if (!email_hash) {
    throw Object.assign(new Error('email_hash es requerido'), { status: 400 });
  }
  if (!/^[a-f0-9]{64}$/i.test(String(email_hash))) {
    throw Object.assign(new Error('email_hash inválido: debe ser SHA-256 hexadecimal de 64 caracteres'), { status: 400 });
  }

  const pool = getPool('antojados');
  const tr = new sql.Transaction(pool);
  const channel = normalizeChannel(delivery_channel);

  try {
    await tr.begin();
    const schemaRequest = new sql.Request(tr);
    await ensurePasswordRecoverySchema(schemaRequest);

    const identity = await new sql.Request(tr)
      .input('emailHash', sql.NVarChar(128), email_hash)
      .query(`
        SELECT TOP 1 user_id, status, phone_e164
        FROM antojados_core.auth_identities WITH (UPDLOCK, HOLDLOCK)
        WHERE email_hash = @emailHash
      `);

    const identityRow = identity.recordset[0] || null;
    if (!identityRow) {
      throw Object.assign(new Error('No existe una cuenta para ese correo'), { status: 404 });
    }
    if (String(identityRow.status || '').toLowerCase() !== 'active') {
      throw Object.assign(new Error('La cuenta existe pero no está activa'), { status: 409 });
    }

    const throttle = await new sql.Request(tr)
      .input('emailHash', sql.NVarChar(128), email_hash)
      .query(`
        SELECT TOP 1 created_at
        FROM antojados_core.auth_password_recovery
        WHERE email_hash = @emailHash
          AND status IN ('pending', 'verified')
        ORDER BY created_at DESC
      `);

    const latestRequest = throttle.recordset[0] || null;
    if (latestRequest?.created_at) {
      const elapsedSeconds = Math.floor((Date.now() - new Date(latestRequest.created_at).getTime()) / 1000);
      if (elapsedSeconds < 60) {
        throw Object.assign(
          new Error(`Espera ${60 - elapsedSeconds}s antes de solicitar otro código`),
          { status: 429 },
        );
      }
    }

    const recoveryId = require('crypto').randomUUID();
    const recoveryCode = createRecoveryCode();
    const recoveryCodeHash = hashRecoveryCode(recoveryCode);
    const target = resolveTarget({
      channel,
      email,
      phone_e164: identityRow.phone_e164,
    });

    await new sql.Request(tr)
      .input('id', sql.NVarChar(64), recoveryId)
      .input('user_id', sql.NVarChar(64), identityRow.user_id)
      .input('emailHash', sql.NVarChar(128), email_hash)
      .input('recoveryCodeHash', sql.NVarChar(64), recoveryCodeHash)
      .input('channel', sql.NVarChar(20), channel)
      .input('targetMasked', sql.NVarChar(150), target.masked)
      .query(`
        INSERT INTO antojados_core.auth_password_recovery
          (id, user_id, email_hash, recovery_code_hash, status, expires_at,
           delivery_channel, delivery_target_masked, delivery_status)
        VALUES
          (@id, @user_id, @emailHash, @recoveryCodeHash, 'pending', DATEADD(MINUTE, 15, SYSUTCDATETIME()),
           @channel, @targetMasked, 'created')
      `);

    await tr.commit();

    const delivery = await deliverRecoveryCode({
      channel,
      target: target.target,
      code: recoveryCode,
      recovery_request_id: recoveryId,
      user_id: identityRow.user_id,
    });

    await recordPasswordRecoveryDelivery({
      recovery_request_id: recoveryId,
      user_id: identityRow.user_id,
      delivery_channel: channel,
      delivery_target_masked: target.masked,
      delivery,
    });

    const allowDirectCode = String(process.env.PASSWORD_RECOVERY_ALLOW_DIRECT_CODE || '').toLowerCase() === 'true';
    if (!allowDirectCode && !['sent', 'dev_direct_response'].includes(delivery.status)) {
      throw Object.assign(new Error(delivery.error || 'No se pudo enviar el codigo de recuperacion'), { status: 503 });
    }

    return {
      recovery_request_id: recoveryId,
      recovery_code: allowDirectCode ? recoveryCode : null,
      expires_in_seconds: 900,
      delivery_channel: channel,
      delivery_status: delivery.status,
      delivery_target_masked: target.masked,
      message: delivery.status === 'dev_direct_response'
        ? 'Codigo de recuperacion generado en modo desarrollo. Expira en 15 minutos.'
        : 'Codigo de recuperacion enviado. Expira en 15 minutos.',
    };
  } catch (e) {
    try {
      await tr.rollback();
    } catch (rollbackError) {
      console.warn('requestPasswordRecovery.rollback_failed', rollbackError);
    }
    throw e;
  }
}

async function verifyPasswordRecoveryCode({ recovery_request_id, recovery_code }) {
  if (!recovery_request_id || !recovery_code) {
    throw Object.assign(new Error('recovery_request_id y recovery_code son requeridos'), { status: 400 });
  }

  const pool = getPool('antojados');
  const tr = new sql.Transaction(pool);
  const recoveryCodeHash = hashRecoveryCode(recovery_code);

  try {
    await tr.begin();
    await ensurePasswordRecoverySchema(new sql.Request(tr));

    const lookup = await new sql.Request(tr)
      .input('id', sql.NVarChar(64), recovery_request_id)
      .query(`
        SELECT TOP 1 id, status, attempt_count, max_attempts, expires_at, recovery_code_hash
        FROM antojados_core.auth_password_recovery WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @id
      `);

    const row = lookup.recordset[0] || null;
    if (!row) {
      throw Object.assign(new Error('Solicitud de recuperación no encontrada'), { status: 404 });
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await new sql.Request(tr)
        .input('id', sql.NVarChar(64), recovery_request_id)
        .query(`
          UPDATE antojados_core.auth_password_recovery
          SET status = 'expired',
              updated_at = SYSUTCDATETIME()
          WHERE id = @id
        `);
      throw Object.assign(new Error('El código de recuperación expiró'), { status: 410 });
    }

    if (row.status === 'used') {
      throw Object.assign(new Error('La solicitud de recuperación ya fue utilizada'), { status: 409 });
    }

    if (row.attempt_count >= row.max_attempts) {
      await new sql.Request(tr)
        .input('id', sql.NVarChar(64), recovery_request_id)
        .query(`
          UPDATE antojados_core.auth_password_recovery
          SET status = 'expired',
              updated_at = SYSUTCDATETIME()
          WHERE id = @id
        `);
      throw Object.assign(new Error('Se alcanzó el máximo de intentos para este código'), { status: 429 });
    }

    if (String(row.recovery_code_hash) !== recoveryCodeHash) {
      await new sql.Request(tr)
        .input('id', sql.NVarChar(64), recovery_request_id)
        .query(`
          UPDATE antojados_core.auth_password_recovery
          SET attempt_count = attempt_count + 1,
              updated_at = SYSUTCDATETIME()
          WHERE id = @id
        `);
      throw Object.assign(new Error('Código de recuperación inválido'), { status: 401 });
    }

    await new sql.Request(tr)
      .input('id', sql.NVarChar(64), recovery_request_id)
      .query(`
        UPDATE antojados_core.auth_password_recovery
        SET status = 'verified',
            verified_at = CASE WHEN verified_at IS NULL THEN SYSUTCDATETIME() ELSE verified_at END,
            updated_at = SYSUTCDATETIME()
        WHERE id = @id
      `);

    await tr.commit();
    return {
      recovery_request_id,
      verified: true,
      message: 'Código válido. Puedes actualizar la contraseña.',
    };
  } catch (e) {
    try {
      await tr.rollback();
    } catch (rollbackError) {
      console.warn('verifyPasswordRecoveryCode.rollback_failed', rollbackError);
    }
    throw e;
  }
}

async function resetPasswordWithRecovery({ recovery_request_id, recovery_code, password_secret_ref, password_confirm_secret_ref, confirm_password_secret_ref }) {
  if (!recovery_request_id || !recovery_code || !password_secret_ref) {
    throw Object.assign(new Error('recovery_request_id, recovery_code y password_secret_ref son requeridos'), { status: 400 });
  }
  if (!/^sha256:[a-f0-9]{64}$/i.test(String(password_secret_ref))) {
    throw Object.assign(new Error('password_secret_ref inválido: debe usar formato sha256:<64 hex>'), { status: 400 });
  }

  const passwordConfirmRef = password_confirm_secret_ref || confirm_password_secret_ref || null;
  if (passwordConfirmRef && String(passwordConfirmRef) !== String(password_secret_ref)) {
    throw Object.assign(new Error('La confirmación de contraseña no coincide'), { status: 400 });
  }

  const pool = getPool('antojados');
  const tr = new sql.Transaction(pool);
  const recoveryCodeHash = hashRecoveryCode(recovery_code);

  try {
    await tr.begin();
    await ensurePasswordRecoverySchema(new sql.Request(tr));

    const lookup = await new sql.Request(tr)
      .input('id', sql.NVarChar(64), recovery_request_id)
      .query(`
        SELECT TOP 1 id, user_id, status, expires_at, recovery_code_hash
        FROM antojados_core.auth_password_recovery WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @id
      `);

    const row = lookup.recordset[0] || null;
    if (!row) {
      throw Object.assign(new Error('Solicitud de recuperación no encontrada'), { status: 404 });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw Object.assign(new Error('El código de recuperación expiró'), { status: 410 });
    }
    if (row.status === 'used') {
      throw Object.assign(new Error('La solicitud de recuperación ya fue utilizada'), { status: 409 });
    }
    if (String(row.recovery_code_hash) !== recoveryCodeHash) {
      throw Object.assign(new Error('Código de recuperación inválido'), { status: 401 });
    }

    await new sql.Request(tr)
      .input('user_id', sql.NVarChar(64), row.user_id)
      .input('passwordSecretRef', sql.NVarChar(200), password_secret_ref)
      .query(`
        UPDATE antojados_core.auth_identities
        SET password_secret_ref = @passwordSecretRef,
            updated_at = SYSUTCDATETIME()
        WHERE user_id = @user_id
      `);

    await new sql.Request(tr)
      .input('id', sql.NVarChar(64), recovery_request_id)
      .query(`
        UPDATE antojados_core.auth_password_recovery
        SET status = 'used',
            verified_at = CASE WHEN verified_at IS NULL THEN SYSUTCDATETIME() ELSE verified_at END,
            used_at = SYSUTCDATETIME(),
            updated_at = SYSUTCDATETIME()
        WHERE id = @id
      `);

    await tr.commit();
    return {
      recovery_request_id,
      user_id: row.user_id,
      password_updated: true,
      message: 'Contraseña actualizada correctamente',
    };
  } catch (e) {
    try {
      await tr.rollback();
    } catch (rollbackError) {
      console.warn('resetPasswordWithRecovery.rollback_failed', rollbackError);
    }
    throw e;
  }
}

module.exports = {
  registerUser,
  registerEmployeeWithInvite,
  loginUser,
  getProfile,
  updateProfile,
  requestPasswordRecovery,
  verifyPasswordRecoveryCode,
  resetPasswordWithRecovery,
  setExplorerStatus,
  listExplorers,
  linkExplorerAssociation,
  listExplorerAssociations,
  updateExplorerAssociation,
  getExplorerActivity,
  listExplorersActivity,
};
