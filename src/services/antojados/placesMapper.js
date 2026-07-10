'use strict';
/**
 * placesMapper.js — Mappers de Lugares (soc_places)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DOMINIO:      AntojadosMX — Lugares y Rankings Sociales
 * RESPONSABLE:  Transformar/validar datos de soc_places, soc_posts
 *               y ratings antes de exponerlos al service layer.
 *
 * NO HACE:
 *   - No consulta BD (lo hacen los resolvers)
 *   - No contiene lógica de negocio (solo transformación)
 *
 * MAPEADORES:
 *   mapPlaceRow           → info básica de lugar (list)
 *   mapPlaceDetail        → info detallada de lugar (perfil)
 *   mapPlaceList          → array de mapPlaceRow
 *   mapPlacePosts         → array de posts en lugar
 *   mapPlaceRatingsSummary → resumen de calificaciones
 *
 * REFERENCIAS:
 *   - apps-antojados/docs/feed.md
 *   - placesResolver.js, places.service.js
 * ══════════════════════════════════════════════════════════════════════════════
 */

function mapPlaceRow(raw) {
  if (!raw?.id) {
    throw new Error(`placesMapper.mapPlaceRow: id faltante — ${JSON.stringify(raw)}`);
  }
  return {
    placeId: raw.id,
    name: raw.name,
    category: raw.category,
    cityCode: raw.city_code,
    address: raw.address ?? null,
    lat: raw.lat ?? null,
    lng: raw.lng ?? null,
    avgRating: raw.avg_rating ?? null,
    postCount: raw.post_count ?? null,
    verified: raw.verified ?? null,
  };
}

function mapPlaceDetail(raw) {
  if (!raw?.id) {
    throw new Error(`placesMapper.mapPlaceDetail: id faltante — ${JSON.stringify(raw)}`);
  }
  return {
    placeId: raw.id,
    name: raw.name,
    category: raw.category,
    cityCode: raw.city_code,
    address: raw.address ?? null,
    phone: raw.phone ?? null,
    website: raw.website ?? null,
    whatsapp: raw.whatsapp ?? null,
    hoursJson: raw.hours_json ?? null,
    description: raw.description ?? null,
    instagramHandle: raw.instagram_handle ?? null,
    facebookUrl: raw.facebook_url ?? null,
    priceRange: raw.price_range ?? null,
    planType: raw.plan_type ?? null,
    lat: raw.lat ?? null,
    lng: raw.lng ?? null,
    avgRating: raw.avg_rating ?? null,
    postCount: raw.post_count ?? null,
    verified: raw.verified ?? null,
    status: raw.status ?? null,
    createdByUserId: raw.created_by_user_id ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    rankScore: raw.rank_score ?? null,
    rankPosition: raw.rank_position ?? null,
    verifiedVisitCount: raw.verified_visit_count ?? null,
    sponsored: raw.sponsored ?? null,
    rankComputedAt: raw.rank_computed_at ?? null,
    followerCount: raw.follower_count ?? null,
    saveCount: raw.save_count ?? null,
    activeBizPostCount: raw.active_biz_post_count ?? null,
  };
}

function mapPlaceList(rows) {
  if (!Array.isArray(rows)) {
    throw new Error(`placesMapper.mapPlaceList: se esperaba array — ${typeof rows}`);
  }
  return rows.map(mapPlaceRow);
}

function mapPlacePosts(rows) {
  if (!Array.isArray(rows)) {
    throw new Error(`placesMapper.mapPlacePosts: se esperaba array — ${typeof rows}`);
  }
  return rows.map((raw) => {
    if (!raw?.post_id) {
      throw new Error(`placesMapper.mapPlacePosts: post_id faltante — ${JSON.stringify(raw)}`);
    }
    return {
      postId: raw.post_id,
      userId: raw.user_id ?? null,
      venueName: raw.business_name ?? null,
      category: raw.category ?? null,
      dishName: raw.dish_name ?? null,
      mediaType: raw.media_type ?? null,
      mediaUrl: raw.media_url ?? null,
      mediaThumbnailUrl: raw.media_thumbnail_url ?? null,
      likesCount: raw.likes_count ?? null,
      commentsCount: raw.comments_count ?? null,
      avgRating: raw.avg_rating ?? null,
      publishedAt: raw.published_at ?? null,
      displayName: raw.display_name ?? null,
      avatarUrl: raw.avatar_url ?? null,
    };
  });
}

function mapPlaceRatingsSummary(raw) {
  if (raw == null) return null;
  return {
    avgTaste: raw.avg_taste ?? null,
    avgPrice: raw.avg_price ?? null,
    avgService: raw.avg_service ?? null,
    avgCleanliness: raw.avg_cleanliness ?? null,
    avgAmbience: raw.avg_ambience ?? null,
    avgWaitTime: raw.avg_wait_time ?? null,
    totalRatings: raw.total_ratings ?? null,
  };
}

module.exports = {
  mapPlaceRow,
  mapPlaceDetail,
  mapPlaceList,
  mapPlacePosts,
  mapPlaceRatingsSummary,
};