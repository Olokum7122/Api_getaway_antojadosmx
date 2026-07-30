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
  owner_id,
  sponsor_id,
  biz_post_id,
  feed_type,
} = {}) {
  _validateFeedScope(feed_scope);

  const scopeConfig = FEED_SCOPE_MAP[feed_scope];
  const type = scopeConfig.type;
  const channels = scopeConfig.channels;
  const limitNum = Math.min(Math.max(1, limit || DEFAULT_LIMIT), MAX_LIMIT);
  const takeExtra = limitNum + 1;

  // Usar el primer canal para el SP (el SP maneja internamente channel IN para pachanga)
  const channel = channels[0];

  const cursorObj = _decodeCursor(cursor);
  const normalizedCityCode = scope_level === 'ciudad' ? await _resolveCityCode(city_code) : city_code;
  const normalizedZoneCode = scope_level === 'zona' ? await _resolveZoneCode(zone_code) : zone_code;
  const ownerId = owner_id || sponsor_id || user_id;

  const rows = scope_level === 'zona' && normalizedZoneCode
    ? await _fetchZoneFeedRows({ channel, takeExtra, zone_code: normalizedZoneCode, cursorObj, userId, ownerId, biz_post_id, popular })
    : await _fetchFeedRows({ channel, takeExtra, scope_level: scope_level || 'mexico', city_code: normalizedCityCode, zone_code: normalizedZoneCode, cursorObj, userId, ownerId, biz_post_id, popular });

  const hasMore = rows.length > limitNum;
  const data = hasMore ? rows.slice(0, limitNum) : rows;

  const nextCursor = data.length > 0
    ? _encodeCursor({ created_at: data[data.length - 1].created_at, post_id: data[data.length - 1].id })
    : null;

  const geoFilterApplied = !!(normalizedCityCode || normalizedZoneCode);

  return {
    data,
    cursor: {
      next: nextCursor,
      prev: cursor || null,
    },
    meta: {
      scope_level: scope_level || 'ciudad',
      city_code: normalizedCityCode || null,
      zone_code: normalizedZoneCode || null,
      feed_scope,
      has_more: hasMore,
      geo_filter_applied: geoFilterApplied,
    },
  };
}

async function _fetchZoneFeedRows({ channel, takeExtra, zone_code, cursorObj, userId, ownerId, biz_post_id, popular }) {
  const cityCodes = await _listCityCodesForZone(zone_code);
  if (!cityCodes.length) {
    return _fetchFeedRows({ channel, takeExtra, scope_level: 'zona', zone_code, cursorObj, userId, ownerId, biz_post_id, popular });
  }

  const rowsByCity = await Promise.all(cityCodes.map((city_code) => _fetchFeedRows({
    channel,
    takeExtra,
    scope_level: 'ciudad',
    city_code,
    zone_code: null,
    cursorObj,
    userId,
    ownerId,
    biz_post_id,
    popular,
  })));

  const uniqueRows = new Map();
  for (const row of rowsByCity.flat()) {
    if (row?.id && !uniqueRows.has(row.id)) uniqueRows.set(row.id, row);
  }

  return Array.from(uniqueRows.values()).sort((left, right) => {
    if (popular) {
      const scoreDiff = Number(right.engagement_score || 0) - Number(left.engagement_score || 0);
      if (scoreDiff) return scoreDiff;
    }
    const rightDate = right.created_at ? new Date(right.created_at).getTime() : 0;
    const leftDate = left.created_at ? new Date(left.created_at).getTime() : 0;
    if (rightDate !== leftDate) return rightDate - leftDate;
    return String(right.id || '').localeCompare(String(left.id || ''));
  }).slice(0, takeExtra);
}

async function _fetchFeedRows({ channel, takeExtra, scope_level, city_code, zone_code, cursorObj, userId, ownerId, biz_post_id, popular }) {
  const req = (await getPool('antojados')).request()
    .input('channel', sql.NVarChar(30), channel)
    .input('limit', sql.Int, takeExtra)
    .input('scope_level', sql.NVarChar(20), scope_level || 'mexico');

  if (city_code) req.input('city_code', sql.NVarChar(60), city_code);
  if (zone_code) req.input('zone_code', sql.NVarChar(60), zone_code);

  if (cursorObj) {
    req.input('cursor_created_at', sql.DateTime2(3), cursorObj.created_at);
    req.input('cursor_post_id', sql.NVarChar(64), cursorObj.post_id);
  }

  if (userId) req.input('user_id', sql.NVarChar(64), userId);
  if (ownerId) req.input('owner_id', sql.NVarChar(64), ownerId);
  if (biz_post_id) req.input('post_id', sql.NVarChar(64), biz_post_id);
  if (popular) req.input('popular', sql.Bit, 1);

  const result = await req.execute('antojados_core.feed_get_feed');
  return result.recordset;
}

async function _listCityCodesForZone(zoneCode) {
  const normalized = String(zoneCode || '').trim();
  if (!normalized) return [];

  const result = await getPool('antojados').request()
    .input('zoneCode', sql.NVarChar(64), normalized)
    .query(`
      SELECT DISTINCT city_code
      FROM antojados_core.geo_scope_detection_map
      WHERE status = 'active'
        AND (zone_code = @zoneCode OR zone_scope_code = @zoneCode)
        AND city_code IS NOT NULL
      ORDER BY city_code ASC
    `);

  return result.recordset.map((row) => row.city_code).filter(Boolean);
}

async function _resolveCityCode(cityCode) {
  const normalized = String(cityCode || '').trim();
  if (!normalized) return null;

  const result = await getPool('antojados').request()
    .input('cityCode', sql.NVarChar(64), normalized)
    .query(`
      SELECT TOP 1 city_code
      FROM antojados_core.geo_scope_detection_map
      WHERE status = 'active'
        AND (city_code = @cityCode OR city_scope_code = @cityCode)
      ORDER BY priority DESC, updated_at DESC
    `);

  return result.recordset[0]?.city_code || normalized;
}

async function _resolveZoneCode(zoneCode) {
  const normalized = String(zoneCode || '').trim();
  if (!normalized) return null;

  const result = await getPool('antojados').request()
    .input('zoneCode', sql.NVarChar(64), normalized)
    .query(`
      SELECT TOP 1 zone_code
      FROM antojados_core.geo_scope_detection_map
      WHERE status = 'active'
        AND (zone_code = @zoneCode OR zone_scope_code = @zoneCode)
      ORDER BY priority DESC, updated_at DESC
    `);

  return result.recordset[0]?.zone_code || normalized;
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
