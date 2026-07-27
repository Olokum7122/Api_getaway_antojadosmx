'use strict';
/**
 * instanciasResolver.js — Resolver de Instancias del Sistema
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Instancias del Sistema (sys_instancia)
 * RESPONSABLE:  Consultar información de instancias de usuario o sponsor
 *               desde sys_instancia.
 *
 * TABLA QUE TOCA:
 *   antojados_core.sys_instancia → instancias del sistema
 *
 * REFERENCIAS:
 *   - instanciasMapper.js, instancias.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql } = require('./_shared');

async function getInstanceInfo({ user_id, instance_type }) {
  const result = await getPool('antojados').request()
    .input('userId', sql.NVarChar(64), user_id)
    .input('instanceType', sql.NVarChar(20), instance_type || 'user')
    .query(`
      SELECT
        i.instance_id,
        i.status AS instance_status
      FROM antojados_core.sys_instancia i
      WHERE i.cuenta_id = @userId
        AND i.instance_type = @instanceType
    `);
  return result.recordset[0] || null;
}

async function transitarInstanciaSP({ instance_id, status }) {
  const pool = getPool('antojados');
  const result = await pool.request()
    .input('instance_id', sql.NVarChar(64), instance_id)
    .input('status', sql.NVarChar(30), status)
    .execute('sp_sys_instancia_set_status');
  return { affected: result.rowsAffected[0] || 0 };
}

module.exports = { getInstanceInfo, transitarInstanciaSP };