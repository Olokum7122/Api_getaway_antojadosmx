'use strict';

const { getPool, sql, randomUUID } = require('./_shared');
const { createHash } = require('crypto');

const CONTRACT_ACCEPT_ACTIONS = new Set(['CONTRATO_ACCEPT', 'CONTRATO']);
const CONTRACT_RESOURCE_TYPES = new Set(['CONTRATO', 'CONTRATO_BASE']);
const CONTRACT_BASE_DOCUMENTS = [
  'ANTOJADOS_SPONSOR_SERVICES_MASTER_AGREEMENT_DRAFT_V1.md',
  'SPONSOR_SERVICES_ANNEX_MODEL_V1.md',
];

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function hashToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

function addHours(hours) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
}

async function getLatestSignature(pool, instanceId) {
  const result = await pool.request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .query(`
      SELECT TOP 1 signature_id, instance_id, representative_tenant_user_id,
             lifecycle_state, activated_at, revoked_at, updated_at
      FROM antojados_core.sys_electronic_signature_header
      WHERE instance_id = @instanceId
      ORDER BY created_at DESC, updated_at DESC
    `);
  return result.recordset[0] || null;
}

async function getLastActivation(pool, instanceId) {
  const result = await pool.request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .query(`
      SELECT TOP 1 activation_id, signature_id, instance_id, activation_state,
             channel, expires_at, opened_at, accepted_at, rejected_at, created_at
      FROM antojados_core.sys_electronic_signature_activation
      WHERE instance_id = @instanceId
      ORDER BY created_at DESC
    `);
  return result.recordset[0] || null;
}

async function createElectronicSignature(payload) {
  const instanceId = normalizeText(payload?.instance_id);
  const representativeTenantUserId = normalizeText(payload?.representative_tenant_user_id);
  if (!instanceId) throw Object.assign(new Error('instance_id es requerido'), { status: 400 });
  if (!representativeTenantUserId) throw Object.assign(new Error('representative_tenant_user_id es requerido'), { status: 400 });

  const pool = getPool('antojados');
  const member = await pool.request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .input('tenantUserId', sql.NVarChar(64), representativeTenantUserId)
    .query(`
      SELECT TOP 1 tu.id
      FROM antojados_core.biz_tenant_users tu
      INNER JOIN antojados_core.sys_instancia si
        ON si.instance_id = tu.instance_id
       AND si.instance_type = 'sponsor'
      WHERE tu.instance_id = @instanceId
        AND tu.id = @tenantUserId
        AND tu.is_legal_representative = 1
        AND tu.status = 'active'
    `);
  if (!member.recordset[0]) {
    throw Object.assign(new Error('El representante de eFirma no es representante legal activo de la instancia sponsor.'), { status: 409 });
  }

  const existing = await getLatestSignature(pool, instanceId);
  if (existing && !['REVOKED', 'EXPIRED'].includes(String(existing.lifecycle_state || '').toUpperCase())) {
    return { row: existing };
  }

  const signatureId = randomUUID();
  const result = await pool.request()
    .input('signatureId', sql.NVarChar(64), signatureId)
    .input('instanceId', sql.NVarChar(64), instanceId)
    .input('representativeTenantUserId', sql.NVarChar(64), representativeTenantUserId)
    .query(`
      INSERT INTO antojados_core.sys_electronic_signature_header
        (signature_id, instance_id, representative_tenant_user_id, lifecycle_state, created_at, updated_at)
      OUTPUT inserted.signature_id, inserted.instance_id, inserted.representative_tenant_user_id,
             inserted.lifecycle_state, inserted.activated_at, inserted.revoked_at, inserted.updated_at
      VALUES
        (@signatureId, @instanceId, @representativeTenantUserId, 'PENDING', SYSUTCDATETIME(), SYSUTCDATETIME())
    `);

  return { row: result.recordset[0] || null };
}

async function sendElectronicSignatureActivation(payload) {
  const instanceId = normalizeText(payload?.instance_id);
  const actorTenantUserId = normalizeText(payload?.actor_tenant_user_id);
  if (!instanceId) throw Object.assign(new Error('instance_id es requerido'), { status: 400 });
  if (!actorTenantUserId) throw Object.assign(new Error('actor_tenant_user_id es requerido'), { status: 400 });

  const pool = getPool('antojados');
  let signature = await getLatestSignature(pool, instanceId);
  if (!signature) {
    const created = await createElectronicSignature({
      instance_id: instanceId,
      representative_tenant_user_id: actorTenantUserId,
    });
    signature = created.row;
  }
  if (!signature?.signature_id) throw Object.assign(new Error('No fue posible resolver ciclo de eFirma.'), { status: 409 });

  const activationId = randomUUID();
  const activationToken = randomUUID();
  const tokenHash = hashToken(activationToken);
  const result = await pool.request()
    .input('activationId', sql.NVarChar(64), activationId)
    .input('signatureId', sql.NVarChar(64), signature.signature_id)
    .input('instanceId', sql.NVarChar(64), instanceId)
    .input('notifiedTenantUserId', sql.NVarChar(64), signature.representative_tenant_user_id || actorTenantUserId)
    .input('tokenHash', sql.NVarChar(512), tokenHash)
    .input('channel', sql.NVarChar(30), normalizeText(payload?.channel) || 'APP')
    .input('expiresAt', sql.DateTime2, addHours(24))
    .query(`
      INSERT INTO antojados_core.sys_electronic_signature_activation
        (activation_id, signature_id, instance_id, notified_tenant_user_id, token_hash,
         activation_state, channel, expires_at, created_at, updated_at)
      OUTPUT inserted.activation_id, inserted.signature_id, inserted.instance_id, inserted.activation_state,
             inserted.channel, inserted.expires_at, inserted.opened_at, inserted.accepted_at,
             inserted.rejected_at, inserted.created_at
      VALUES
        (@activationId, @signatureId, @instanceId, @notifiedTenantUserId, @tokenHash,
         'SENT', @channel, @expiresAt, SYSUTCDATETIME(), SYSUTCDATETIME())
    `);

  return {
    activation: result.recordset[0] || null,
    activation_token: activationToken,
  };
}

async function acceptElectronicSignatureActivation(payload) {
  const instanceId = normalizeText(payload?.instance_id);
  const activationId = normalizeText(payload?.activation_id);
  const actorTenantUserId = normalizeText(payload?.actor_tenant_user_id);
  if (!instanceId) throw Object.assign(new Error('instance_id es requerido'), { status: 400 });
  if (!activationId) throw Object.assign(new Error('activation_id es requerido'), { status: 400 });
  if (!actorTenantUserId) throw Object.assign(new Error('actor_tenant_user_id es requerido'), { status: 400 });
  if (payload?.credential_validated !== true) {
    throw Object.assign(new Error('Credencial requerida para aceptar eFirma.'), { status: 401 });
  }

  const pool = getPool('antojados');
  const tr = new sql.Transaction(pool);
  try {
    await tr.begin();

    const activationResult = await new sql.Request(tr)
      .input('instanceId', sql.NVarChar(64), instanceId)
      .input('activationId', sql.NVarChar(64), activationId)
      .query(`
        SELECT TOP 1 activation_id, signature_id, instance_id, activation_state, expires_at
        FROM antojados_core.sys_electronic_signature_activation WITH (UPDLOCK, HOLDLOCK)
        WHERE activation_id = @activationId
          AND instance_id = @instanceId
      `);
    const activation = activationResult.recordset[0] || null;
    if (!activation) throw Object.assign(new Error('Activacion de eFirma no encontrada.'), { status: 404 });
    if (new Date(activation.expires_at) < new Date()) {
      throw Object.assign(new Error('Activacion de eFirma expirada.'), { status: 410 });
    }

    await new sql.Request(tr)
      .input('activationId', sql.NVarChar(64), activationId)
      .query(`
        UPDATE antojados_core.sys_electronic_signature_activation
        SET activation_state = 'ACCEPTED',
            opened_at = COALESCE(opened_at, SYSUTCDATETIME()),
          accepted_at = SYSUTCDATETIME(),
          updated_at = SYSUTCDATETIME()
        WHERE activation_id = @activationId
      `);

    await new sql.Request(tr)
      .input('signatureId', sql.NVarChar(64), activation.signature_id)
      .query(`
        UPDATE antojados_core.sys_electronic_signature_header
        SET lifecycle_state = 'ACTIVE',
            activated_at = COALESCE(activated_at, SYSUTCDATETIME()),
            updated_at = SYSUTCDATETIME()
        WHERE signature_id = @signatureId
      `);

    await new sql.Request(tr)
      .input('instanceId', sql.NVarChar(64), instanceId)
      .query(`
        UPDATE antojados_core.sys_instancia
        SET status = 'pending_contract_signature',
            updated_at = SYSUTCDATETIME()
        WHERE instance_id = @instanceId
      `);

    await tr.commit();
  } catch (error) {
    try { await tr.rollback(); } catch (rollbackError) { console.warn('acceptElectronicSignatureActivation.rollback_failed', rollbackError); }
    throw error;
  }

  const signature = await getLatestSignature(pool, instanceId);
  const lastActivation = await getLastActivation(pool, instanceId);
  return { signature, activation: lastActivation };
}

async function authorizeElectronicSignatureAction(payload) {
  const instanceId = normalizeText(payload?.instance_id);
  const requestedByTenantUserId = normalizeText(payload?.requested_by_tenant_user_id);
  const actionCode = normalizeText(payload?.action_code);
  const resourceType = normalizeText(payload?.resource_type);
  const resourceId = normalizeText(payload?.resource_id);
  if (!instanceId) throw Object.assign(new Error('instance_id es requerido'), { status: 400 });
  if (!requestedByTenantUserId) throw Object.assign(new Error('requested_by_tenant_user_id es requerido'), { status: 400 });
  if (!actionCode) throw Object.assign(new Error('action_code es requerido'), { status: 400 });
  if (!resourceType) throw Object.assign(new Error('resource_type es requerido'), { status: 400 });
  if (!resourceId) throw Object.assign(new Error('resource_id es requerido'), { status: 400 });

  const authorizationId = randomUUID();
  const authorizationState = payload?.credential_validated === true ? 'AUTHORIZED' : 'REJECTED';
  const isContractAuthorization = CONTRACT_ACCEPT_ACTIONS.has(actionCode) && CONTRACT_RESOURCE_TYPES.has(resourceType);
  const pool = getPool('antojados');
  const tr = new sql.Transaction(pool);
  let row = null;

  try {
    await tr.begin();

    const signatureResult = await new sql.Request(tr)
      .input('instanceId', sql.NVarChar(64), instanceId)
      .query(`
        SELECT TOP 1 signature_id, instance_id, representative_tenant_user_id,
               lifecycle_state, activated_at, revoked_at, updated_at
        FROM antojados_core.sys_electronic_signature_header WITH (UPDLOCK, HOLDLOCK)
        WHERE instance_id = @instanceId
        ORDER BY created_at DESC, updated_at DESC
      `);
    const signature = signatureResult.recordset[0] || null;
    if (!signature || String(signature.lifecycle_state).toUpperCase() !== 'ACTIVE') {
      throw Object.assign(new Error('La eFirma no esta activa para autorizar esta accion.'), { status: 409 });
    }

    const result = await new sql.Request(tr)
      .input('authorizationId', sql.NVarChar(64), authorizationId)
      .input('signatureId', sql.NVarChar(64), signature.signature_id)
      .input('instanceId', sql.NVarChar(64), instanceId)
      .input('requestedBy', sql.NVarChar(64), requestedByTenantUserId)
      .input('actionCode', sql.NVarChar(80), actionCode)
      .input('resourceType', sql.NVarChar(80), resourceType)
      .input('resourceId', sql.NVarChar(128), resourceId)
      .input('authorizationState', sql.NVarChar(30), authorizationState)
      .input('expiresAt', sql.DateTime2, addHours(1))
      .query(`
        INSERT INTO antojados_core.sys_electronic_signature_authorization
          (authorization_id, signature_id, instance_id, requested_by_tenant_user_id,
           action_code, resource_type, resource_id, authorization_state,
           authorized_at, rejected_at, expires_at, created_at, updated_at)
        OUTPUT inserted.authorization_id, inserted.signature_id, inserted.instance_id,
               inserted.requested_by_tenant_user_id, inserted.operation_id, inserted.action_code,
               inserted.resource_type, inserted.resource_id, inserted.authorization_state,
               inserted.authorized_at, inserted.rejected_at, inserted.expires_at, inserted.created_at
        VALUES
          (@authorizationId, @signatureId, @instanceId, @requestedBy,
           @actionCode, @resourceType, @resourceId, @authorizationState,
           CASE WHEN @authorizationState = 'AUTHORIZED' THEN SYSUTCDATETIME() ELSE NULL END,
           CASE WHEN @authorizationState = 'REJECTED' THEN SYSUTCDATETIME() ELSE NULL END,
           @expiresAt, SYSUTCDATETIME(), SYSUTCDATETIME())
      `);
    row = result.recordset[0] || null;

    if (authorizationState === 'AUTHORIZED' && isContractAuthorization) {
      const evidencePayload = JSON.stringify({
        action_code: actionCode,
        resource_type: resourceType,
        resource_id: resourceId,
        authorization_id: authorizationId,
        accepted_documents: CONTRACT_BASE_DOCUMENTS,
      });

      await new sql.Request(tr)
        .input('signatureId', sql.NVarChar(64), signature.signature_id)
        .input('instanceId', sql.NVarChar(64), instanceId)
        .input('operationId', sql.NVarChar(240), authorizationId)
        .input('fingerprint', sql.NVarChar(512), hashToken(evidencePayload))
        .input('signaturePayload', sql.NVarChar(sql.MAX), evidencePayload)
        .query(`
          MERGE antojados_core.sys_electronic_signature_evidence AS target
          USING (SELECT @signatureId AS signature_id) AS source
             ON target.signature_id = source.signature_id
          WHEN MATCHED THEN
            UPDATE SET operation_id = @operationId,
                       provider_code = 'ANTOJADOS_APP',
                       algorithm = 'SHA256',
                       fingerprint = @fingerprint,
                       signature_payload_json = @signaturePayload,
                       updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (signature_id, instance_id, operation_id, provider_code, algorithm,
                    fingerprint, signature_payload_json, created_at, updated_at)
            VALUES (@signatureId, @instanceId, @operationId, 'ANTOJADOS_APP', 'SHA256',
                    @fingerprint, @signaturePayload, SYSUTCDATETIME(), SYSUTCDATETIME());
        `);

      await new sql.Request(tr)
        .input('instanceId', sql.NVarChar(64), instanceId)
        .query(`
          UPDATE antojados_core.sys_instancia
          SET status = 'active',
              updated_at = SYSUTCDATETIME()
          WHERE instance_id = @instanceId
        `);
    }

    await tr.commit();
  } catch (error) {
    try { await tr.rollback(); } catch (rollbackError) { console.warn('authorizeElectronicSignatureAction.rollback_failed', rollbackError); }
    throw error;
  }

  return { row };
}

async function getElectronicSignatureStatus(instanceId) {
  const normalizedInstanceId = normalizeText(instanceId);
  if (!normalizedInstanceId) throw Object.assign(new Error('instance_id es requerido'), { status: 400 });
  const pool = getPool('antojados');
  return {
    signature: await getLatestSignature(pool, normalizedInstanceId),
    last_activation: await getLastActivation(pool, normalizedInstanceId),
  };
}

module.exports = {
  createElectronicSignature,
  sendElectronicSignatureActivation,
  acceptElectronicSignatureActivation,
  authorizeElectronicSignatureAction,
  getElectronicSignatureStatus,
};
