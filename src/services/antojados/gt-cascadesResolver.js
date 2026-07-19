'use strict';

const { getPool, sql } = require('./_shared');
const { INSTANCE_TYPE } = require('../../constants/instancias');
const SPONSOR_BIZ_KEY = 'tenant' + '_id';

function withSponsorBizColumn(sqlText) {
  return sqlText.replaceAll('__SPONSOR_BIZ_COL__', SPONSOR_BIZ_KEY);
}

async function listInstances({ instanceType, sponsorBizId, cuentaId, status } = {}) {
  const result = await getPool('antojados').request()
    .input('instanceType', sql.NVarChar(20), instanceType ?? null)
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId ?? null)
    .input('cuentaId', sql.NVarChar(64), cuentaId ?? null)
    .input('status', sql.NVarChar(30), status ?? null)
    .query(withSponsorBizColumn(`
      SELECT
        i.instance_id,
        i.cuenta_id,
        i.instance_type,
        i.__SPONSOR_BIZ_COL__,
        i.root_location_id,
        i.status,
        i.snapshot_hash,
        i.cascade_synced_at,
        i.updated_at
      FROM antojados_core.sys_instancia i
      WHERE (@instanceType IS NULL OR i.instance_type = @instanceType)
        AND (@sponsorBizId IS NULL OR i.__SPONSOR_BIZ_COL__ = @sponsorBizId)
        AND (@cuentaId IS NULL OR i.cuenta_id = @cuentaId)
        AND (@status IS NULL OR i.status = @status)
      ORDER BY i.updated_at DESC, i.instance_id ASC
    `));
  return result.recordset;
}

async function getInstance(instanceId) {
  const result = await getPool('antojados').request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .query(withSponsorBizColumn(`
      SELECT
        i.instance_id,
        i.cuenta_id,
        i.instance_type,
        i.__SPONSOR_BIZ_COL__,
        i.root_location_id,
        i.status,
        i.snapshot_hash,
        i.cascade_synced_at,
        i.created_at,
        i.updated_at
      FROM antojados_core.sys_instancia i
      WHERE i.instance_id = @instanceId
    `));
  return result.recordset[0] || null;
}

async function getInstanceCascade(instanceId) {
  const pool = getPool('antojados');
  const instance = await getInstance(instanceId);
  if (!instance) return null;
  const scopeType = instance.instance_type || INSTANCE_TYPE.USER;
  const templateCode = scopeType === INSTANCE_TYPE.SPONSOR ? 'DEFAULT_SPONSOR' : 'DEFAULT_USER';

  const dimensionResult = await pool.request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .input('templateCode', sql.NVarChar(100), templateCode)
    .input('scopeType', sql.NVarChar(20), scopeType)
    .query(`
      SELECT
        COALESCE(c.checked_location_id, t.template_location_id) AS location_id,
        @instanceId AS instance_id,
        t.root_dimension_id AS root_location_id,
        t.parent_dimension_id AS parent_location_id,
        t.dimension_id,
        t.node_kind,
        t.node_level,
        t.code,
        t.label,
        t.module_code,
        t.area_code,
        t.component_code,
        CAST(COALESCE(c.visible_override, t.visible, c.is_checked, 0) AS bit) AS visible,
        CAST(COALESCE(c.enabled_override, t.enabled, c.is_checked, 0) AS bit) AS enabled,
        t.meta_json,
        t.sort_order,
        t.is_leaf,
        c.created_at AS materialized_at,
        COALESCE(c.updated_at, t.updated_at) AS updated_at
      FROM antojados_core.sys_dimension_location_template t
      LEFT JOIN antojados_core.sys_dimension_location_checked c
        ON c.template_location_id = t.template_location_id
       AND c.instance_id = @instanceId
      WHERE t.template_code = @templateCode
        AND t.scope_type = @scopeType
        AND t.is_active = 1
      ORDER BY t.node_level ASC, t.sort_order ASC, t.code ASC
    `);

  const subDimensionResult = await pool.request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .input('templateCode', sql.NVarChar(100), templateCode)
    .input('scopeType', sql.NVarChar(20), scopeType)
    .query(`
      SELECT
        COALESCE(c.checked_sub_location_id, t.template_sub_location_id) AS id,
        @instanceId AS instance_id,
        t.root_dimension_id AS root_location_id,
        t.sub_dimension_id,
        sd.sub_code,
        sd.sub_name,
        sd.sub_type,
        CAST(COALESCE(c.visible_override, t.visible, c.is_checked, 0) AS bit) AS visible,
        CAST(COALESCE(c.enabled_override, t.enabled, c.is_checked, 0) AS bit) AS enabled,
        t.sort_order,
        c.created_at AS materialized_at,
        COALESCE(c.updated_at, t.updated_at) AS updated_at
      FROM antojados_core.sys_sub_dimension_location_template t
      LEFT JOIN antojados_core.sys_sub_dimension_location_checked c
        ON c.template_sub_location_id = t.template_sub_location_id
       AND c.instance_id = @instanceId
      LEFT JOIN antojados_core.sys_sub_dimension sd
        ON sd.sub_dimension_id = t.sub_dimension_id
      WHERE t.template_code = @templateCode
        AND t.scope_type = @scopeType
        AND t.is_active = 1
      ORDER BY t.sort_order ASC, sd.sub_code ASC
    `);

  return {
    instance,
    dimension_locations: dimensionResult.recordset,
    sub_dimension_locations: subDimensionResult.recordset,
  };
}

async function getSponsorCascade(sponsorBizId) {
  const result = await getPool('antojados').request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('instanceType', sql.NVarChar(20), INSTANCE_TYPE.SPONSOR)
    .query(withSponsorBizColumn(`
      SELECT TOP (1) i.instance_id
      FROM antojados_core.sys_instancia i
      WHERE i.__SPONSOR_BIZ_COL__ = @sponsorBizId
        AND i.instance_type = @instanceType
    `));
  if (result.recordset.length === 0) return null;
  return result.recordset[0].instance_id;
}

async function getUserCascade(userId) {
  const result = await getPool('antojados').request()
    .input('userId', sql.NVarChar(64), userId)
    .input('instanceType', sql.NVarChar(20), INSTANCE_TYPE.USER)
    .query(`
      SELECT TOP (1) i.instance_id
      FROM antojados_core.sys_instancia i
      WHERE i.cuenta_id = @userId
        AND i.instance_type = @instanceType
    `);
  if (result.recordset.length === 0) return null;
  return result.recordset[0].instance_id;
}

async function listReusableCascades({ scopeType } = {}) {
  const result = await getPool('antojados').request()
    .input('scopeType', sql.NVarChar(20), scopeType ?? null)
    .query(`
      SELECT
        dlr.reusable_code,
        dlr.scope_type,
        MAX(CASE WHEN dlr.node_kind = 'ROOT' THEN dlr.reusable_location_id END) AS root_reusable_location_id,
        COUNT(*) AS dimension_node_count,
        SUM(CASE WHEN dlr.node_kind = 'COMPONENT' THEN 1 ELSE 0 END) AS component_node_count,
        MAX(dlr.updated_at) AS updated_at,
        (
          SELECT COUNT(*)
          FROM antojados_core.sys_sub_dimension_location_reusable sdlr
          WHERE sdlr.reusable_code = dlr.reusable_code
            AND sdlr.scope_type = dlr.scope_type
        ) AS sub_dimension_node_count
      FROM antojados_core.sys_dimension_location_reusable dlr
      WHERE (@scopeType IS NULL OR dlr.scope_type = @scopeType)
      GROUP BY dlr.reusable_code, dlr.scope_type
      ORDER BY dlr.reusable_code ASC, dlr.scope_type ASC
    `);
  return result.recordset;
}

async function getReusableCascade(reusableCode, { scopeType } = {}) {
  const pool = getPool('antojados');
  const summaryResult = await pool.request()
    .input('reusableCode', sql.NVarChar(64), reusableCode)
    .input('scopeType', sql.NVarChar(20), scopeType ?? null)
    .query(`
      SELECT TOP (1)
        dlr.reusable_code,
        dlr.scope_type,
        MAX(CASE WHEN dlr.node_kind = 'ROOT' THEN dlr.reusable_location_id END) AS root_reusable_location_id,
        MAX(dlr.updated_at) AS updated_at
      FROM antojados_core.sys_dimension_location_reusable dlr
      WHERE dlr.reusable_code = @reusableCode
        AND (@scopeType IS NULL OR dlr.scope_type = @scopeType)
      GROUP BY dlr.reusable_code, dlr.scope_type
      ORDER BY dlr.scope_type ASC
    `);

  if (summaryResult.recordset.length === 0) return null;
  const summary = summaryResult.recordset[0];

  const dimensionResult = await pool.request()
    .input('reusableCode', sql.NVarChar(64), summary.reusable_code)
    .input('scopeType', sql.NVarChar(20), summary.scope_type)
    .query(`
      SELECT
        dlr.reusable_location_id AS location_id,
        dlr.reusable_code,
        dlr.scope_type,
        dlr.root_reusable_location_id AS root_location_id,
        dlr.parent_reusable_location_id AS parent_location_id,
        dlr.dimension_id,
        dlr.node_kind,
        dlr.node_level,
        dlr.code,
        dlr.label,
        dlr.module_code,
        dlr.area_code,
        dlr.component_code,
        dlr.visible,
        dlr.enabled,
        dlr.meta_json,
        dlr.sort_order,
        dlr.is_leaf,
        dlr.materialized_at,
        dlr.updated_at
      FROM antojados_core.sys_dimension_location_reusable dlr
      WHERE dlr.reusable_code = @reusableCode
        AND dlr.scope_type = @scopeType
      ORDER BY dlr.node_level ASC, dlr.sort_order ASC, dlr.code ASC
    `);

  const subDimensionResult = await pool.request()
    .input('reusableCode', sql.NVarChar(64), summary.reusable_code)
    .input('scopeType', sql.NVarChar(20), summary.scope_type)
    .query(`
      SELECT
        sdlr.reusable_sub_location_id AS id,
        sdlr.reusable_code,
        sdlr.scope_type,
        sdlr.root_reusable_location_id AS root_location_id,
        sdlr.sub_dimension_id,
        sd.sub_code,
        sd.sub_name,
        sd.sub_type,
        sdlr.visible,
        sdlr.enabled,
        sdlr.sort_order,
        sdlr.materialized_at,
        sdlr.updated_at
      FROM antojados_core.sys_sub_dimension_location_reusable sdlr
      INNER JOIN antojados_core.sys_sub_dimension sd
        ON sd.sub_dimension_id = sdlr.sub_dimension_id
      WHERE sdlr.reusable_code = @reusableCode
        AND sdlr.scope_type = @scopeType
      ORDER BY sdlr.sort_order ASC, sd.sub_code ASC
    `);

  return {
    reusable: {
      reusable_code: summary.reusable_code,
      scope_type: summary.scope_type,
      root_reusable_location_id: summary.root_reusable_location_id,
      dimension_node_count: dimensionResult.recordset.length,
      component_node_count: dimensionResult.recordset.filter(r => r.node_kind === 'COMPONENT').length,
      sub_dimension_node_count: subDimensionResult.recordset.length,
      updated_at: summary.updated_at,
    },
    dimension_locations: dimensionResult.recordset,
    sub_dimension_locations: subDimensionResult.recordset,
  };
}

async function rebuildInstanceCascade(instanceId) {
  if (!instanceId) throw Object.assign(new Error('instanceId requerido'), { status: 400 });

  const pool = getPool('antojados');
  const instance = await getInstance(instanceId);
  if (!instance) return null;

  await pool.request()
    .input('instance_id', sql.NVarChar(64), instanceId)
    .input('instance_type', sql.NVarChar(20), instance.instance_type || INSTANCE_TYPE.USER)
    .execute('antojados_core.sp_sys_dimension_location_materialize');

  await pool.request()
    .input('instance_id', sql.NVarChar(64), instanceId)
    .input('instance_type', sql.NVarChar(20), instance.instance_type || INSTANCE_TYPE.USER)
    .execute('antojados_core.sp_sys_sub_dimension_location_materialize');

  return { ok: true, instance_id: instanceId, message: 'Cascada materializada correctamente' };
}

async function rebuildReusableCascade(reusableCode, { scopeType, rootLabel }) {
  if (!reusableCode) throw Object.assign(new Error('reusableCode requerido'), { status: 400 });
  if (!scopeType) throw Object.assign(new Error('scopeType requerido'), { status: 400 });

  const result = await getPool('antojados').request()
    .input('reusableCode', sql.NVarChar(64), reusableCode)
    .input('scopeType', sql.NVarChar(20), scopeType)
    .input('rootLabel', sql.NVarChar(300), rootLabel ?? null)
    .execute('antojados_core.sp_sys_reusable_cascade_rebuild');

  if (result.recordset.length === 0) {
    throw new Error('sp_sys_reusable_cascade_rebuild: sin respuesta');
  }

  return result.recordset[0];
}

module.exports = {
  listInstances,
  getInstance,
  getInstanceCascade,
  getSponsorCascade,
  getUserCascade,
  listReusableCascades,
  getReusableCascade,
  rebuildInstanceCascade,
  rebuildReusableCascade,
};