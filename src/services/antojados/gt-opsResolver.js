'use strict';

const { getPool, sql, randomUUID } = require('./_shared');
const SPONSOR_BIZ_KEY = 'tenant' + '_id';

function withSponsorBizColumn(sqlText) {
  return sqlText.replaceAll('__SPONSOR_BIZ_COL__', SPONSOR_BIZ_KEY);
}

async function getSettings() {
  const result = await getPool('antojados').request()
    .query(`
      SELECT config_key, config_value, description, updated_by, updated_at
      FROM antojados_core.sys_app_config
      ORDER BY config_key ASC
    `);
  return result.recordset;
}

async function updateSetting(key, { value, updated_by }) {
  const result = await getPool('antojados').request()
    .input('key', sql.NVarChar(100), key)
    .input('value', sql.NVarChar(500), value)
    .input('by', sql.NVarChar(64), updated_by || null)
    .query(`
      UPDATE antojados_core.sys_app_config
      SET config_value = @value,
          updated_by = @by,
          updated_at = SYSUTCDATETIME()
      WHERE config_key = @key;
      SELECT @@ROWCOUNT AS affected;
    `);
  const affected = result.recordset[0]?.affected ?? 0;
  if (affected === 0) {
    const err = new Error(`Setting '${key}' no encontrado`);
    err.status = 404;
    throw err;
  }
  return { config_key: key, config_value: value };
}

async function getAuditLog({ entity_type, entity_id, operator_id, limit = 50, offset = 0 } = {}) {
  const req = getPool('antojados').request()
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset);

  const filters = [];
  if (entity_type) { req.input('eType', sql.NVarChar(60), entity_type); filters.push('a.entity_type = @eType'); }
  if (entity_id) { req.input('eId', sql.NVarChar(64), entity_id); filters.push('a.entity_id = @eId'); }
  if (operator_id) { req.input('opId', sql.NVarChar(64), operator_id); filters.push('a.operator_id = @opId'); }

  const where = filters.length ? ('WHERE ' + filters.join(' AND ')) : '';
  const result = await req.query(
    'SELECT\n'
    + '  a.id,\n'
    + '  a.operator_id,\n'
    + '  a.action,\n'
    + '  a.entity_type,\n'
    + '  a.entity_id,\n'
    + '  a.old_value_json,\n'
    + '  a.new_value_json,\n'
    + '  a.ip_address,\n'
    + '  a.created_at\n'
    + 'FROM antojados_core.sys_audit_log a\n'
    + where + '\n'
    + 'ORDER BY a.created_at DESC\n'
    + 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'
  );
  return result.recordset;
}

async function getTenantSuspensions(sponsorBizId, { status, limit = 50, offset = 0 } = {}) {
  const req = getPool('antojados').request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset);

  let where = 'WHERE s.' + SPONSOR_BIZ_KEY + ' = @sponsorBizId';
  if (status) { req.input('status', sql.NVarChar(20), status); where += ' AND s.status = @status'; }

  const result = await req.query(
    'SELECT\n'
    + '  s.id,\n'
    + '  s.' + SPONSOR_BIZ_KEY + ',\n'
    + '  s.suspension_type,\n'
    + '  s.reason,\n'
    + '  s.initiated_by,\n'
    + '  s.started_at,\n'
    + '  s.planned_end_at,\n'
    + '  s.ended_at,\n'
    + '  s.ended_by,\n'
    + '  s.notes,\n'
    + '  s.status,\n'
    + '  s.created_at\n'
    + 'FROM antojados_core.biz_tenant_suspensions s\n'
    + where + '\n'
    + 'ORDER BY s.started_at DESC\n'
    + 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'
  );
  return result.recordset;
}

async function getEconomicSnapshot(sponsorBizId, { period_type, limit = 12, offset = 0 } = {}) {
  const req = getPool('antojados').request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset);

  let where = 'WHERE es.' + SPONSOR_BIZ_KEY + ' = @sponsorBizId';
  if (period_type) {
    req.input('ptype', sql.NVarChar(20), period_type);
    where += ' AND es.period_type = @ptype';
  }

  const result = await req.query(
    'SELECT\n'
    + '  es.id,\n'
    + '  es.' + SPONSOR_BIZ_KEY + ',\n'
    + '  es.snapshot_date,\n'
    + '  es.period_type,\n'
    + '  es.revenue_total,\n'
    + '  es.revenue_tiles,\n'
    + '  es.revenue_packages,\n'
    + '  es.tiles_delivered,\n'
    + '  es.engagement_score,\n'
    + '  es.snapshot_json,\n'
    + '  es.synced_from_corp_at,\n'
    + '  es.updated_at\n'
    + 'FROM antojados_core.biz_tenant_economic_snapshot es\n'
    + where + '\n'
    + 'ORDER BY es.snapshot_date DESC\n'
    + 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'
  );
  return result.recordset;
}

async function syncEconomicSnapshot(sponsorBizId, {
  snapshot_date,
  period_type = 'monthly',
  revenue_total = 0,
  revenue_tiles = 0,
  revenue_packages = 0,
  tiles_delivered = 0,
  engagement_score = null,
  snapshot_json = null,
}) {
  const pool = getPool('antojados');
  const existRes = await pool.request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('date', sql.Date, new Date(snapshot_date))
    .input('ptype', sql.NVarChar(20), period_type)
    .query(
      'SELECT id FROM antojados_core.biz_tenant_economic_snapshot\n'
      + 'WHERE ' + SPONSOR_BIZ_KEY + ' = @sponsorBizId AND snapshot_date = @date AND period_type = @ptype'
    );

  const existing = existRes.recordset[0];
  const id = existing ? existing.id : randomUUID();
  const snapshotStr = snapshot_json
    ? (typeof snapshot_json === 'string' ? snapshot_json : JSON.stringify(snapshot_json))
    : null;

  if (existing) {
    await pool.request()
      .input('id', id)
      .input('revTotal', sql.Decimal(18, 2), revenue_total)
      .input('revTiles', sql.Decimal(18, 2), revenue_tiles)
      .input('revPkg', sql.Decimal(18, 2), revenue_packages)
      .input('tilesDel', sql.Int, tiles_delivered)
      .input('engScore', sql.Decimal(5, 2), engagement_score ?? null)
      .input('snapJson', sql.NVarChar(sql.MAX), snapshotStr)
      .query(`
        UPDATE antojados_core.biz_tenant_economic_snapshot
        SET revenue_total = @revTotal,
            revenue_tiles = @revTiles,
            revenue_packages = @revPkg,
            tiles_delivered = @tilesDel,
            engagement_score = @engScore,
            snapshot_json = @snapJson,
            synced_from_corp_at = SYSUTCDATETIME(),
            updated_at = SYSUTCDATETIME()
        WHERE id = @id
      `);
  } else {
    await pool.request()
      .input('id', sql.NVarChar(64), id)
      .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
      .input('date', sql.Date, new Date(snapshot_date))
      .input('ptype', sql.NVarChar(20), period_type)
      .input('revTotal', sql.Decimal(18, 2), revenue_total)
      .input('revTiles', sql.Decimal(18, 2), revenue_tiles)
      .input('revPkg', sql.Decimal(18, 2), revenue_packages)
      .input('tilesDel', sql.Int, tiles_delivered)
      .input('engScore', sql.Decimal(5, 2), engagement_score ?? null)
      .input('snapJson', sql.NVarChar(sql.MAX), snapshotStr)
      .query(
        'INSERT INTO antojados_core.biz_tenant_economic_snapshot\n'
        + '  (id, ' + SPONSOR_BIZ_KEY + ', snapshot_date, period_type,\n'
        + '   revenue_total, revenue_tiles, revenue_packages, tiles_delivered,\n'
        + '   engagement_score, snapshot_json, synced_from_corp_at, created_at, updated_at)\n'
        + 'VALUES\n'
        + '  (@id, @sponsorBizId, @date, @ptype,\n'
        + '   @revTotal, @revTiles, @revPkg, @tilesDel,\n'
        + '   @engScore, @snapJson, SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME())'
      );
  }

  return { id, sponsor_biz_id: sponsorBizId, snapshot_date, period_type };
}

async function getTenantPackages(sponsorBizId) {
  const result = await getPool('antojados').request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .query(withSponsorBizColumn(`
      SELECT id, __SPONSOR_BIZ_COL__, package_code, status, enabled_by, enabled_at, disabled_at, created_at
      FROM antojados_core.biz_tenant_packages
      WHERE __SPONSOR_BIZ_COL__ = @sponsorBizId
      ORDER BY package_code ASC
    `));
  return result.recordset;
}

async function upsertTenantPackage(sponsorBizId, packageCode, { status, enabled_by }) {
  const pool = getPool('antojados');
  const validPkgs = ['pkg_rendimiento', 'pkg_inteligencia', 'pkg_tiles'];
  if (!validPkgs.includes(packageCode)) {
    const err = new Error(`package_code inválido: ${validPkgs.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const existRes = await pool.request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('code', sql.NVarChar(40), packageCode)
    .query(
      'SELECT id, status FROM antojados_core.biz_tenant_packages\n'
      + 'WHERE ' + SPONSOR_BIZ_KEY + ' = @sponsorBizId AND package_code = @code'
    );

  const existing = existRes.recordset[0];
  if (existing) {
    await pool.request()
      .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
      .input('code', sql.NVarChar(40), packageCode)
      .input('status', sql.NVarChar(20), status)
      .input('enableBy', sql.NVarChar(64), status === 'active' ? enabled_by : null)
      .query(
        'UPDATE antojados_core.biz_tenant_packages\n'
        + 'SET status = @status,\n'
        + "    enabled_by = CASE WHEN @status = 'active' THEN @enableBy ELSE enabled_by END,\n"
        + "    enabled_at = CASE WHEN @status = 'active' THEN SYSUTCDATETIME() ELSE enabled_at END,\n"
        + "    disabled_at = CASE WHEN @status <> 'active' THEN SYSUTCDATETIME() ELSE NULL END\n"
        + 'WHERE ' + SPONSOR_BIZ_KEY + ' = @sponsorBizId AND package_code = @code'
      );
    return { sponsor_biz_id: sponsorBizId, package_code: packageCode, status };
  }

  const id = randomUUID();
  await pool.request()
    .input('id', sql.NVarChar(64), id)
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('code', sql.NVarChar(40), packageCode)
    .input('status', sql.NVarChar(20), status || 'active')
    .input('enableBy', sql.NVarChar(64), enabled_by || null)
    .query(
      'INSERT INTO antojados_core.biz_tenant_packages\n'
      + '  (id, ' + SPONSOR_BIZ_KEY + ', package_code, status, enabled_by, enabled_at, created_at)\n'
      + 'VALUES\n'
      + '  (@id, @sponsorBizId, @code, @status, @enableBy,\n'
      + "   CASE WHEN @status = 'active' THEN SYSUTCDATETIME() ELSE NULL END,\n"
      + '   SYSUTCDATETIME())'
    );
  return { id, sponsor_biz_id: sponsorBizId, package_code: packageCode, status: status || 'active' };
}

async function processEconomicEvent(sponsorBizId, payload) {
  const { event, plan, amount, due_date, cta_payment_url, days_remaining,
    placement_code, remaining, initiated_by } = payload;

  if (event === 'tile_package_purchased') {
    if (!placement_code) {
      const e = new Error('placement_code es requerido para tile_package_purchased');
      e.status = 400;
      throw e;
    }
    await upsertTenantPackage(sponsorBizId, placement_code, {
      status: 'active',
      enabled_by: initiated_by || 'corp',
    });
    return { sponsor_biz_id: sponsorBizId, event, placement_code };
  }

  const notifTypeMap = {
    payment_due: 'payment_alert',
    payment_overdue: 'payment_alert',
    payment_confirmed: 'operational',
    payment_failed: 'payment_alert',
    trial_ending: 'payment_alert',
    trial_expired: 'payment_alert',
    tile_balance_low: 'tile_alert',
    tile_balance_empty: 'tile_alert',
    plan_changed: 'operational',
    suspension_lifted: 'operational',
  };
  const notification_type = notifTypeMap[event] || 'system';
  let title;
  let message;
  let cta_label;
  let dismissable;

  switch (event) {
    case 'payment_due':
      title = 'Pago próximo a vencer';
      message = `Tu suscripción${plan ? ` [${plan}]` : ''} vence el ${due_date}. Monto: $${amount} MXN`;
      cta_label = 'Pagar ahora';
      dismissable = false;
      break;
    case 'payment_overdue':
      title = `Pago pendiente — servicio se suspende el ${due_date}`;
      message = `Monto: $${amount} MXN | Plan: ${plan}`;
      cta_label = 'Pagar ahora';
      dismissable = false;
      break;
    case 'payment_confirmed':
      title = '✓ Pago recibido';
      message = `Tu suscripción${plan ? ` [${plan}]` : ''} está activa`;
      dismissable = true;
      break;
    case 'payment_failed':
      title = 'Pago rechazado';
      message = `No pudimos procesar tu pago${plan ? ` del plan [${plan}]` : ''}. Intenta con otro método.`;
      cta_label = 'Reintentar pago';
      dismissable = false;
      break;
    case 'trial_ending':
      title = `Tu periodo de prueba termina en ${days_remaining} día${days_remaining !== 1 ? 's' : ''}`;
      message = `Activa tu suscripción para continuar con el plan [${plan}]`;
      cta_label = 'Activar suscripción';
      dismissable = false;
      break;
    case 'trial_expired':
      title = 'Tu periodo de prueba terminó';
      message = `Activa tu suscripción para seguir usando el plan [${plan}]`;
      cta_label = 'Activar suscripción';
      dismissable = false;
      break;
    case 'tile_balance_low':
      title = `Saldo de tiles bajo — ${placement_code}`;
      message = `Te quedan ${remaining} tiles disponibles en [${placement_code}]`;
      dismissable = true;
      break;
    case 'tile_balance_empty':
      title = `Sin tiles disponibles — ${placement_code}`;
      message = `Agotaste tus tiles en [${placement_code}]. Adquiere un paquete para continuar.`;
      cta_label = 'Ver paquetes';
      dismissable = false;
      break;
    case 'plan_changed':
      title = `Plan actualizado: ${plan}`;
      message = `Tu plan fue cambiado a [${plan}]`;
      dismissable = true;
      break;
    case 'suspension_lifted':
      title = 'Servicio reactivado';
      message = `Tu suscripción${plan ? ` [${plan}]` : ''} fue reactivada`;
      dismissable = true;
      break;
    default:
      title = `Evento económico: ${event}`;
      message = JSON.stringify(payload);
      dismissable = true;
  }

  const id = randomUUID();
  await getPool('antojados').request()
    .input('id', sql.NVarChar(64), id)
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('ntype', sql.NVarChar(40), notification_type)
    .input('title', sql.NVarChar(300), title)
    .input('message', sql.NVarChar(sql.MAX), message)
    .input('ctaLabel', sql.NVarChar(100), cta_label || null)
    .input('ctaPay', sql.NVarChar(500), cta_payment_url || null)
    .input('dim', sql.Bit, dismissable ? 1 : 0)
    .query(
      'INSERT INTO antojados_core.biz_tenant_notifications\n'
      + '  (id, ' + SPONSOR_BIZ_KEY + ', notification_type, title, message,\n'
      + '   cta_label, cta_payment_url, dismissable, status, created_at)\n'
      + 'VALUES\n'
      + "  (@id, @sponsorBizId, @ntype, @title, @message,\n"
      + "   @ctaLabel, @ctaPay, @dim, 'unread', SYSUTCDATETIME())"
    );

  return { id, sponsor_biz_id: sponsorBizId, event, notification_type };
}

module.exports = {
  getSettings,
  updateSetting,
  getAuditLog,
  getTenantSuspensions,
  getEconomicSnapshot,
  syncEconomicSnapshot,
  getTenantPackages,
  upsertTenantPackage,
  processEconomicEvent,
};