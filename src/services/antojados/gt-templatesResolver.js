'use strict';

const { getPool, sql } = require('./_shared');

async function listTemplates({ scopeType } = {}) {
  const result = await getPool('antojados').request()
    .input('scopeType', sql.NVarChar(20), scopeType ?? null)
    .query(`
      SELECT
        t.template_code,
        t.scope_type,
        COUNT(*) AS dimension_node_count,
        SUM(CASE WHEN t.is_active = 1 THEN 1 ELSE 0 END) AS is_active_count,
        MAX(t.updated_at) AS updated_at,
        (
          SELECT COUNT(*)
          FROM antojados_core.sys_sub_dimension_location_template st
          WHERE st.template_code = t.template_code
            AND st.scope_type = t.scope_type
        ) AS sub_dimension_count
      FROM antojados_core.sys_dimension_location_template t
      WHERE (@scopeType IS NULL OR t.scope_type = @scopeType)
      GROUP BY t.template_code, t.scope_type
      ORDER BY t.template_code ASC, t.scope_type ASC
    `);
  return result.recordset;
}

async function getTemplate(templateCode, { scopeType } = {}) {
  const pool = getPool('antojados');

  const summaryResult = await pool.request()
    .input('templateCode', sql.NVarChar(100), templateCode)
    .input('scopeType', sql.NVarChar(20), scopeType ?? null)
    .query(`
      SELECT TOP (1)
        t.template_code,
        t.scope_type,
        COUNT(*) OVER (PARTITION BY t.template_code, t.scope_type) AS dimension_node_count,
        MAX(t.updated_at) OVER (PARTITION BY t.template_code, t.scope_type) AS updated_at
      FROM antojados_core.sys_dimension_location_template t
      WHERE t.template_code = @templateCode
        AND (@scopeType IS NULL OR t.scope_type = @scopeType)
    `);

  if (summaryResult.recordset.length === 0) return null;
  const { template_code, scope_type } = summaryResult.recordset[0];

  const dimensionResult = await pool.request()
    .input('templateCode', sql.NVarChar(100), template_code)
    .input('scopeType', sql.NVarChar(20), scope_type)
    .query(`
      SELECT
        t.template_location_id,
        t.template_code,
        t.scope_type,
        t.dimension_id,
        t.component_code,
        t.code AS dimension_code,
        t.label AS dimension_name,
        t.node_kind AS dimension_type,
        NULL AS applies_to,
        t.visible,
        t.enabled,
        t.sort_order,
        t.meta_json,
        t.is_active,
        t.updated_at
      FROM antojados_core.sys_dimension_location_template t
      WHERE t.template_code = @templateCode
        AND t.scope_type = @scopeType
      ORDER BY t.sort_order ASC, t.code ASC
    `);

  const subDimensionResult = await pool.request()
    .input('templateCode', sql.NVarChar(100), template_code)
    .input('scopeType', sql.NVarChar(20), scope_type)
    .query(`
      SELECT
        st.template_sub_location_id,
        st.template_code,
        st.scope_type,
        st.sub_dimension_id,
        NULL AS sub_code,
        NULL AS sub_name,
        NULL AS sub_type,
        st.parent_dimension_id,
        st.enabled,
        st.sort_order,
        st.meta_json,
        st.is_active,
        st.updated_at
      FROM antojados_core.sys_sub_dimension_location_template st
      WHERE st.template_code = @templateCode
        AND st.scope_type = @scopeType
      ORDER BY st.sort_order ASC
    `);

  return {
    template_code,
    scope_type,
    summary: summaryResult.recordset[0],
    dimension_locations: dimensionResult.recordset,
    sub_dimension_locations: subDimensionResult.recordset,
  };
}

async function rebuildTemplate(templateCode, { scopeType }) {
  const pool = getPool('antojados');
  // Purge existing template rows first to avoid legacy collisions before rebuilding.
  await pool.request()
    .input('template_code', sql.NVarChar(100), templateCode)
    .input('scope_type', sql.NVarChar(20), scopeType)
    .query(`
      DELETE FROM antojados_core.sys_sub_dimension_location_template
      WHERE template_code = @template_code
        AND scope_type = @scope_type;

      DELETE FROM antojados_core.sys_dimension_location_template
      WHERE template_code = @template_code
        AND scope_type = @scope_type;
    `);

  const dimResult = await pool.request()
    .input('template_code', sql.NVarChar(100), templateCode)
    .input('scope_type', sql.NVarChar(20), scopeType)
    .execute('antojados_core.sp_sys_dimension_location_template_rebuild');

  const subResult = await pool.request()
    .input('template_code', sql.NVarChar(100), templateCode)
    .input('scope_type', sql.NVarChar(20), scopeType)
    .execute('antojados_core.sp_sys_sub_dimension_location_template_rebuild');

  return {
    dimensions: dimResult.recordset[0],
    sub_dimensions: subResult.recordset[0],
  };
}

async function updateTemplateLocation(templateLocationId, { visible, enabled, sortOrder }) {
  const result = await getPool('antojados').request()
    .input('templateLocationId', sql.NVarChar(64), templateLocationId)
    .input('visible', sql.Bit, visible ?? null)
    .input('enabled', sql.Bit, enabled ?? null)
    .input('sortOrder', sql.Int, sortOrder ?? null)
    .query(`
      UPDATE antojados_core.sys_dimension_location_template
      SET
        visible = CASE WHEN @visible IS NOT NULL THEN @visible ELSE visible END,
        enabled = CASE WHEN @enabled IS NOT NULL THEN @enabled ELSE enabled END,
        sort_order = CASE WHEN @sortOrder IS NOT NULL THEN @sortOrder ELSE sort_order END,
        updated_at = SYSUTCDATETIME()
      WHERE template_location_id = @templateLocationId;
      SELECT @@ROWCOUNT AS affected;
    `);
  return result.recordset[0]?.affected ? { template_location_id: templateLocationId, updated: true } : null;
}

async function updateTemplateSubLocation(templateSubLocationId, { enabled, sortOrder }) {
  const result = await getPool('antojados').request()
    .input('templateSubLocationId', sql.NVarChar(64), templateSubLocationId)
    .input('enabled', sql.Bit, enabled ?? null)
    .input('sortOrder', sql.Int, sortOrder ?? null)
    .query(`
      UPDATE antojados_core.sys_sub_dimension_location_template
      SET
        enabled = CASE WHEN @enabled IS NOT NULL THEN @enabled ELSE enabled END,
        sort_order = CASE WHEN @sortOrder IS NOT NULL THEN @sortOrder ELSE sort_order END,
        updated_at = SYSUTCDATETIME()
      WHERE template_sub_location_id = @templateSubLocationId;
      SELECT @@ROWCOUNT AS affected;
    `);
  return result.recordset[0]?.affected ? { template_sub_location_id: templateSubLocationId, updated: true } : null;
}

module.exports = {
  listTemplates,
  getTemplate,
  rebuildTemplate,
  updateTemplateLocation,
  updateTemplateSubLocation,
};