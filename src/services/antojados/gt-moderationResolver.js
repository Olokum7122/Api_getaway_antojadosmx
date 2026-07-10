'use strict';

const { getPool, sql, randomUUID } = require('./_shared');
const SPONSOR_BIZ_KEY = 'tenant' + '_id';

function withSponsorBizColumn(sqlText) {
  return sqlText.replaceAll('__SPONSOR_BIZ_COL__', SPONSOR_BIZ_KEY);
}

const VALID_CONTENT_TYPES = [
  'tenant_gallery_post', 'tenant_catalog_item', 'tenant_arre_event', 'tenant_tile', 'user_report',
];

async function getQueue({ status, content_type, priority, limit = 50, offset = 0 } = {}) {
  const req = getPool('antojados').request()
    .input('status', sql.NVarChar(20), status || null)
    .input('contentType', sql.NVarChar(60), content_type || null)
    .input('priority', sql.NVarChar(20), priority || null)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset);

  const result = await req.query(withSponsorBizColumn(`
    SELECT
      m.id,
      m.__SPONSOR_BIZ_COL__,
      m.content_type,
      m.content_id,
      m.submitted_by,
      m.status,
      m.priority,
      m.reason,
      m.assigned_to,
      m.reviewed_by,
      m.reviewed_at,
      m.decision,
      m.notes,
      m.created_at,
      m.updated_at
    FROM antojados_core.sys_moderation_queue m
    WHERE (@status IS NULL OR m.status = @status)
      AND (@contentType IS NULL OR m.content_type = @contentType)
      AND (@priority IS NULL OR m.priority = @priority)
    ORDER BY
      CASE m.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
      m.created_at ASC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `));
  return result.recordset;
}

async function approveContent(contentType, contentId, { reviewed_by, notes }) {
  const pool = getPool('antojados');

  if (!VALID_CONTENT_TYPES.includes(contentType)) {
    const err = new Error(`content_type inválido: ${VALID_CONTENT_TYPES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  await pool.request()
    .input('ctype', sql.NVarChar(60), contentType)
    .input('cid', sql.NVarChar(64), contentId)
    .input('by', sql.NVarChar(64), reviewed_by)
    .input('notes', sql.NVarChar(sql.MAX), notes || null)
    .query(`
      UPDATE antojados_core.sys_moderation_queue
      SET status = 'approved',
          decision = 'approved',
          reviewed_by = @by,
          reviewed_at = SYSUTCDATETIME(),
          notes = @notes,
          updated_at = SYSUTCDATETIME()
      WHERE content_type = @ctype
        AND content_id = @cid
        AND status NOT IN ('approved', 'rejected')
    `);

  await updateContentStatus(pool, contentType, contentId, 'approved', reviewed_by);
  return { content_type: contentType, content_id: contentId, decision: 'approved' };
}

async function rejectContent(contentType, contentId, { reviewed_by, notes, reason }) {
  const pool = getPool('antojados');

  if (!VALID_CONTENT_TYPES.includes(contentType)) {
    const err = new Error(`content_type inválido: ${VALID_CONTENT_TYPES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  await pool.request()
    .input('ctype', sql.NVarChar(60), contentType)
    .input('cid', sql.NVarChar(64), contentId)
    .input('by', sql.NVarChar(64), reviewed_by)
    .input('notes', sql.NVarChar(sql.MAX), notes || null)
    .input('reason', sql.NVarChar(500), reason || null)
    .query(`
      UPDATE antojados_core.sys_moderation_queue
      SET status = 'rejected',
          decision = 'rejected',
          reviewed_by = @by,
          reviewed_at = SYSUTCDATETIME(),
          notes = @notes,
          updated_at = SYSUTCDATETIME()
      WHERE content_type = @ctype
        AND content_id = @cid
        AND status NOT IN ('approved', 'rejected')
    `);

  await updateContentStatus(pool, contentType, contentId, 'rejected', reviewed_by, reason);
  return { content_type: contentType, content_id: contentId, decision: 'rejected' };
}

async function updateContentStatus(pool, contentType, contentId, decision, reviewedBy, reason = null) {
  if (contentType === 'user_report') return;

  const req = pool.request()
    .input('cid', sql.NVarChar(64), contentId)
    .input('status', sql.NVarChar(30), decision)
    .input('by', sql.NVarChar(64), reviewedBy)
    .input('reason', sql.NVarChar(500), reason || null);

  const withReason = reason != null && String(reason).trim() !== '';
  let query = null;

  if (contentType === 'tenant_gallery_post') {
    query = withReason
      ? `
        UPDATE antojados_core.biz_tenant_gallery_posts
        SET status = @status,
            approved_by = CASE WHEN @status = 'approved' THEN @by ELSE NULL END,
            approved_at = CASE WHEN @status = 'approved' THEN SYSUTCDATETIME() ELSE NULL END,
            rejected_reason = CASE WHEN @status = 'rejected' THEN @reason ELSE NULL END,
            updated_at = SYSUTCDATETIME()
        WHERE id = @cid
      `
      : `
        UPDATE antojados_core.biz_tenant_gallery_posts
        SET status = @status,
            approved_by = CASE WHEN @status = 'approved' THEN @by ELSE NULL END,
            approved_at = CASE WHEN @status = 'approved' THEN SYSUTCDATETIME() ELSE NULL END,
            updated_at = SYSUTCDATETIME()
        WHERE id = @cid
      `;
  } else if (contentType === 'tenant_catalog_item') {
    query = withReason
      ? `
        UPDATE antojados_core.biz_tenant_catalog_items
        SET status = @status,
            approved_by = CASE WHEN @status = 'approved' THEN @by ELSE NULL END,
            approved_at = CASE WHEN @status = 'approved' THEN SYSUTCDATETIME() ELSE NULL END,
            rejected_reason = CASE WHEN @status = 'rejected' THEN @reason ELSE NULL END,
            updated_at = SYSUTCDATETIME()
        WHERE id = @cid
      `
      : `
        UPDATE antojados_core.biz_tenant_catalog_items
        SET status = @status,
            approved_by = CASE WHEN @status = 'approved' THEN @by ELSE NULL END,
            approved_at = CASE WHEN @status = 'approved' THEN SYSUTCDATETIME() ELSE NULL END,
            updated_at = SYSUTCDATETIME()
        WHERE id = @cid
      `;
  } else if (contentType === 'tenant_arre_event') {
    query = withReason
      ? `
        UPDATE antojados_core.biz_tenant_arre_events
        SET status = @status,
            approved_by = CASE WHEN @status = 'approved' THEN @by ELSE NULL END,
            approved_at = CASE WHEN @status = 'approved' THEN SYSUTCDATETIME() ELSE NULL END,
            rejected_reason = CASE WHEN @status = 'rejected' THEN @reason ELSE NULL END,
            updated_at = SYSUTCDATETIME()
        WHERE id = @cid
      `
      : `
        UPDATE antojados_core.biz_tenant_arre_events
        SET status = @status,
            approved_by = CASE WHEN @status = 'approved' THEN @by ELSE NULL END,
            approved_at = CASE WHEN @status = 'approved' THEN SYSUTCDATETIME() ELSE NULL END,
            updated_at = SYSUTCDATETIME()
        WHERE id = @cid
      `;
  } else if (contentType === 'tenant_tile') {
    query = withReason
      ? `
        UPDATE antojados_core.biz_tenant_tiles
        SET status = @status,
            approved_by = CASE WHEN @status = 'approved' THEN @by ELSE NULL END,
            approved_at = CASE WHEN @status = 'approved' THEN SYSUTCDATETIME() ELSE NULL END,
            rejected_reason = CASE WHEN @status = 'rejected' THEN @reason ELSE NULL END,
            updated_at = SYSUTCDATETIME()
        WHERE id = @cid
      `
      : `
        UPDATE antojados_core.biz_tenant_tiles
        SET status = @status,
            approved_by = CASE WHEN @status = 'approved' THEN @by ELSE NULL END,
            approved_at = CASE WHEN @status = 'approved' THEN SYSUTCDATETIME() ELSE NULL END,
            updated_at = SYSUTCDATETIME()
        WHERE id = @cid
      `;
  }

  if (!query) return;
  await req.query(query);
}

async function submitToQueue(sponsorBizId, { content_type, content_id, submitted_by, reason, priority = 'normal' }) {
  const id = randomUUID();
  await getPool('antojados').request()
    .input('id', sql.NVarChar(64), id)
    .input('sponsorBizId', sql.NVarChar(64), sponsorBizId || null)
    .input('ctype', sql.NVarChar(60), content_type)
    .input('cid', sql.NVarChar(64), content_id)
    .input('subBy', sql.NVarChar(64), submitted_by || null)
    .input('reason', sql.NVarChar(500), reason || null)
    .input('prio', sql.NVarChar(20), priority)
    .query(withSponsorBizColumn(`
      INSERT INTO antojados_core.sys_moderation_queue
        (id, __SPONSOR_BIZ_COL__, content_type, content_id, submitted_by, reason, priority, status, created_at, updated_at)
      VALUES
        (@id, @sponsorBizId, @ctype, @cid, @subBy, @reason, @prio, 'pending', SYSUTCDATETIME(), SYSUTCDATETIME())
    `));
  return { id, content_type, content_id };
}

module.exports = { getQueue, approveContent, rejectContent, submitToQueue };