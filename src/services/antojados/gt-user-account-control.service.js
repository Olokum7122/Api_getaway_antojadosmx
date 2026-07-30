'use strict';

const { getPool, sql } = require('./_shared');

async function listUserAccountControl({ control_status = null, search = null, limit = 100, offset = 0 } = {}) {
  const result = await getPool('antojados').request()
    .input('control_status', sql.NVarChar(30), control_status || null)
    .input('search', sql.NVarChar(150), search || null)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .execute('antojados_core.sp_user_account_control_list');

  return result.recordset;
}

async function getUserAccountControl({ user_id = null, instance_id = null } = {}) {
  const result = await getPool('antojados').request()
    .input('user_id', sql.NVarChar(64), user_id || null)
    .input('instance_id', sql.NVarChar(64), instance_id || null)
    .execute('antojados_core.sp_user_account_control_get');

  return result.recordset[0] || null;
}

async function setUserAccountControl(user_id, payload = {}) {
  const result = await getPool('antojados').request()
    .input('user_id', sql.NVarChar(64), user_id)
    .input('control_status', sql.NVarChar(30), payload.control_status)
    .input('instance_id', sql.NVarChar(64), payload.instance_id || null)
    .input('reason_code', sql.NVarChar(60), payload.reason_code || null)
    .input('reason_detail', sql.NVarChar(1000), payload.reason_detail || null)
    .input('restricted_until', sql.DateTime2(3), payload.restricted_until ? new Date(payload.restricted_until) : null)
    .input('source_area', sql.NVarChar(60), payload.source_area || null)
    .input('evidence_json', sql.NVarChar(sql.MAX), payload.evidence_json ? JSON.stringify(payload.evidence_json) : null)
    .input('decided_by', sql.NVarChar(64), payload.decided_by || null)
    .execute('antojados_core.sp_user_account_control_set');

  return result.recordset[0] || null;
}

async function expireUserAccountControl() {
  const result = await getPool('antojados').request()
    .execute('antojados_core.sp_user_account_control_expire');

  return result.recordset[0] || { expired_count: 0 };
}

module.exports = {
  listUserAccountControl,
  getUserAccountControl,
  setUserAccountControl,
  expireUserAccountControl,
};