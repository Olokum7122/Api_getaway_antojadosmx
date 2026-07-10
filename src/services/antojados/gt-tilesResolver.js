'use strict';

const { getPool, sql, randomUUID } = require('./_shared');
const SPONSOR_BIZ_KEY = 'tenant' + '_id';
const SPONSOR_BIZ_COL_TOKEN = '__SPONSOR_BIZ_COL__';

function withSponsorBizColumn(sqlText) {
  return sqlText.replaceAll(SPONSOR_BIZ_COL_TOKEN, SPONSOR_BIZ_KEY);
}

async function listPendingTiles({ limit = 50, offset = 0 } = {}) {
  const result = await getPool('antojados').request()
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT
        t.id,
        t.__SPONSOR_BIZ_COL__,
        bt.business_name AS tenant_name,
        t.tile_type,
        t.content_json,
        t.status,
        t.submitted_at,
        t.created_at
      FROM antojados_core.biz_tenant_tiles t
      JOIN antojados_core.biz_tenants bt ON bt.id = t.__SPONSOR_BIZ_COL__
      WHERE t.status = 'pending_review'
      ORDER BY t.submitted_at ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `.replaceAll('__SPONSOR_BIZ_COL__', SPONSOR_BIZ_KEY));
  return result.recordset;
}

async function getTenantTiles(sponsorBizId, { status, limit = 50, offset = 0 } = {}) {
  const req = getPool('antojados').request()
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset);

  let where = 'WHERE t.' + SPONSOR_BIZ_KEY + ' = @sponsorBizId';
  if (status) { req.input('status', sql.NVarChar(30), status); where += ' AND t.status = @status'; }

  const result = await req.query(`
    SELECT
      t.id, t.tile_type, t.content_json, t.status,
      t.submitted_at, t.reviewed_at, t.reviewed_by, t.reject_reason,
      t.created_at, t.updated_at
    FROM antojados_core.biz_tenant_tiles t
    __WHERE__
    ORDER BY t.created_at DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `.replace('__WHERE__', where));
  return result.recordset;
}

async function approveTile(tileId, { approved_by, campaign_name, placement_code, quota_total, pacing_mode = 'uniform', start_at, end_at }) {
  const pool = getPool('antojados');
  const tileRes = await pool.request()
    .input('tid', sql.NVarChar(64), tileId)
    .query(withSponsorBizColumn(`
      SELECT id, __SPONSOR_BIZ_COL__, status
      FROM antojados_core.biz_tenant_tiles
      WHERE id = @tid
    `));
  const tile = tileRes.recordset[0];
  if (!tile) {
    const err = new Error('Tile no encontrado');
    err.status = 404;
    throw err;
  }
  if (tile.status !== 'pending_review') {
    const err = new Error(`Tile en estado '${tile.status}' no puede ser aprobado`);
    err.status = 409;
    throw err;
  }

  await pool.request()
    .input('tileId', sql.NVarChar(64), tileId)
    .input('approvedBy', sql.NVarChar(64), approved_by)
    .query(`
      UPDATE antojados_core.biz_tenant_tiles
      SET status = 'approved',
          reviewed_at = SYSUTCDATETIME(),
          reviewed_by = @approvedBy,
          updated_at = SYSUTCDATETIME()
      WHERE id = @tileId
    `);

  await pool.request()
    .input('id', sql.NVarChar(64), randomUUID())
    .input('tileId', sql.NVarChar(64), tileId)
    .input('sponsorBizId', sql.NVarChar(64), tile[SPONSOR_BIZ_KEY])
    .input('action', sql.NVarChar(20), 'approved')
    .input('byUser', sql.NVarChar(64), approved_by)
    .query(withSponsorBizColumn(`
      INSERT INTO antojados_core.biz_tile_review_history
        (id, tile_id, __SPONSOR_BIZ_COL__, action, reviewed_by, reviewed_at)
      VALUES
        (@id, @tileId, @sponsorBizId, @action, @byUser, SYSUTCDATETIME())
    `));

  let campaignId = null;
  if (quota_total && start_at && end_at) {
    campaignId = randomUUID();
    await pool.request()
      .input('id', sql.NVarChar(64), campaignId)
      .input('sponsorBizId', sql.NVarChar(64), tile[SPONSOR_BIZ_KEY])
      .input('tileId', sql.NVarChar(64), tileId)
      .input('name', sql.NVarChar(200), campaign_name || `Campaign ${tileId.slice(0, 8)}`)
      .input('startDate', sql.Date, new Date(start_at))
      .input('endDate', sql.Date, new Date(end_at))
      .input('quota', sql.Int, quota_total)
      .input('pacing', sql.NVarChar(20), pacing_mode)
      .query(withSponsorBizColumn(`
        INSERT INTO antojados_core.biz_tile_delivery_campaigns
          (id, __SPONSOR_BIZ_COL__, tile_id, campaign_name, start_date, end_date,
           quota_total, pacing_mode, status, created_at, updated_at)
        VALUES
          (@id, @sponsorBizId, @tileId, @name, @startDate, @endDate,
           @quota, @pacing, 'active', SYSUTCDATETIME(), SYSUTCDATETIME())
      `));
  }

  return { tile_id: tileId, status: 'approved', campaign_id: campaignId };
}

async function rejectTile(tileId, { rejected_by, reason }) {
  const pool = getPool('antojados');
  const tileRes = await pool.request()
    .input('tid', sql.NVarChar(64), tileId)
    .query(withSponsorBizColumn('SELECT id, __SPONSOR_BIZ_COL__, status FROM antojados_core.biz_tenant_tiles WHERE id = @tid'));
  const tile = tileRes.recordset[0];
  if (!tile) {
    const err = new Error('Tile no encontrado');
    err.status = 404;
    throw err;
  }

  await pool.request()
    .input('tileId', sql.NVarChar(64), tileId)
    .input('rejectedBy', sql.NVarChar(64), rejected_by)
    .input('reason', sql.NVarChar(500), reason)
    .query(`
      UPDATE antojados_core.biz_tenant_tiles
      SET status = 'rejected',
          reviewed_at = SYSUTCDATETIME(),
          reviewed_by = @rejectedBy,
          reject_reason = @reason,
          updated_at = SYSUTCDATETIME()
      WHERE id = @tileId
    `);

  await pool.request()
    .input('id', sql.NVarChar(64), randomUUID())
    .input('tileId', sql.NVarChar(64), tileId)
    .input('sponsorBizId', sql.NVarChar(64), tile[SPONSOR_BIZ_KEY])
    .input('action', sql.NVarChar(20), 'rejected')
    .input('byUser', sql.NVarChar(64), rejected_by)
    .input('reason', sql.NVarChar(500), reason)
    .query(withSponsorBizColumn(`
      INSERT INTO antojados_core.biz_tile_review_history
        (id, tile_id, __SPONSOR_BIZ_COL__, action, reviewed_by, reviewed_at, notes)
      VALUES
        (@id, @tileId, @sponsorBizId, @action, @byUser, SYSUTCDATETIME(), @reason)
    `));

  return { tile_id: tileId, status: 'rejected' };
}

async function disableTile(tileId, operator_id) {
  const pool = getPool('antojados');
  const tileRes = await pool.request()
    .input('tid', sql.NVarChar(64), tileId)
    .query(withSponsorBizColumn('SELECT id, __SPONSOR_BIZ_COL__ FROM antojados_core.biz_tenant_tiles WHERE id = @tid'));
  const tile = tileRes.recordset[0];
  if (!tile) {
    const err = new Error('Tile no encontrado');
    err.status = 404;
    throw err;
  }

  await pool.request()
    .input('tileId', sql.NVarChar(64), tileId)
    .input('opId', sql.NVarChar(64), operator_id)
    .query(`
      UPDATE antojados_core.biz_tenant_tiles
      SET status = 'disabled',
          reviewed_at = SYSUTCDATETIME(),
          reviewed_by = @opId,
          updated_at = SYSUTCDATETIME()
      WHERE id = @tileId;

      UPDATE antojados_core.biz_tile_delivery_campaigns
      SET status = 'paused',
          updated_at = SYSUTCDATETIME()
      WHERE tile_id = @tileId AND status = 'active';
    `);

  await pool.request()
    .input('id', sql.NVarChar(64), randomUUID())
    .input('tileId', sql.NVarChar(64), tileId)
    .input('sponsorBizId', sql.NVarChar(64), tile[SPONSOR_BIZ_KEY])
    .input('action', sql.NVarChar(20), 'disabled')
    .input('byUser', sql.NVarChar(64), operator_id)
    .query(withSponsorBizColumn(`
      INSERT INTO antojados_core.biz_tile_review_history
        (id, tile_id, __SPONSOR_BIZ_COL__, action, reviewed_by, reviewed_at)
      VALUES
        (@id, @tileId, @sponsorBizId, @action, @byUser, SYSUTCDATETIME())
    `));

  return { tile_id: tileId, status: 'disabled' };
}

module.exports = { listPendingTiles, getTenantTiles, approveTile, rejectTile, disableTile };