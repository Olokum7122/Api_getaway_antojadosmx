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

  const dimensionResult = await pool.request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .query(`
      SELECT
        dl.location_id,
        dl.instance_id,
        dl.root_location_id,
        dl.parent_location_id,
        dl.dimension_id,
        dl.node_kind,
        dl.node_level,
        dl.code,
        dl.label,
        dl.module_code,
        dl.area_code,
        dl.component_code,
        dl.visible,
        dl.enabled,
        dl.meta_json,
        dl.sort_order,
        dl.is_leaf,
        dl.materialized_at,
        dl.updated_at
      FROM antojados_core.sys_dimension_location dl
      WHERE dl.instance_id = @instanceId
      ORDER BY dl.node_level ASC, dl.sort_order ASC, dl.code ASC
    `);

  const subDimensionResult = await pool.request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .query(`
      SELECT
        sdl.id,
        sdl.instance_id,
        sdl.root_location_id,
        sdl.sub_dimension_id,
        sd.sub_code,
        sd.sub_name,
        sd.sub_type,
        sdl.visible,
        sdl.enabled,
        sdl.sort_order,
        sdl.materialized_at,
        sdl.updated_at
      FROM antojados_core.sys_sub_dimension_location sdl
      INNER JOIN antojados_core.sys_sub_dimension sd
        ON sd.sub_dimension_id = sdl.sub_dimension_id
      WHERE sdl.instance_id = @instanceId
      ORDER BY sdl.sort_order ASC, sd.sub_code ASC
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

  await pool.request()
    .input('instance_id', sql.NVarChar(64), instanceId)
    .input('instance_type', sql.NVarChar(20), 'sponsor')
    .execute('antojados_core.sp_sys_dimension_location_materialize');

  await pool.request()
    .input('instance_id', sql.NVarChar(64), instanceId)
    .input('instance_type', sql.NVarChar(20), 'sponsor')
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