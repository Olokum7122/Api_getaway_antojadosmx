SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;

USE ATLX_GT_ANALYTICS;

DECLARE @sp NVARCHAR(MAX) = N'
CREATE OR ALTER PROCEDURE gt_antojados.usp_api_engagement_v2
  @place_id     NVARCHAR(64) = NULL,
  @scope_level  NVARCHAR(20) = NULL,
  @scope_code   NVARCHAR(64) = NULL,
  @city_code    NVARCHAR(30) = NULL,
  @year         SMALLINT = NULL,
  @month        TINYINT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  SELECT period_year, period_month, place_id, city_code, zone_code, scope_level, scope_code, category,
         post_count, visit_verified_count AS verified_visit_count, unique_users,
         likes_total, comments_total, shares_total,
         avg_rating, avg_engagement_score, trend_score, materialized_at
  FROM gt_antojados.food_engagement_pmonth
  WHERE (@place_id IS NULL OR place_id = @place_id)
    AND (@year IS NULL OR period_year = @year)
    AND (@month IS NULL OR period_month = @month)
    AND (
      @scope_level IS NULL
      OR @scope_level = N''global''
      OR @scope_level = N''mexico''
      OR (@scope_level = N''ciudad'' AND city_code = @scope_code)
      OR (@scope_level = N''tu_zona'' AND COALESCE(zone_code, city_code) = @scope_code)
    )
    AND (
      @scope_level IS NOT NULL
      OR @city_code IS NULL
      OR city_code = @city_code
    )
  ORDER BY period_year DESC, period_month DESC, trend_score DESC;
END;
';
EXEC sp_executesql @sp;

SET @sp = N'
CREATE OR ALTER PROCEDURE gt_antojados.usp_api_place_scores_v2
  @scope_level NVARCHAR(20) = NULL,
  @scope_code  NVARCHAR(64) = NULL,
  @city_code   NVARCHAR(30) = NULL,
  @year        SMALLINT = NULL,
  @month       TINYINT = NULL,
  @category    NVARCHAR(80) = NULL,
  @limit       INT = 20
AS
BEGIN
  SET NOCOUNT ON;

  SELECT TOP (@limit)
         place_id, city_code, zone_code, scope_level, scope_code, category, score, score_delta_pct,
         rank_in_city, rank_in_category, period_year, period_month
  FROM gt_antojados.food_place_score_pmonth
  WHERE (@year IS NULL OR period_year = @year)
    AND (@month IS NULL OR period_month = @month)
    AND (@category IS NULL OR category = @category)
    AND (
      @scope_level IS NULL
      OR @scope_level = N''global''
      OR @scope_level = N''mexico''
      OR (@scope_level = N''ciudad'' AND city_code = @scope_code)
      OR (@scope_level = N''tu_zona'' AND COALESCE(zone_code, city_code) = @scope_code)
    )
    AND (
      @scope_level IS NOT NULL
      OR @city_code IS NULL
      OR city_code = @city_code
    )
  ORDER BY rank_in_city ASC, score DESC;
END;
';
EXEC sp_executesql @sp;

SET @sp = N'
CREATE OR ALTER PROCEDURE gt_antojados.usp_api_tenant_summary_v2
  @tenant_instance_id NVARCHAR(64) = NULL,
  @place_id           NVARCHAR(64) = NULL,
  @scope_level        NVARCHAR(20) = NULL,
  @scope_code         NVARCHAR(64) = NULL,
  @city_code          NVARCHAR(30) = NULL,
  @category           NVARCHAR(80) = NULL,
  @year               SMALLINT = NULL,
  @month              TINYINT = NULL,
  @limit              INT = 20
AS
BEGIN
  SET NOCOUNT ON;

  SELECT TOP (@limit)
         tenant_instance_id, place_id, city_code, zone_code, scope_level, scope_code, category, period_year, period_month,
         place_score, score_delta_pct, rank_in_city, rank_in_category,
         post_count, likes_total, comments_total, shares_total,
         verified_visit_count, avg_engagement_score, trend_score,
         tile_views, tile_clicks, tile_follows, tile_ctr, tile_follow_rate
  FROM gt_antojados.analytics_antojados_tenant_summary
  WHERE (@tenant_instance_id IS NULL OR tenant_instance_id = @tenant_instance_id)
    AND (@place_id IS NULL OR place_id = @place_id)
    AND (@category IS NULL OR category = @category)
    AND (@year IS NULL OR period_year = @year)
    AND (@month IS NULL OR period_month = @month)
    AND (
      @scope_level IS NULL
      OR @scope_level = N''global''
      OR @scope_level = N''mexico''
      OR (@scope_level = N''ciudad'' AND city_code = @scope_code)
      OR (@scope_level = N''tu_zona'' AND COALESCE(zone_code, city_code) = @scope_code)
    )
    AND (
      @scope_level IS NOT NULL
      OR @city_code IS NULL
      OR city_code = @city_code
    )
  ORDER BY period_year DESC, period_month DESC, rank_in_city ASC, place_score DESC;
END;
';
EXEC sp_executesql @sp;

SET @sp = N'
CREATE OR ALTER PROCEDURE gt_antojados.usp_api_sponsor_metrics_v2
  @tenant_instance_id NVARCHAR(64) = NULL,
  @place_id           NVARCHAR(64) = NULL,
  @scope_level        NVARCHAR(20) = NULL,
  @scope_code         NVARCHAR(64) = NULL,
  @city_code          NVARCHAR(30) = NULL,
  @category           NVARCHAR(80) = NULL,
  @post_type          NVARCHAR(40) = NULL,
  @year               SMALLINT = NULL,
  @month              TINYINT = NULL,
  @limit              INT = 20
AS
BEGIN
  SET NOCOUNT ON;

  SELECT TOP (@limit)
         b.tenant_instance_id, b.place_id, b.city_code, b.zone_code, b.scope_level, b.scope_code, b.category, b.post_type,
         b.period_year, b.period_month,
         b.biz_post_count, b.impressions_total,
         b.likes_total, b.comments_total, b.shares_total,
         b.cta_clicks_total, b.profile_visits_total,
         b.whatsapp_taps_total, b.maps_taps_total, b.calls_total,
         b.avg_engagement_score,
         t.tile_views, t.tile_clicks, t.tile_follows, t.tile_ctr, t.tile_follow_rate
  FROM gt_antojados.food_biz_post_engagement_pmonth b
  LEFT JOIN gt_antojados.analytics_antojados_tenant_summary t
    ON t.tenant_instance_id = b.tenant_instance_id
   AND t.place_id = b.place_id
   AND t.period_year = b.period_year
   AND t.period_month = b.period_month
   AND t.category = b.category
  WHERE (@tenant_instance_id IS NULL OR b.tenant_instance_id = @tenant_instance_id)
    AND (@place_id IS NULL OR b.place_id = @place_id)
    AND (@category IS NULL OR b.category = @category)
    AND (@post_type IS NULL OR b.post_type = @post_type)
    AND (@year IS NULL OR b.period_year = @year)
    AND (@month IS NULL OR b.period_month = @month)
    AND (
      @scope_level IS NULL
      OR @scope_level = N''global''
      OR @scope_level = N''mexico''
      OR (@scope_level = N''ciudad'' AND b.city_code = @scope_code)
      OR (@scope_level = N''tu_zona'' AND COALESCE(b.zone_code, b.city_code) = @scope_code)
    )
    AND (
      @scope_level IS NOT NULL
      OR @city_code IS NULL
      OR b.city_code = @city_code
    )
  ORDER BY b.period_year DESC, b.period_month DESC, b.impressions_total DESC, b.place_id ASC;
END;
';
EXEC sp_executesql @sp;
