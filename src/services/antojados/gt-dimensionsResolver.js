'use strict';

const { getPool, sql } = require('./_shared');
const sqlClient = require('mssql');

function toBit(value) {
  if (value === undefined || value === null || value === '') return null;
  return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}

async function listDimensions({ reviewStatus, appliesTo, isActive } = {}) {
  const req = getPool('antojados').request()
    .input('reviewStatus', sql.NVarChar(60), reviewStatus || null)
    .input('appliesTo', sql.NVarChar(40), appliesTo || null)
    .input('isActive', sql.Bit, toBit(isActive));
  const result = await req.query(`
    SELECT
      dimension_id,
      dimension_code,
      parent_code,
      dimension_type,
      dimension_name,
      applies_to,
      visible_default,
      enabled_default,
      review_status,
      reviewed_by,
      reviewed_at,
      meta_json,
      is_active,
      created_at,
      updated_at
    FROM antojados_core.sys_dimension
    WHERE (@reviewStatus IS NULL OR review_status = @reviewStatus)
      AND (@appliesTo IS NULL OR applies_to IN ('all', @appliesTo))
      AND (@isActive IS NULL OR is_active = @isActive)
    ORDER BY dimension_type ASC, dimension_code ASC
  `);
  return result.recordset;
}

async function listSubDimensions({ parentDimensionId, parentCode, reviewStatus, appliesTo, isActive } = {}) {
  const req = getPool('antojados').request()
    .input('parentDimensionId', sql.NVarChar(128), parentDimensionId || null)
    .input('parentCode', sql.NVarChar(400), parentCode || null)
    .input('reviewStatus', sql.NVarChar(60), reviewStatus || null)
    .input('appliesTo', sql.NVarChar(40), appliesTo || null)
    .input('isActive', sql.Bit, toBit(isActive));
  const result = await req.query(`
    SELECT
      sd.sub_dimension_id,
      sd.parent_dimension_id,
      d.dimension_code AS parent_code,
      sd.sub_code,
      sd.sub_name,
      sd.sub_type,
      sd.applies_to,
      sd.enabled_default,
      sd.review_status,
      sd.reviewed_by,
      sd.reviewed_at,
      sd.meta_json,
      sd.is_active,
      sd.created_at,
      sd.updated_at
    FROM antojados_core.sys_sub_dimension sd
    INNER JOIN antojados_core.sys_dimension d ON d.dimension_id = sd.parent_dimension_id
    WHERE (@parentDimensionId IS NULL OR sd.parent_dimension_id = @parentDimensionId)
      AND (@parentCode IS NULL OR d.dimension_code = @parentCode)
      AND (@reviewStatus IS NULL OR sd.review_status = @reviewStatus)
      AND (@appliesTo IS NULL OR sd.applies_to IN ('all', @appliesTo))
      AND (@isActive IS NULL OR sd.is_active = @isActive)
    ORDER BY d.dimension_code ASC, sd.sub_code ASC
  `);
  return result.recordset;
}

async function batchApproveDimensions(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return { updated: 0 };
  const pool = getPool('antojados');
  let updated = 0;
  for (const code of codes) {
    const res = await pool.request()
      .input('code', sql.NVarChar(100), code)
      .query(`
        UPDATE antojados_core.sys_dimension
        SET review_status = 'APPROVED',
            reviewed_by = 'GT_BATCH',
            reviewed_at = SYSUTCDATETIME(),
            updated_at = SYSUTCDATETIME()
        WHERE dimension_code = @code AND review_status = 'PENDING_REVIEW'
      `);
    updated = Number(updated) - (-Number(res.rowsAffected[0] || 0));
  }
  return { updated };
}

async function batchApproveSubDimensions(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return { updated: 0 };
  const pool = getPool('antojados');
  let updated = 0;
  for (const code of codes) {
    const res = await pool.request()
      .input('code', sql.NVarChar(100), code)
      .query(`
        UPDATE antojados_core.sys_sub_dimension
        SET review_status = 'APPROVED',
            reviewed_by = 'GT_BATCH',
            reviewed_at = SYSUTCDATETIME(),
            updated_at = SYSUTCDATETIME()
        WHERE sub_code = @code AND review_status = 'PENDING_REVIEW'
      `);
    updated = Number(updated) - (-Number(res.rowsAffected[0] || 0));
  }
  return { updated };
}

async function updateDimensionStatus(code, status) {
  const validStatuses = ['APPROVED', 'PENDING_REVIEW', 'REJECTED', 'ACTIVE', 'INACTIVE', 'DEACTIVATED'];
  if (!validStatuses.includes(status)) {
    const err = new Error(`status inválido — válidos: ${validStatuses.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const normalized = status === 'DEACTIVATED' ? 'INACTIVE' : status;
  const isActive = normalized === 'ACTIVE' ? 1 : normalized === 'INACTIVE' ? 0 : null;

  await getPool('antojados').request()
    .input('code', sql.NVarChar(100), code)
    .input('reviewStatus', sql.NVarChar(60), normalized === 'ACTIVE' || normalized === 'INACTIVE' ? null : normalized)
    .input('isActive', sql.Bit, isActive)
    .query(`
      UPDATE antojados_core.sys_dimension
      SET
        review_status = COALESCE(@reviewStatus, review_status),
        is_active = COALESCE(@isActive, is_active),
        updated_at = SYSUTCDATETIME()
      WHERE dimension_code = @code
    `);
  return { dimension_code: code, status: normalized };
}

async function updateSubDimensionStatus(code, status) {
  const validStatuses = ['APPROVED', 'PENDING_REVIEW', 'REJECTED', 'ACTIVE', 'INACTIVE', 'DEACTIVATED'];
  if (!validStatuses.includes(status)) {
    const err = new Error(`status inválido — válidos: ${validStatuses.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const normalized = status === 'DEACTIVATED' ? 'INACTIVE' : status;
  const isActive = normalized === 'ACTIVE' ? 1 : normalized === 'INACTIVE' ? 0 : null;

  await getPool('antojados').request()
    .input('code', sql.NVarChar(300), code)
    .input('reviewStatus', sql.NVarChar(60), normalized === 'ACTIVE' || normalized === 'INACTIVE' ? null : normalized)
    .input('isActive', sql.Bit, isActive)
    .query(`
      UPDATE antojados_core.sys_sub_dimension
      SET
        review_status = COALESCE(@reviewStatus, review_status),
        is_active = COALESCE(@isActive, is_active),
        updated_at = SYSUTCDATETIME()
      WHERE sub_code = @code
    `);
  return { sub_code: code, status: normalized };
}

async function deleteDimension(code) {
  const pool = getPool('antojados');
  const tx = new sqlClient.Transaction(pool);
  await tx.begin();
  try {
    const dim = await new sqlClient.Request(tx)
      .input('code', sql.NVarChar(400), code)
      .query('SELECT dimension_id FROM antojados_core.sys_dimension WHERE dimension_code = @code');
    const dimensionId = dim.recordset[0]?.dimension_id;
    if (dimensionId) {
      await new sqlClient.Request(tx)
        .input('dimensionId', sql.NVarChar(128), dimensionId)
        .query('DELETE FROM antojados_core.sys_sub_dimension WHERE parent_dimension_id = @dimensionId');
      await new sqlClient.Request(tx)
        .input('code', sql.NVarChar(400), code)
        .query('DELETE FROM antojados_core.sys_dimension WHERE dimension_code = @code');
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  return { deleted: true, dimension_code: code };
}

async function deleteSubDimension(code) {
  await getPool('antojados').request()
    .input('code', sql.NVarChar(300), code)
    .query('DELETE FROM antojados_core.sys_sub_dimension WHERE sub_code = @code');
  return { deleted: true, sub_code: code };
}

async function purgeCatalogTables() {
  // Purga destructiva deshabilitada: dimensiones se persisten por upsert
  // y las cascadas/plantillas se reconstruyen por sus flujos dedicados.
  return {
    purged_sub_dimensions: 0,
    purged_dimensions: 0,
  };
}

async function purgeCatalog() {
  return purgeCatalogTables();
}

async function runScanner(payload, options = {}) {
  const pool = getPool('antojados');
  const dims = Array.isArray(payload?.dimensions) ? payload.dimensions : [];
  const subDims = Array.isArray(payload?.sub_dimensions) ? payload.sub_dimensions : [];
  const purgeExisting = options?.purgeExisting === true;
  let insertedDims = 0;
  let insertedSubDims = 0;

  let purgeSummary = { purged_dimensions: 0, purged_sub_dimensions: 0 };
  if (purgeExisting) {
    purgeSummary = await purgeCatalogTables();
  }

  for (const d of dims) {
    const dimensionCode = d.dimension_code || d.code;
    if (!dimensionCode) continue;
    const existingDimension = await pool.request()
      .input('code', sql.NVarChar(400), dimensionCode)
      .query('SELECT dimension_id FROM antojados_core.sys_dimension WHERE dimension_code = @code');
    const dimensionId = existingDimension.recordset[0]?.dimension_id || d.dimension_id || require('./_shared').randomUUID();

    const dimensionName = d.dimension_name || d.label || dimensionCode;
    const reviewStatus = d.review_status || d.status || 'PENDING_REVIEW';
    const isActive = d.is_active === undefined || d.is_active === null ? 1 : toBit(d.is_active);

    await pool.request()
      .input('dimension_id', sql.NVarChar(128), dimensionId)
      .input('dimension_code', sql.NVarChar(400), dimensionCode)
      .input('parent_code', sql.NVarChar(400), d.parent_code || null)
      .input('dimension_type', sql.NVarChar(60), d.dimension_type || d.type || 'COMPONENT')
      .input('dimension_name', sql.NVarChar(600), dimensionName)
      .input('applies_to', sql.NVarChar(40), d.applies_to || 'all')
      .input('visible_default', sql.Bit, toBit(d.visible_default ?? d.visibleDefault ?? 1) ?? 1)
      .input('enabled_default', sql.Bit, toBit(d.enabled_default ?? d.enabledDefault ?? 0) ?? 0)
      .input('review_status', sql.NVarChar(60), reviewStatus)
      .input('meta_json', sql.NVarChar(sql.MAX), d.meta_json ?? d.metaJson ?? null)
      .input('is_active', sql.Bit, isActive)
      .execute('antojados_core.sp_sys_dimension_upsert');
    if (!existingDimension.recordset[0]?.dimension_id) {
      insertedDims = insertedDims - (-1);
    }
  }

  for (const s of subDims) {
    const subCode = s.sub_code || s.code;
    if (!subCode) continue;
    const parentDimensionId = s.parent_dimension_id || null;
    const parentCode = s.parent_code || s.parent_dim_code || null;
    let resolvedParentId = parentDimensionId;

    if (!resolvedParentId && parentCode) {
      const normalizedParentCode = String(parentCode || '').trim();
      const segments = normalizedParentCode
        .split('.')
        .map((segment) => String(segment || '').trim())
        .filter(Boolean);

      for (let idx = segments.length; idx > 0; idx -= 1) {
        const candidateCode = segments.slice(0, idx).join('.');
        const parent = await pool.request()
          .input('code', sql.NVarChar(400), candidateCode)
          .query('SELECT dimension_id FROM antojados_core.sys_dimension WHERE dimension_code = @code');
        resolvedParentId = parent.recordset[0]?.dimension_id || null;
        if (resolvedParentId) break;
      }
    }

    if (!resolvedParentId) continue;

    const existingSubDimension = await pool.request()
      .input('code', sql.NVarChar(300), subCode)
      .query('SELECT sub_dimension_id FROM antojados_core.sys_sub_dimension WHERE sub_code = @code');
    const subDimensionId = existingSubDimension.recordset[0]?.sub_dimension_id || s.sub_dimension_id || require('./_shared').randomUUID();

    const subName = s.sub_name || s.label || subCode;
    const reviewStatus = s.review_status || s.status || 'PENDING_REVIEW';
    const isActive = s.is_active === undefined || s.is_active === null ? 1 : toBit(s.is_active);

    await pool.request()
      .input('sub_dimension_id', sql.NVarChar(128), subDimensionId)
      .input('parent_dimension_id', sql.NVarChar(128), resolvedParentId)
      .input('sub_code', sql.NVarChar(600), subCode)
      .input('sub_name', sql.NVarChar(600), subName)
      .input('sub_type', sql.NVarChar(60), s.sub_type || s.type || 'SUBTAB')
      .input('applies_to', sql.NVarChar(40), s.applies_to || 'all')
      .input('enabled_default', sql.Bit, toBit(s.enabled_default ?? s.enabledDefault ?? 0) ?? 0)
      .input('review_status', sql.NVarChar(60), reviewStatus)
      .input('meta_json', sql.NVarChar(sql.MAX), s.meta_json ?? s.metaJson ?? null)
      .input('is_active', sql.Bit, isActive)
      .execute('antojados_core.sp_sys_sub_dimension_upsert');
    if (!existingSubDimension.recordset[0]?.sub_dimension_id) {
      insertedSubDims = insertedSubDims - (-1);
    }
  }

  return {
    inserted_dims: insertedDims,
    inserted_sub_dims: insertedSubDims,
    ...purgeSummary,
  };
}

module.exports = {
  listDimensions,
  listSubDimensions,
  batchApproveDimensions,
  batchApproveSubDimensions,
  updateDimensionStatus,
  updateSubDimensionStatus,
  deleteDimension,
  deleteSubDimension,
  purgeCatalog,
  purgeCatalogTables,
  runScanner,
};