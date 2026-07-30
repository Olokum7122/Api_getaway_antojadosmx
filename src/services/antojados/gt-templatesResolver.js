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
  const updateResult = await pool.request()
    .input('template_code', sql.NVarChar(100), templateCode)
    .input('scope_type', sql.NVarChar(20), scopeType)
    .query(`
      ;WITH source_dimensions AS (
        SELECT
          d.dimension_id,
          d.dimension_code,
          d.parent_code,
          d.dimension_type,
          d.dimension_name,
          d.meta_json,
          JSON_VALUE(d.meta_json, '$.code_component') AS code_component,
          ROW_NUMBER() OVER (
            ORDER BY
              CASE d.dimension_type WHEN 'MODULE' THEN 0 WHEN 'AREA' THEN 1 ELSE 2 END,
              d.dimension_code
          ) AS sort_order
        FROM antojados_core.sys_dimension d
        WHERE d.is_active = 1
          AND d.review_status = 'APPROVED'
      )
      UPDATE t
      SET
        t.component_code = COALESCE(s.code_component, s.dimension_code),
        t.node_kind = s.dimension_type,
        t.node_level = CASE s.dimension_type WHEN 'MODULE' THEN 0 WHEN 'AREA' THEN 2 ELSE 3 END,
        t.code = s.dimension_code,
        t.label = s.dimension_name,
        t.module_code = CASE WHEN s.dimension_type = 'MODULE' THEN s.dimension_code ELSE NULL END,
        t.area_code = CASE WHEN s.dimension_type IN ('AREA', 'COMPONENT') THEN COALESCE(s.parent_code, s.dimension_code) ELSE NULL END,
        t.is_leaf = CASE WHEN s.dimension_type = 'COMPONENT' THEN 1 ELSE 0 END,
        t.parent_dimension_id = p.dimension_id,
        t.root_dimension_id = r.dimension_id,
        t.meta_json = s.meta_json,
        t.sort_order = s.sort_order,
        t.control_mode = COALESCE(NULLIF(t.control_mode, ''), 'DEFAULT'),
        t.is_active = 1,
        t.updated_at = SYSUTCDATETIME()
      FROM antojados_core.sys_dimension_location_template t
      INNER JOIN source_dimensions s ON s.dimension_id = t.dimension_id
      LEFT JOIN antojados_core.sys_dimension p ON p.dimension_code = s.parent_code
      LEFT JOIN antojados_core.sys_dimension r ON r.dimension_code = COALESCE(NULLIF(PARSENAME(REPLACE(s.dimension_code, '.', '.'), 4), ''), NULL)
      WHERE t.template_code = @template_code
        AND t.scope_type = @scope_type;
    `);

  const insertResult = await pool.request()
    .input('template_code', sql.NVarChar(100), templateCode)
    .input('scope_type', sql.NVarChar(20), scopeType)
    .query(`
      ;WITH source_dimensions AS (
        SELECT
          d.dimension_id,
          d.dimension_code,
          d.parent_code,
          d.dimension_type,
          d.dimension_name,
          d.meta_json,
          JSON_VALUE(d.meta_json, '$.code_component') AS code_component,
          ROW_NUMBER() OVER (
            ORDER BY
              CASE d.dimension_type WHEN 'MODULE' THEN 0 WHEN 'AREA' THEN 1 ELSE 2 END,
              d.dimension_code
          ) AS sort_order
        FROM antojados_core.sys_dimension d
        WHERE d.is_active = 1
          AND d.review_status = 'APPROVED'
      )
      INSERT INTO antojados_core.sys_dimension_location_template (
        template_location_id,
        template_code,
        scope_type,
        dimension_id,
        component_code,
        visible,
        enabled,
        sort_order,
        meta_json,
        is_active,
        node_kind,
        node_level,
        code,
        label,
        module_code,
        area_code,
        is_leaf,
        parent_dimension_id,
        root_dimension_id,
        control_mode
      )
      SELECT
        CONVERT(nvarchar(64), NEWID()),
        @template_code,
        @scope_type,
        s.dimension_id,
        COALESCE(s.code_component, s.dimension_code),
        1,
        1,
        s.sort_order,
        s.meta_json,
        1,
        s.dimension_type,
        CASE s.dimension_type WHEN 'MODULE' THEN 0 WHEN 'AREA' THEN 2 ELSE 3 END,
        s.dimension_code,
        s.dimension_name,
        CASE WHEN s.dimension_type = 'MODULE' THEN s.dimension_code ELSE NULL END,
        CASE WHEN s.dimension_type IN ('AREA', 'COMPONENT') THEN COALESCE(s.parent_code, s.dimension_code) ELSE NULL END,
        CASE WHEN s.dimension_type = 'COMPONENT' THEN 1 ELSE 0 END,
        p.dimension_id,
        NULL,
        'DEFAULT'
      FROM source_dimensions s
      LEFT JOIN antojados_core.sys_dimension p ON p.dimension_code = s.parent_code
      WHERE NOT EXISTS (
        SELECT 1
        FROM antojados_core.sys_dimension_location_template t
        WHERE t.template_code = @template_code
          AND t.scope_type = @scope_type
          AND t.dimension_id = s.dimension_id
      );
    `);

  return {
    dimensions: {
      updated: Number(updateResult.rowsAffected?.[0] || 0),
      inserted: Number(insertResult.rowsAffected?.[0] || 0),
    },
    sub_dimensions: { updated: 0, inserted: 0 },
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