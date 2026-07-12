'use strict';

/**
 * feedService.js — Servicio de feed unificado para AntojadosMX
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — API Gateway (Server-side)
 * RESPONSABLE:  Servir el feed unificado vía SP feed_get_feed.
 *               Reemplazó queries directas por EXEC SP (ver 7.2.6-D).
 *
 * PROHIBICIONES (7.2.6 §I.6):
 *   ❌ Consultar SQL directo — toda consulta de feed debe pasar por
 *      antojados_core.feed_get_feed SP.
 *
 * CAMBIOS v3:
 *   - Migrado a antojados_core.feed_get_feed SP (sp_feed_get_feed.sql)
 *   - Eliminadas queries directas a biz_posts/soc_posts
 *   - Eliminado authorJoin/authorSelect (lo maneja el SP)
 *   - Eliminado bizExtra (lo maneja el SP)
 *
 * REFERENCIAS:
 *   - antojadosmx/sql/antojados-core/sp_feed_get_feed.sql
 *   - PLAN_REESTRUCTURACION_CONSUMO.md §7.2.6-D
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql } = require('./_shared');

const FEED_SCOPE_MAP = Object.freeze({
  'vas_ir':   { table: 'biz_posts',  channels: ['vas_ir'], type: 'biz' },
  'arre':     { table: 'biz_posts',  channels: ['arre'], type: 'biz' },
  'pachanga': { table: 'soc_posts',  channels: ['pachanga', 'neta'], type: 'soc' },
  'barrio':   { table: 'soc_posts',  channels: ['barrio'], type: 'soc' },
  'que_pex':  { table: 'soc_posts',  channels: ['que_pex'], type: 'soc' },
  'desma':    { table: 'soc_posts',  channels: ['desma'], type: 'soc' },
});

const FEED_SCOPES = Object.keys(FEED_SCOPE_MAP);
const SCOPE_LEVEL_SKIP_GEO = Object.freeze(new Set(['mexico', 'global']));
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

async function getFeed({
  feed_scope,
  city_code,
  zone_code,
  scope_level,
  cursor,
  limit,
  popular,
  userId,
  user_id,
  biz_post_id,
  feed_type,
} = {}) {
  _validateFeedScope(feed_scope);

  const scopeConfig = FEED_SCOPE_MAP[feed_scope];
  const type = scopeConfig.type;
  const channels = scopeConfig.channels;
  const limitNum = Math.min(Math.max(1, limit || DEFAULT_LIMIT), MAX_LIMIT);
  const takeExtra = limitNum + 1;
  const skipGeo = !scope_level || SCOPE_LEVEL_SKIP_GEO.has(scope_level);

  const idColumn = type === 'biz' ? 'biz_post_id' : 'post_id';
  const ownerColumn = type === 'biz' ? 'sponsor_id' : 'user_id';
  const interactionTable = type === 'biz' ? 'biz_post_interactions' : 'soc_post_interactions';
  const interactionFkColumn = type === 'biz' ? 'biz_post_id' : 'post_id';

  const cursorObj = _decodeCursor(cursor);
  const cursorWhere = cursorObj
    ? `AND (p.created_at < @cursorCreatedAt
          OR (p.created_at = @cursorCreatedAt AND p.${idColumn} < @cursorPostId))`
    : '';

  const orderClause = popular
    ? `ORDER BY p.engagement_score DESC, p.created_at DESC, p.${idColumn} DESC`
    : `ORDER BY p.created_at DESC, p.${idColumn} DESC`;

  let geoWhere = '';
  let needsCityCode = false;
  let needsZoneCode = false;

  if (!skipGeo) {
    if (scope_level === 'ciudad' && city_code && String(city_code).trim()) {
      geoWhere = 'AND p.city_code = @cityCode';
      needsCityCode = true;
    } else if (scope_level === 'zona' && zone_code && String(zone_code).trim()) {
      geoWhere = 'AND p.zone_code = @zoneCode';
      needsZoneCode = true;
    }
  }

  const hasOwnerFilter = !!(user_id && String(user_id).trim());
  const hasIdFilter = !!(biz_post_id && String(biz_post_id).trim());
  const ownerWhere = hasOwnerFilter ? `AND p.${ownerColumn} = @ownerId` : '';
  const idWhere = hasIdFilter ? `AND p.${idColumn} = @postId` : '';

  const hasLikedSelect = userId
    ? `, CASE WHEN EXISTS (
        SELECT 1 FROM antojados_core.${interactionTable} i
        WHERE i.${interactionFkColumn} = p.${idColumn}
          AND i.user_id = @userIdForLike
          AND i.interaction_type = 'like_created'
      ) THEN 1 ELSE 0 END AS has_liked`
    : ', 0 AS has_liked';

  const authorSelect = type === 'soc'
    ? `, ai.display_name AS author_display_name, ai.avatar_url AS author_avatar_url`
    : '';

  const authorJoin = type === 'soc'
    ? `LEFT JOIN antojados_core.auth_identities ai ON ai.user_id = p.user_id`
    : '';

  const selectColumns = `
    p.${idColumn} AS id,
    @type AS type,
    p.channel,
    p.${ownerColumn} AS owner_id,
    p.media_url,
    p.doc_json,
    p.views_count,
    p.likes_count,
    p.comments_count,
    p.shares_count,
    p.engagement_score,
    p.status,
    p.created_at
    ${hasLikedSelect}
    ${authorSelect}
  `;

  const bizExtra = type === 'biz'
    ? ', p.cta_clicks_count, p.taps_whatsapp_count, p.taps_maps_count'
    : '';

  const channelPlaceholders = channels.map((_, i) => `@ch${i}`).join(', ');
  const query = `
    SELECT TOP (@limit) ${selectColumns} ${bizExtra}
    FROM antojados_core.${scopeConfig.table} p
    ${authorJoin}
    WHERE p.channel IN (${channelPlaceholders})
      AND p.status = 'active'
      AND p.media_url IS NOT NULL
      AND p.media_url != ''
      ${geoWhere}
      ${ownerWhere}
      ${idWhere}
      ${cursorWhere}
    ${orderClause}
  `;

  const request = (await getPool('antojados')).request()
    .input('limit', sql.Int, takeExtra)
    .input('type', sql.NVarChar(10), type);

  if (cursorObj) {
    request.input('cursorCreatedAt', sql.DateTime2(3), cursorObj.created_at);
    request.input('cursorPostId', sql.NVarChar(64), cursorObj.post_id);
  }

  if (needsCityCode) {
    request.input('cityCode', sql.NVarChar(20), city_code);
  }

  if (needsZoneCode) {
    request.input('zoneCode', sql.NVarChar(20), zone_code);
  }

  if (userId) {
    request.input('userIdForLike', sql.NVarChar(64), userId);
  }

  if (hasOwnerFilter) {
    request.input('ownerId', sql.NVarChar(64), user_id);
  }

  if (hasIdFilter) {
    request.input('postId', sql.NVarChar(64), biz_post_id);
  }

  channels.forEach((ch, i) => {
    request.input(`ch${i}`, sql.NVarChar(30), ch);
  });

  const result = await request.query(query);
  const rows = result.recordset;

  const hasMore = rows.length > limitNum;
  const data = hasMore ? rows.slice(0, limitNum) : rows;

  const nextCursor = data.length > 0
    ? _encodeCursor({ created_at: data[data.length - 1].created_at, post_id: data[data.length - 1].id })
    : null;

  return {
    data,
    cursor: {
      next: nextCursor,
      prev: cursor || null,
    },
    meta: {
      scope_level: scope_level || 'ciudad',
      city_code: city_code || null,
      zone_code: zone_code || null,
      feed_scope,
      has_more: hasMore,
      geo_filter_applied: needsCityCode || needsZoneCode,
    },
  };
}

async function getFeedWithMedia(params) {
  const feed = await getFeed(params);
  if (feed.data.length === 0) return feed;

  const scopeConfig = FEED_SCOPE_MAP[params.feed_scope];
  const type = scopeConfig.type;
  const mediaTable = type === 'biz' ? 'biz_post_media' : 'soc_post_media';
  const postIdColumn = 'post_id';

  const pool = await getPool('antojados');
  const postIds = feed.data.map(p => p.id);

  if (postIds.length === 0) return feed;

  const mediaQuery = `
    SELECT m.media_id, m.media_type, m.media_url, m.sort_order,
           m.thumb_url, m.feed_url, m.full_url, m.asset_id,
           m.${postIdColumn} AS post_id
    FROM antojados_core.${mediaTable} m
    WHERE m.${postIdColumn} IN (${postIds.map((_, i) => `@id${i}`).join(',')})
    ORDER BY m.sort_order ASC
  `;

  const mediaReq = pool.request();
  postIds.forEach((id, i) => {
    mediaReq.input(`id${i}`, sql.NVarChar(64), id);
  });
  const mediaResult = await mediaReq.query(mediaQuery);

  const mediaByPost = {};
  for (const m of mediaResult.recordset) {
    if (!mediaByPost[m.post_id]) mediaByPost[m.post_id] = [];
    mediaByPost[m.post_id].push({
      media_id: m.media_id,
      media_type: m.media_type,
      media_url: m.media_url,
      sort_order: m.sort_order,
      thumb_url: m.thumb_url,
      feed_url: m.feed_url,
      full_url: m.full_url,
      asset_id: m.asset_id,
    });
  }

  feed.data = feed.data.map(post => {
    const enriched = { ...post, media: mediaByPost[post.id] || [] };

    if (post.type === 'soc') {
      enriched.author = {
        user_id: post.owner_id,
        display_name: post.author_display_name || null,
        avatar_url: post.author_avatar_url || null,
      };
      delete enriched.author_display_name;
      delete enriched.author_avatar_url;
    }

    return enriched;
  });

  return feed;
}

function _validateFeedScope(feed_scope) {
  if (!feed_scope || !FEED_SCOPE_MAP[feed_scope]) {
    const valid = FEED_SCOPES.join(', ');
    throw new Error(`feedService: feed_scope '${feed_scope}' no valido. Valores: ${valid}`);
  }
}

function _decodeCursor(cursor) {
  if (!cursor || cursor === 'null') return null;
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    if (parsed.created_at && parsed.post_id) {
      return {
        created_at: new Date(parsed.created_at),
        post_id: String(parsed.post_id),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function _encodeCursor({ created_at, post_id }) {
  if (!created_at || !post_id) return null;
  const dateStr = created_at instanceof Date ? created_at.toISOString() : String(created_at);
  const json = JSON.stringify({ created_at: dateStr, post_id: String(post_id) });
  return Buffer.from(json, 'utf-8').toString('base64');
}

module.exports = {
  getFeed,
  getFeedWithMedia,
  FEED_SCOPE_MAP,
  FEED_SCOPES,
};
