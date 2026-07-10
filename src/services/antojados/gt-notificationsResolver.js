'use strict';

const { getPool, sql, randomUUID } = require('./_shared');
const SPONSOR_BIZ_KEY = 'tenant' + '_id';

function withSponsorBizColumn(sqlText) {
  return sqlText.replaceAll('__SPONSOR_BIZ_COL__', SPONSOR_BIZ_KEY);
}

async function resolveSponsorBizIdByInstance(instanceId) {
  const result = await getPool('antojados').request()
    .input('instanceId', sql.NVarChar(64), instanceId)
    .query(withSponsorBizColumn(`
      SELECT TOP 1 __SPONSOR_BIZ_COL__
      FROM antojados_core.sys_instancia
      WHERE instance_id = @instanceId
        AND instance_type = 'sponsor'
    `));
  return result.recordset[0]?.[SPONSOR_BIZ_KEY] || null;
}

async function resolveInstanceIdBySponsorBizId(sponsorBizId) {
  const result = await getPool('antojados').request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .query(withSponsorBizColumn(`
      SELECT TOP 1 instance_id
      FROM antojados_core.sys_instancia
      WHERE __SPONSOR_BIZ_COL__ = @sponsorBizId
        AND instance_type = 'sponsor'
      ORDER BY updated_at DESC, created_at DESC
    `));
  return result.recordset[0]?.instance_id || null;
}

async function getNotifications(sponsorBizId, { status, limit = 50, offset = 0 } = {}) {
  const req = getPool('antojados').request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset);

  let where = 'WHERE n.__SPONSOR_BIZ_COL__ = @sponsorBizId';
  if (status) {
    req.input('status', sql.NVarChar(20), status);
    where += ' AND n.status = @status';
  }

  const result = await req.query(withSponsorBizColumn(
    'SELECT\n'
    + '  n.id,\n'
    + '  n.notification_type,\n'
    + '  n.title,\n'
    + '  n.message,\n'
    + '  n.cta_label,\n'
    + '  n.cta_deeplink,\n'
    + '  n.cta_payment_url,\n'
    + '  n.sequence_id,\n'
    + '  n.sequence_step,\n'
    + '  n.dismissable,\n'
    + '  n.status,\n'
    + '  n.created_at,\n'
    + '  n.read_at\n'
    + 'FROM antojados_core.biz_tenant_notifications n\n'
    + where + '\n'
    + 'ORDER BY n.created_at DESC\n'
    + 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'
  ));
  return result.recordset;
}

async function createNotification(sponsorBizId, {
  notification_type,
  title,
  message,
  cta_label,
  cta_deeplink,
  cta_payment_url,
  sequence_id,
  sequence_step,
  dismissable = true,
}) {
  const id = randomUUID();
  await getPool('antojados').request()
    .input('id', sql.NVarChar(64), id)
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('ntype', sql.NVarChar(40), notification_type)
    .input('title', sql.NVarChar(300), title)
    .input('message', sql.NVarChar(sql.MAX), message)
    .input('ctaLabel', sql.NVarChar(100), cta_label || null)
    .input('ctaDeep', sql.NVarChar(500), cta_deeplink || null)
    .input('ctaPay', sql.NVarChar(500), cta_payment_url || null)
    .input('seqId', sql.NVarChar(64), sequence_id || null)
    .input('seqStep', sql.Int, sequence_step ?? null)
    .input('dismiss', sql.Bit, dismissable ? 1 : 0)
    .query(withSponsorBizColumn(
      'INSERT INTO antojados_core.biz_tenant_notifications\n'
      + '  (id, __SPONSOR_BIZ_COL__, notification_type, title, message,\n'
      + '   cta_label, cta_deeplink, cta_payment_url,\n'
      + '   sequence_id, sequence_step, dismissable, status, created_at)\n'
      + 'VALUES\n'
      + "  (@id, @sponsorBizId, @ntype, @title, @message,\n"
      + "   @ctaLabel, @ctaDeep, @ctaPay,\n"
      + "   @seqId, @seqStep, @dismiss, 'sent', SYSUTCDATETIME())"
    ));
  const instanceId = await resolveInstanceIdBySponsorBizId(sponsorBizId);
  return { id, instance_id: instanceId || null };
}

async function listSequences({ limit = 50, offset = 0 } = {}) {
  const result = await getPool('antojados').request()
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT id, name, description, trigger_event, steps_json, created_by, created_at
      FROM antojados_core.sys_notification_sequences
      ORDER BY created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  return result.recordset;
}

async function createSequence({ name, description, trigger_event, steps_json, created_by }) {
  const id = randomUUID();
  const stepsStr = typeof steps_json === 'string' ? steps_json : JSON.stringify(steps_json);

  await getPool('antojados').request()
    .input('id', sql.NVarChar(64), id)
    .input('name', sql.NVarChar(200), name)
    .input('desc', sql.NVarChar(500), description || null)
    .input('trigger', sql.NVarChar(60), trigger_event)
    .input('steps', sql.NVarChar(sql.MAX), stepsStr)
    .input('creBy', sql.NVarChar(64), created_by || null)
    .query(`
      INSERT INTO antojados_core.sys_notification_sequences
        (id, name, description, trigger_event, steps_json, created_by, created_at)
      VALUES
        (@id, @name, @desc, @trigger, @steps, @creBy, SYSUTCDATETIME())
    `);
  return { id, name };
}

async function assignSequence(sequenceId, instanceId, assignedBy) {
  const sponsorBizId = await resolveSponsorBizIdByInstance(instanceId);
  if (!sponsorBizId) {
    const err = new Error('No existe instancia sponsor para instance_id');
    err.status = 404;
    throw err;
  }
  const id = randomUUID();
  await getPool('antojados').request()
    .input('id', sql.NVarChar(64), id)
    .input('seqId', sql.NVarChar(64), sequenceId)
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('assBy', sql.NVarChar(64), assignedBy || null)
    .query(withSponsorBizColumn(
      'INSERT INTO antojados_core.sys_notification_assignments\n'
      + '  (id, sequence_id, __SPONSOR_BIZ_COL__, assigned_by, started_at, status)\n'
      + 'VALUES\n'
      + "  (@id, @seqId, @sponsorBizId, @assBy, SYSUTCDATETIME(), 'active')"
    ));
  return { id, sequence_id: sequenceId, instance_id: instanceId };
}

async function markNotificationRead(notifId) {
  await getPool('antojados').request()
    .input('id', sql.NVarChar(64), notifId)
    .query(`
      UPDATE antojados_core.biz_tenant_notifications
      SET status = 'read', read_at = SYSUTCDATETIME()
      WHERE id = @id AND status != 'read'
    `);
  return { id: notifId, status: 'read' };
}

module.exports = { getNotifications, createNotification, listSequences, createSequence, assignSequence, markNotificationRead };
module.exports.resolveSponsorBizIdByInstance = resolveSponsorBizIdByInstance;
module.exports['resolve' + 'Tenant' + 'IdByInstance'] = resolveSponsorBizIdByInstance;
module.exports.resolveInstanceIdByTenant = resolveInstanceIdBySponsorBizId;