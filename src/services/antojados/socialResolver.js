'use strict';
/**
 * socialResolver.js — Resolver de Interacciones Sociales
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Interacciones Sociales (likes, comments,
 *               follows, saves, shares)
 * RESPONSABLE:  Ejecutar operaciones CRUD de interacciones sociales
 *               sobre soc_interactions, soc_follows, soc_saves y soc_posts.
 *
 * NO HACE:
 *   - No maneja biz_posts (lo hace bizResolver)
 *   - No maneja analytics (lo hace analyticsResolver)
 *
 * TABLAS QUE TOCA:
 *   antojados_core.soc_interactions → likes, comments, replies
 *   antojados_core.soc_follows      → follows/unfollows
 *   antojados_core.soc_saves         → saves/unsaves
 *   antojados_core.soc_posts        → actualiza métricas (counters)
 *   antojados_core.auth_identities  → JOIN para display_name, avatar
 *   antojados_core.soc_places       → JOIN para saves feed
 *
 * REFERENCIAS:
 *   - antojadosmx/docs/feed.md (Sección 5)
 *   - socialMapper.js, social.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql, randomUUID, _emitEvent } = require('./_shared');

async function resolvePostPlaceId(post_id) {
  const result = await getPool('antojados').request()
    .input('postId', sql.NVarChar(64), post_id)
    .query(`
      SELECT TOP 1 id
      FROM antojados_core.soc_posts
      WHERE post_id = @postId
    `);
  return result.recordset[0]?.id || null;
}

async function likePost(post_id, user_id, { created_at_client } = {}) {
  const id = await resolvePostPlaceId(post_id);
  const pool = getPool('antojados');
  const tr = new sql.Transaction(pool);
  try {
    await tr.begin();
    await new sql.Request(tr)
      .input('interactionId', sql.NVarChar(64), randomUUID())
      .input('userId', sql.NVarChar(64), user_id)
      .input('targetPostId', sql.NVarChar(64), post_id)
      .input('clientTs', sql.DateTime2(3), new Date(created_at_client || Date.now()))
      .query(`
        IF NOT EXISTS (
          SELECT 1 FROM antojados_core.soc_interactions
          WHERE user_id = @userId AND target_post_id = @targetPostId
            AND interaction_type = 'like_created'
        )
        BEGIN
          INSERT INTO antojados_core.soc_interactions
            (interaction_id, interaction_type, user_id, target_post_id, created_at_client)
          VALUES
            (@interactionId, 'like_created', @userId, @targetPostId, @clientTs);
          UPDATE antojados_core.soc_posts
          SET likes_count = likes_count + 1
          WHERE post_id = @targetPostId;
        END
      `);
    await tr.commit();
  } catch (e) {
    try { await tr.rollback(); } catch (_) {}
    throw e;
  }
  _emitEvent({ user_id, post_id, id, event_type: 'like_created', event_ts: created_at_client });
}

async function unlikePost(post_id, user_id) {
  const id = await resolvePostPlaceId(post_id);
  const pool = getPool('antojados');
  const tr = new sql.Transaction(pool);
  try {
    await tr.begin();
    await new sql.Request(tr)
      .input('userId', sql.NVarChar(64), user_id)
      .input('targetPostId', sql.NVarChar(64), post_id)
      .query(`
        DELETE FROM antojados_core.soc_interactions
        WHERE user_id = @userId AND target_post_id = @targetPostId
          AND interaction_type = 'like_created';
        IF @@ROWCOUNT > 0
          UPDATE antojados_core.soc_posts
          SET likes_count = CASE WHEN likes_count > 0 THEN likes_count - 1 ELSE 0 END
          WHERE post_id = @targetPostId;
      `);
    await tr.commit();
    _emitEvent({ user_id, post_id, id, event_type: 'post_unliked' });
  } catch (e) {
    try { await tr.rollback(); } catch (_) {}
    throw e;
  }
}

async function addComment({ post_id, user_id, content_text, parent_comment_id, created_at_client }) {
  const id = await resolvePostPlaceId(post_id);
  const pool = getPool('antojados');
  const tr = new sql.Transaction(pool);
  const interactionId = randomUUID();
  const type = parent_comment_id ? 'reply_created' : 'comment_created';

  try {
    await tr.begin();
    await new sql.Request(tr)
      .input('interactionId', sql.NVarChar(64), interactionId)
      .input('type', sql.NVarChar(30), type)
      .input('userId', sql.NVarChar(64), user_id)
      .input('targetPostId', sql.NVarChar(64), post_id)
      .input('parentCommentId', sql.NVarChar(64), parent_comment_id || null)
      .input('contentText', sql.NVarChar(2000), content_text)
      .input('clientTs', sql.DateTime2(3), new Date(created_at_client || Date.now()))
      .query(`
        INSERT INTO antojados_core.soc_interactions
          (interaction_id, interaction_type, user_id, target_post_id,
           parent_comment_id, content_text, created_at_client)
        VALUES
          (@interactionId, @type, @userId, @targetPostId,
           @parentCommentId, @contentText, @clientTs);
        UPDATE antojados_core.soc_posts
        SET comments_count = comments_count + 1
        WHERE post_id = @targetPostId;
      `);
    await tr.commit();
  } catch (e) {
    try { await tr.rollback(); } catch (_) {}
    throw e;
  }

  _emitEvent({
    user_id,
    post_id,
    id,
    event_type: 'post_commented',
    event_ts: created_at_client,
    payload: { comment_type: type },
  });
  return interactionId;
}

async function listComments(post_id, { limit, offset }) {
  const result = await getPool('antojados').request()
    .input('postId', sql.NVarChar(64), post_id)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT si.interaction_id, si.interaction_type, si.user_id,
             si.parent_comment_id, si.content_text,
             si.moderation_status, si.created_at_client, si.received_at_server,
             ai.display_name, ai.avatar_url
      FROM antojados_core.soc_interactions si
      LEFT JOIN antojados_core.auth_identities ai ON ai.user_id = si.user_id
      WHERE si.target_post_id = @postId
        AND si.interaction_type IN ('comment_created', 'reply_created')
        AND si.moderation_status = 'approved'
      ORDER BY si.received_at_server ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  return result.recordset;
}

async function followToggle({ follower_user_id, target_type, target_user_id, target_place_id }) {
  const req = getPool('antojados').request()
    .input('follower_user_id', sql.NVarChar(64), follower_user_id)
    .input('target_type', sql.NVarChar(10), target_type)
    .input('target_user_id', sql.NVarChar(64), target_user_id || null)
    .input('target_place_id', sql.NVarChar(64), target_place_id || null)
    .output('action', sql.NVarChar(12));
  const result = await req.execute('antojados_core.usp_toggle_follow');
  _emitEvent({
    user_id: follower_user_id,
    id: target_place_id,
    event_type: 'follow_toggle',
    payload: { target_type, target_user_id, target_place_id, action: result.output.action },
  });
  return { action: result.output.action };
}

async function saveToggle({ user_id, id }) {
  const req = getPool('antojados').request()
    .input('user_id', sql.NVarChar(64), user_id)
    .input('id', sql.NVarChar(64), id)
    .output('action', sql.NVarChar(10));
  const result = await req.execute('antojados_core.usp_toggle_save');
  _emitEvent({ user_id, id, event_type: 'save_toggle', payload: { action: result.output.action } });
  return { action: result.output.action };
}

async function sharePost(post_id, user_id, { created_at_client } = {}) {
  const id = await resolvePostPlaceId(post_id);
  await getPool('antojados').request()
    .input('postId', sql.NVarChar(64), post_id)
    .query(`
      UPDATE antojados_core.soc_posts
      SET shares_count = shares_count + 1
      WHERE post_id = @postId
    `);
  _emitEvent({ user_id, post_id, id, event_type: 'post_shared', event_ts: created_at_client });
  return { ok: true };
}

async function listFollowing({ user_id, target_type, limit, offset }) {
  const req = getPool('antojados').request()
    .input('userId', sql.NVarChar(64), user_id)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset);
  let where = `WHERE follower_user_id = @userId AND status = 'active'`;
  if (target_type) {
    req.input('targetType', sql.NVarChar(10), target_type);
    where += ` AND target_type = @targetType`;
  }
  const result = await req.query(`
    SELECT follow_id, target_type, target_user_id, target_place_id, created_at
    FROM antojados_core.soc_follows
    ${where}
    ORDER BY created_at DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);
  return result.recordset;
}

async function listFollowers({ user_id, limit, offset }) {
  const result = await getPool('antojados').request()
    .input('userId', sql.NVarChar(64), user_id)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT follow_id, follower_user_id, created_at
      FROM antojados_core.soc_follows
      WHERE target_user_id = @userId AND target_type = 'user' AND status = 'active'
      ORDER BY created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  return result.recordset;
}

async function listSaves({ user_id, limit, offset }) {
  const result = await getPool('antojados').request()
    .input('userId', sql.NVarChar(64), user_id)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT s.save_id, s.id, s.created_at,
             p.name AS place_name, p.category, p.city_code, p.avg_rating,
             p.whatsapp, p.description, p.plan_type
      FROM antojados_core.soc_saves s
      JOIN antojados_core.soc_places p ON p.id = s.id
      WHERE s.user_id = @userId
      ORDER BY s.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  return result.recordset;
}

async function getSavesFeed({ user_id, limit, offset }) {
  const result = await getPool('antojados').request()
    .input('userId', sql.NVarChar(64), user_id)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT p.post_id       AS id,
             ai.display_name AS author_handle,
             ai.avatar_url,
             p.business_name,
             p.dish_name,
             p.category,
             p.description   AS caption,
             p.media_url,
             p.media_type,
             p.avg_rating    AS average_rating,
             p.likes_count,
             p.comments_count,
             p.published_at  AS created_at,
             p.id,
             pl.city_code,
             pl.name         AS place_name
      FROM antojados_core.soc_posts p
      JOIN antojados_core.soc_places      pl ON pl.id = p.id
      JOIN antojados_core.auth_identities ai ON ai.user_id  = p.user_id
      WHERE p.post_status = 'active'
        AND p.id IN (
          SELECT id FROM antojados_core.soc_saves
          WHERE user_id = @userId AND is_deleted = 0
        )
      ORDER BY p.published_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  return result.recordset;
}

module.exports = {
  likePost,
  unlikePost,
  addComment,
  listComments,
  sharePost,
  followToggle,
  saveToggle,
  listFollowing,
  listFollowers,
  listSaves,
  getSavesFeed,
};
