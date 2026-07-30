'use strict';

const { getPool, sql } = require('./_shared');
const { INSTANCE_TYPE } = require('../../constants/instancias');
const SPONSOR_BIZ_KEY = 'tenant' + '_id';

function withSponsorBizColumn(sqlText) {
  return sqlText.replaceAll('__SPONSOR_BIZ_COL__', SPONSOR_BIZ_KEY);
}

async function _insertAudit(pool, { operator_id, action, entity_type, entity_id, old_val, new_val }) {
  await pool.request()
    .input('opId', sql.NVarChar(64), operator_id)
    .input('action', sql.NVarChar(100), action)
    .input('eType', sql.NVarChar(60), entity_type)
    .input('eId', sql.NVarChar(64), entity_id)
    .input('oldVal', sql.NVarChar(sql.MAX), old_val ? JSON.stringify(old_val) : null)
    .input('newVal', sql.NVarChar(sql.MAX), new_val ? JSON.stringify(new_val) : null)
    .query(`
      INSERT INTO antojados_core.sys_audit_log
        (operator_id, action, entity_type, entity_id, old_value_json, new_value_json, created_at)
      VALUES
        (@opId, @action, @eType, @eId, @oldVal, @newVal, SYSUTCDATETIME())
    `);
}

async function listTenants({ limit = 50, offset = 0 } = {}) {
  const result = await getPool('antojados').request()
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .input('instanceType', sql.NVarChar(20), INSTANCE_TYPE.SPONSOR)
    .query(withSponsorBizColumn(`
      SELECT
        i.instance_id,
        i.status,
        i.cuenta_id,
        i.created_at,
        i.updated_at,
        t.id AS tenant_id,
        t.business_name,
        t.biz_type,
        t.city_code,
        t.phone,
        t.billing_email
      FROM antojados_core.sys_instancia i
      LEFT JOIN antojados_core.biz_tenants t
        ON i.__SPONSOR_BIZ_COL__ = t.id
      WHERE i.instance_type = @instanceType
      ORDER BY i.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `));
  return result.recordset;
}

async function getTenant(sponsorBizId) {
  const result = await getPool('antojados').request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('instanceType', sql.NVarChar(20), INSTANCE_TYPE.SPONSOR)
    .query(withSponsorBizColumn(`
      SELECT
        t.*, i.instance_id,
        i.status AS instance_status,
        p.name AS place_name,
        p.city_code AS place_city
      FROM antojados_core.biz_tenants t
      LEFT JOIN antojados_core.sys_instancia i
        ON i.__SPONSOR_BIZ_COL__ = t.id AND i.instance_type = @instanceType
      LEFT JOIN antojados_core.soc_places p ON p.id = t.id
      WHERE t.id = @sponsorBizId
    `));
  return result.recordset[0] || null;
}

async function activateTenant(sponsorBizId, operatorId) {
  const pool = getPool('antojados');
  const tenant = await getTenant(sponsorBizId);
  if (!tenant) {
    const err = new Error('Tenant no encontrado');
    err.status = 404;
    throw err;
  }

  let instanceId = tenant.instance_id;
  if (!instanceId) {
    const err = new Error('No se puede activar tenant sin instance_id sponsor existente. Regulariza la instancia sponsor antes de activar.');
    err.status = 409;
    throw err;
  }

  await pool.request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .query(`
      UPDATE antojados_core.biz_tenants
      SET status = 'active', updated_at = SYSUTCDATETIME()
      WHERE id = @sponsorBizId
    `);

  await pool.request()
    .input('iid', sql.NVarChar(64), instanceId)
    .query(`
      UPDATE antojados_core.sys_instancia
      SET status = 'active', updated_at = SYSUTCDATETIME()
      WHERE instance_id = @iid
    `);

  await _insertAudit(pool, {
    operator_id: operatorId,
    action: 'activate',
    entity_type: 'biz_tenant',
    entity_id: sponsorBizId,
    old_val: { status: tenant.status },
    new_val: { status: 'active', instance_id: instanceId },
  });

  return { sponsor_biz_id: sponsorBizId, instance_id: instanceId };
}

async function suspendTenant(sponsorBizId, { reason, initiated_by, suspension_type = 'manual_suspension', planned_end_at = null } = {}) {
  const pool = getPool('antojados');
  const tenant = await getTenant(sponsorBizId);
  if (!tenant) {
    const err = new Error('Tenant no encontrado');
    err.status = 404;
    throw err;
  }

  const suspId = randomUUID();
  await pool.request()
    .input('id', sql.NVarChar(64), suspId)
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('stype', sql.NVarChar(40), suspension_type)
    .input('reason', sql.NVarChar(1000), reason)
    .input('initBy', sql.NVarChar(64), initiated_by)
    .input('planEnd', sql.DateTime2(7), planned_end_at ? new Date(planned_end_at) : null)
    .query(withSponsorBizColumn(`
      INSERT INTO antojados_core.biz_tenant_suspensions
        (id, __SPONSOR_BIZ_COL__, suspension_type, reason, initiated_by, started_at, planned_end_at, status)
      VALUES
        (@id, @sponsorBizId, @stype, @reason, @initBy, SYSUTCDATETIME(), @planEnd, 'active')
    `));

  await pool.request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .query(`
      UPDATE antojados_core.biz_tenants
      SET status = 'suspended', updated_at = SYSUTCDATETIME()
      WHERE id = @sponsorBizId
    `);

  if (tenant.instance_id) {
    await pool.request()
      .input('iid', sql.NVarChar(64), tenant.instance_id)
      .query(`
        UPDATE antojados_core.sys_instancia
        SET status = 'suspended', updated_at = SYSUTCDATETIME()
        WHERE instance_id = @iid
      `);
  }

  await _insertAudit(pool, {
    operator_id: initiated_by,
    action: 'suspend',
    entity_type: 'biz_tenant',
    entity_id: sponsorBizId,
    old_val: { status: tenant.status },
    new_val: { status: 'suspended', suspension_id: suspId, reason },
  });

  return { sponsor_biz_id: sponsorBizId, suspension_id: suspId };
}

async function reactivateTenant(sponsorBizId, operatorId) {
  const pool = getPool('antojados');
  const tenant = await getTenant(sponsorBizId);
  if (!tenant) {
    const err = new Error('Tenant no encontrado');
    err.status = 404;
    throw err;
  }

  await pool.request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('endBy', sql.NVarChar(64), operatorId)
    .query(withSponsorBizColumn(`
      UPDATE antojados_core.biz_tenant_suspensions
      SET status = 'lifted',
          ended_at = SYSUTCDATETIME(),
          ended_by = @endBy,
          updated_at = SYSUTCDATETIME()
      WHERE __SPONSOR_BIZ_COL__ = @sponsorBizId AND status = 'active'
    `));

  await pool.request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .query(`
      UPDATE antojados_core.biz_tenants
      SET status = 'active', updated_at = SYSUTCDATETIME()
      WHERE id = @sponsorBizId
    `);

  if (tenant.instance_id) {
    await pool.request()
      .input('iid', sql.NVarChar(64), tenant.instance_id)
      .query(`
        UPDATE antojados_core.sys_instancia
        SET status = 'active', updated_at = SYSUTCDATETIME()
        WHERE instance_id = @iid
      `);
  }

  await _insertAudit(pool, {
    operator_id: operatorId,
    action: 'reactivate',
    entity_type: 'biz_tenant',
    entity_id: sponsorBizId,
    old_val: { status: 'suspended' },
    new_val: { status: 'active' },
  });

  return { sponsor_biz_id: sponsorBizId, status: 'active' };
}

async function listTenantExpediente(sponsorBizId, { review_status = null, limit = 50, offset = 0 } = {}) {
  const result = await getPool('antojados').request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('instanceType', sql.NVarChar(20), INSTANCE_TYPE.SPONSOR)
    .input('reviewStatus', sql.NVarChar(30), review_status ? String(review_status).toLowerCase() : null)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .query(withSponsorBizColumn(`
      SELECT
        d.id,
        d.instance_id,
        d.uploaded_by_tenant_user_id,
        d.doc_type,
        d.file_name,
        d.storage_url,
        d.mime_type,
        d.size_bytes,
        d.checksum_sha256,
        d.review_status,
        d.reviewed_by,
        d.reviewed_at,
        d.created_at,
        si.__SPONSOR_BIZ_COL__
      FROM antojados_core.biz_tenant_expediente_documents d
      JOIN antojados_core.sys_instancia si
        ON si.instance_id = d.instance_id
      WHERE si.__SPONSOR_BIZ_COL__ = @sponsorBizId
        AND si.instance_type = @instanceType
        AND (@reviewStatus IS NULL OR d.review_status = @reviewStatus)
      ORDER BY d.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `));

  return result.recordset;
}

async function reviewTenantExpedienteDocument(sponsorBizId, documentId, {
  review_status,
  reviewed_by,
} = {}) {
  const normalizedStatus = String(review_status || '').trim().toLowerCase();
  if (!['approved', 'rejected'].includes(normalizedStatus)) {
    const err = new Error('review_status invalido. Permitidos: approved, rejected');
    err.status = 400;
    throw err;
  }

  const pool = getPool('antojados');
  const update = await pool.request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('documentId', sql.NVarChar(64), documentId)
    .input('reviewStatus', sql.NVarChar(30), normalizedStatus)
    .input('reviewedBy', sql.NVarChar(64), reviewed_by)
    .input('instanceType', sql.NVarChar(20), INSTANCE_TYPE.SPONSOR)
    .query(withSponsorBizColumn(`
      UPDATE d
      SET d.review_status = @reviewStatus,
          d.reviewed_by = @reviewedBy,
          d.reviewed_at = SYSUTCDATETIME()
      FROM antojados_core.biz_tenant_expediente_documents d
      JOIN antojados_core.sys_instancia si
        ON si.instance_id = d.instance_id
      WHERE d.id = @documentId
        AND si.__SPONSOR_BIZ_COL__ = @sponsorBizId
        AND si.instance_type = @instanceType
    `));

  if (!update.rowsAffected || !update.rowsAffected[0]) {
    const err = new Error('Documento de expediente no encontrado para el tenant');
    err.status = 404;
    throw err;
  }

  const result = await pool.request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('documentId', sql.NVarChar(64), documentId)
    .input('instanceType', sql.NVarChar(20), INSTANCE_TYPE.SPONSOR)
    .query(withSponsorBizColumn(`
      SELECT
        d.id,
        d.instance_id,
        d.doc_type,
        d.file_name,
        d.review_status,
        d.reviewed_by,
        d.reviewed_at,
        si.__SPONSOR_BIZ_COL__
      FROM antojados_core.biz_tenant_expediente_documents d
      JOIN antojados_core.sys_instancia si
        ON si.instance_id = d.instance_id
      WHERE d.id = @documentId
        AND si.__SPONSOR_BIZ_COL__ = @sponsorBizId
        AND si.instance_type = @instanceType
    `));

  await _insertAudit(pool, {
    operator_id: reviewed_by,
    action: 'review_expediente_document',
    entity_type: 'biz_tenant_expediente_documents',
    entity_id: documentId,
    new_val: { review_status: normalizedStatus },
  });

  return result.recordset[0] || null;
}

module.exports = {
  listTenants,
  getTenant,
  activateTenant,
  suspendTenant,
  reactivateTenant,
  listTenantExpediente,
  reviewTenantExpedienteDocument,
};