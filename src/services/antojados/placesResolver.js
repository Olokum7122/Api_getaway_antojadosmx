'use strict';
/**
 * placesResolver.js — Resolver de Lugares (soc_places)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Lugares y Rankings Sociales
 * RESPONSABLE:  CRUD de soc_places, consulta de posts por lugar,
 *               resumen de calificaciones (soc_post_ratings).
 *
 * NO HACE:
 *   - No escribe en soc_posts (lo hace postsResolver)
 *   - No maneja geografía/contexto (lo hace geoResolver)
 *   - No maneja rewards/cupones (lo hace rewardsResolver)
 *
 * TABLAS QUE TOCA:
 *   antojados_core.soc_places        → CRUD de lugares
 *   antojados_core.soc_posts         → consulta de posts por lugar
 *   antojados_core.soc_post_ratings  → resumen de calificaciones
 *   antojados_core.auth_identities   → JOIN para autor info
 *
 * REFERENCIAS:
 *   - antojadosmx/docs/feed.md
 *   - placesMapper.js, places.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

const { getPool, sql, _emitEvent } = require('./_shared');

async function listPlaces({ city_code, category, limit, offset }) {
  const req = getPool('antojados').request()
    .input('cityCode', sql.NVarChar(30), city_code || null)
    .input('category', sql.NVarChar(80), category || null)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset);
  const result = await req.query(`
    SELECT p.id, p.name, p.category, p.city_code, p.address,
           p.lat, p.lng, p.avg_rating, p.post_count, p.verified
    FROM antojados_core.soc_places p
    WHERE p.status = 'active'
      AND (@cityCode IS NULL OR p.city_code = @cityCode)
      AND (@category IS NULL OR p.category = @category)
    ORDER BY p.post_count DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);
  return result.recordset;
}

async function getPlace(id, user_id = null) {
  const result = await getPool('antojados').request()
    .input('placeId', sql.NVarChar(64), id)
    .query(`
      SELECT id, name, category, city_code, address, phone, website,
             whatsapp, hours_json, description, instagram_handle, facebook_url,
             price_range, plan_type, lat, lng, avg_rating, post_count, verified,
             status, created_by_user_id, created_at, updated_at,
             rank_score, rank_position, verified_visit_count, sponsored, rank_computed_at,
             follower_count, save_count, active_biz_post_count
      FROM antojados_core.vw_place_full
      WHERE id = @placeId
    `);
  const row = result.recordset[0] || null;
  if (row && user_id) {
    _emitEvent({ user_id, id: row.id, event_type: 'place_viewed' });
  }
  return row;
}

async function createPlace({ id, name, category, city_code, lat, lng,
                              address, phone, website, created_by_user_id,
                              whatsapp, hours_json, description,
                              instagram_handle, facebook_url, price_range,
                              plan_type }) {
  await getPool('antojados').request()
    .input('placeId',         sql.NVarChar(64),       id)
    .input('name',            sql.NVarChar(200),      name)
    .input('category',        sql.NVarChar(80),       category)
    .input('cityCode',        sql.NVarChar(30),       city_code)
    .input('lat',             sql.Float,              lat)
    .input('lng',             sql.Float,              lng)
    .input('address',         sql.NVarChar(300),      address || null)
    .input('phone',           sql.NVarChar(30),       phone || null)
    .input('website',         sql.NVarChar(300),      website || null)
    .input('createdByUserId', sql.NVarChar(64),       created_by_user_id || null)
    .input('whatsapp',        sql.NVarChar(30),       whatsapp || null)
    .input('hoursJson',       sql.NVarChar(sql.MAX),  hours_json || null)
    .input('description',     sql.NVarChar(1000),     description || null)
    .input('instagramHandle', sql.NVarChar(100),      instagram_handle || null)
    .input('facebookUrl',     sql.NVarChar(300),      facebook_url || null)
    .input('priceRange',      sql.TinyInt,            price_range != null ? (parseInt(price_range, 10) || null) : null)
    .input('planType',        sql.NVarChar(30),       plan_type || 'organic')
    .query(`
      IF NOT EXISTS (SELECT 1 FROM antojados_core.soc_places WHERE id = @placeId)
        INSERT INTO antojados_core.soc_places
          (id, name, category, city_code, lat, lng,
           address, phone, website, created_by_user_id, verified, status,
           whatsapp, hours_json, description, instagram_handle, facebook_url,
           price_range, plan_type)
        VALUES
          (@placeId, @name, @category, @cityCode, @lat, @lng,
           @address, @phone, @website, @createdByUserId, 0, 'active',
           @whatsapp, @hoursJson, @description, @instagramHandle, @facebookUrl,
           @priceRange, @planType)
    `);
}

async function updatePlace(id, {
  name, category, city_code, lat, lng, address, phone, website,
  whatsapp, hours_json, description, instagram_handle, facebook_url,
  price_range, plan_type, verified, status,
}) {
  await getPool('antojados').request()
    .input('placeId',         sql.NVarChar(64),      id)
    .input('name',            sql.NVarChar(200),     name ?? null)
    .input('category',        sql.NVarChar(80),      category ?? null)
    .input('cityCode',        sql.NVarChar(30),      city_code ?? null)
    .input('lat',             sql.Float,             lat ?? null)
    .input('lng',             sql.Float,             lng ?? null)
    .input('address',         sql.NVarChar(300),     address ?? null)
    .input('phone',           sql.NVarChar(30),      phone ?? null)
    .input('website',         sql.NVarChar(300),     website ?? null)
    .input('whatsapp',        sql.NVarChar(30),      whatsapp ?? null)
    .input('hoursJson',       sql.NVarChar(sql.MAX), hours_json ?? null)
    .input('description',     sql.NVarChar(1000),    description ?? null)
    .input('instagramHandle', sql.NVarChar(100),     instagram_handle ?? null)
    .input('facebookUrl',     sql.NVarChar(300),     facebook_url ?? null)
    .input('priceRange',      sql.TinyInt,           price_range != null ? (parseInt(price_range, 10) || null) : null)
    .input('planType',        sql.NVarChar(30),      plan_type ?? null)
    .input('verified',        sql.Bit,               verified != null ? (verified ? 1 : 0) : null)
    .input('status',          sql.NVarChar(20),      status ?? null)
    .query(`
      UPDATE antojados_core.soc_places
      SET name             = COALESCE(@name, name),
          category         = COALESCE(@category, category),
          city_code        = COALESCE(@cityCode, city_code),
          lat              = COALESCE(@lat, lat),
          lng              = COALESCE(@lng, lng),
          address          = COALESCE(@address, address),
          phone            = COALESCE(@phone, phone),
          website          = COALESCE(@website, website),
          whatsapp         = COALESCE(@whatsapp, whatsapp),
          hours_json       = COALESCE(@hoursJson, hours_json),
          description      = COALESCE(@description, description),
          instagram_handle = COALESCE(@instagramHandle, instagram_handle),
          facebook_url     = COALESCE(@facebookUrl, facebook_url),
          price_range      = COALESCE(@priceRange, price_range),
          plan_type        = COALESCE(@planType, plan_type),
          verified         = COALESCE(@verified, verified),
          status           = COALESCE(@status, status),
          updated_at       = SYSUTCDATETIME()
      WHERE id = @placeId
        AND (
          @name IS NOT NULL OR @category IS NOT NULL OR @cityCode IS NOT NULL OR
          @lat IS NOT NULL OR @lng IS NOT NULL OR @address IS NOT NULL OR @phone IS NOT NULL OR
          @website IS NOT NULL OR @whatsapp IS NOT NULL OR @hoursJson IS NOT NULL OR
          @description IS NOT NULL OR @instagramHandle IS NOT NULL OR @facebookUrl IS NOT NULL OR
          @priceRange IS NOT NULL OR @planType IS NOT NULL OR @verified IS NOT NULL OR @status IS NOT NULL
        )
    `);
}

async function getPlacePosts(id, { limit, offset }) {
  const result = await getPool('antojados').request()
    .input('placeId', sql.NVarChar(64), id)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT p.post_id, p.user_id, p.business_name, p.category, p.dish_name,
             p.media_type, p.media_url, p.media_thumbnail_url,
             p.likes_count, p.comments_count, p.avg_rating, p.published_at,
             ai.display_name, ai.avatar_url
      FROM antojados_core.soc_posts p
      JOIN antojados_core.auth_identities ai ON ai.user_id = p.user_id
      WHERE p.id = @PlaceId AND p.post_status = 'active'
      ORDER BY p.published_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  return result.recordset;
}

async function getPlaceByPublisher(user_id) {
  const result = await getPool('antojados').request()
    .input('publisherUserId', sql.NVarChar(64), user_id)
    .query(`
      SELECT TOP 1 p.id, p.name, p.category, p.city_code, p.address,
             p.lat, p.lng, p.avg_rating, p.post_count, p.verified
      FROM antojados_core.soc_places p
      WHERE p.created_by_user_id = @publisherUserId
        AND p.status = 'active'
      ORDER BY p.created_at DESC
    `);
  return result.recordset[0] || null;
}

async function getPlaceRatingsSummary(id) {
  const result = await getPool('antojados').request()
    .input('placeId', sql.NVarChar(64), id)
    .query(`
      SELECT
        ROUND(AVG(CAST(r.taste AS FLOAT)), 2) AS avg_taste,
        ROUND(AVG(CAST(r.price AS FLOAT)), 2) AS avg_price,
        ROUND(AVG(CAST(r.service AS FLOAT)), 2) AS avg_service,
        ROUND(AVG(CAST(r.cleanliness AS FLOAT)), 2) AS avg_cleanliness,
        ROUND(AVG(CAST(r.ambience AS FLOAT)), 2) AS avg_ambience,
        ROUND(AVG(CAST(r.wait_time AS FLOAT)), 2) AS avg_wait_time,
        COUNT(*) AS total_ratings
      FROM antojados_core.soc_post_ratings r
      JOIN antojados_core.soc_posts p ON p.post_id = r.post_id
      WHERE p.id = @placeId
        AND p.post_status = 'active'
    `);
  const row = result.recordset[0];
  if (!row || row.total_ratings === 0) return null;
  return row;
}

module.exports = {
  listPlaces,
  getPlace,
  createPlace,
  updatePlace,
  getPlacePosts,
  getPlaceRatingsSummary,
  getPlaceByPublisher,
};
