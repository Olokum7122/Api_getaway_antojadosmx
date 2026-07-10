SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
-- =============================================================================
-- sp-analytics-views.sql
-- Ejecutar contra: ATLX_GT_ANALYTICS
-- sqlcmd -S 185.187.235.253 -U sa -P "..." -C -d ATLX_GT_ANALYTICS
--        -i sp-analytics-views.sql
-- Idempotente: usa CREATE OR ALTER VIEW (SQL Server 2016+).
-- Vistas operacionales del panel GT (Tab 4 Entregables + Tab 3 Metricas).
-- Fuentes: tablas materializadas por §5 (food_*_pmonth, food_territorial_activity,
--          food_nightlife_activity, food_tile_performance_pmonth).
-- §5.10
-- =============================================================================
USE ATLX_GT_ANALYTICS;
SET NOCOUNT ON;
-- =============================================================================
-- analytics_antojados_tenant_summary
-- Resumen ejecutivo por negocio — pkg_rendimiento
-- Fuente: food_place_score_pmonth + food_engagement_pmonth + food_tile_performance_pmonth
-- =============================================================================
DECLARE @v NVARCHAR(MAX) = N'';
SET @v = N'
CREATE OR ALTER VIEW gt_antojados.analytics_antojados_tenant_summary AS
SELECT
    inst.tenant_instance_id,
    ps.place_id,
    ps.city_code,
    ps.zone_code,
    ps.scope_level,
    ps.scope_code,
    ps.category,
    ps.period_year,
    ps.period_month,
    ps.score                AS place_score,
    ps.score_delta_pct,
    ps.rank_in_city,
    ps.rank_in_category,
    e.post_count,
    e.likes_total,
    e.comments_total,
    e.shares_total,
    e.visit_verified_count  AS verified_visit_count,
    e.avg_engagement_score,
    e.trend_score,
    tp.views_count          AS tile_views,
    tp.clicks_count         AS tile_clicks,
    tp.follows_count        AS tile_follows,
    tp.ctr                  AS tile_ctr,
    tp.follow_rate          AS tile_follow_rate
FROM gt_antojados.food_place_score_pmonth ps
OUTER APPLY (
    SELECT TOP 1
        btu.instance_id AS tenant_instance_id
    FROM [ATLX_ANTOJADOS_APP].antojados_core.biz_posts bp
    INNER JOIN [ATLX_ANTOJADOS_APP].antojados_core.biz_tenant_users btu
        ON btu.user_id = bp.publisher_user_id
       AND btu.status = N''active''
    WHERE bp.place_id = ps.place_id
    ORDER BY bp.created_at DESC
) inst
LEFT JOIN gt_antojados.food_engagement_pmonth e
    ON  e.place_id     = ps.place_id
    AND e.city_code    = ps.city_code
    AND e.category     = ps.category
    AND e.period_year  = ps.period_year
    AND e.period_month = ps.period_month
LEFT JOIN gt_antojados.food_tile_performance_pmonth tp
    ON  tp.tenant_id   = ps.place_id
    AND tp.period_year = ps.period_year
    AND tp.period_month = ps.period_month;
';
EXEC sp_executesql @v;
-- =============================================================================
-- analytics_antojados_user_summary
-- Resumen social del usuario para Mi Rollo
-- Fuente: latest food_user_score_pmonth + tablas sociales vivas del dominio usuario
-- =============================================================================
SET @v = N'
CREATE OR ALTER VIEW gt_antojados.analytics_antojados_user_summary AS
WITH latest_user_score AS (
    SELECT
        fus.*,
        ROW_NUMBER() OVER (
            PARTITION BY fus.user_id
            ORDER BY fus.period_year DESC, fus.period_month DESC, fus.materialized_at DESC
        ) AS rn
    FROM gt_antojados.food_user_score_pmonth fus
)
SELECT
    ai.user_id,
    ai.display_name,
    ai.username,
    ai.city_code,
    ai.avatar_url,
    ai.reputation_level,
    ai.verified_reviewer,
    lus.period_year,
    lus.period_month,
    ISNULL(post_stats.posts_total, 0)              AS posts_total,
    ISNULL(post_stats.likes_received_total, 0)     AS likes_received_total,
    ISNULL(post_stats.comments_received_total, 0)  AS comments_received_total,
    ISNULL(post_stats.shares_received_total, 0)    AS shares_received_total,
    ISNULL(save_stats.saved_places_total, 0)       AS saved_places_total,
    ISNULL(following_stats.following_total, 0)     AS following_total,
    ISNULL(following_stats.following_users_total, 0) AS following_users_total,
    ISNULL(following_stats.following_places_total, 0) AS following_places_total,
    ISNULL(follower_stats.followers_total, 0)      AS followers_total,
    ISNULL(lus.post_count, 0)                      AS posts_created_month,
    ISNULL(lus.likes_total, 0)                     AS likes_given_month,
    ISNULL(lus.comments_total, 0)                  AS comments_made_month,
    ISNULL(lus.shares_total, 0)                    AS shares_made_month,
    ISNULL(lus.verified_visits_count, 0)           AS verified_visits_count,
    ISNULL(lus.unique_places_visited, 0)           AS unique_places_visited,
    ISNULL(lus.rewards_earned, 0)                  AS rewards_earned,
    ISNULL(lus.engagement_score, 0)                AS engagement_score,
    lus.reputation_rank_in_city,
    lus.materialized_at
FROM [ATLX_ANTOJADOS_APP].antojados_core.auth_identities ai
LEFT JOIN latest_user_score lus
    ON lus.user_id = ai.user_id
   AND lus.rn = 1
LEFT JOIN (
    SELECT
        p.user_id,
        COUNT(*) AS posts_total,
        SUM(ISNULL(p.likes_count, 0)) AS likes_received_total,
        SUM(ISNULL(p.comments_count, 0)) AS comments_received_total,
        SUM(ISNULL(p.shares_count, 0)) AS shares_received_total
    FROM [ATLX_ANTOJADOS_APP].antojados_core.soc_posts p
    WHERE p.post_status = N''active''
    GROUP BY p.user_id
) post_stats
    ON post_stats.user_id = ai.user_id
LEFT JOIN (
    SELECT s.user_id, COUNT(*) AS saved_places_total
    FROM [ATLX_ANTOJADOS_APP].antojados_core.soc_saves s
    GROUP BY s.user_id
) save_stats
    ON save_stats.user_id = ai.user_id
LEFT JOIN (
    SELECT
        f.follower_user_id AS user_id,
        COUNT(*) AS following_total,
        SUM(CASE WHEN f.target_type = N''user'' THEN 1 ELSE 0 END) AS following_users_total,
        SUM(CASE WHEN f.target_type = N''place'' THEN 1 ELSE 0 END) AS following_places_total
    FROM [ATLX_ANTOJADOS_APP].antojados_core.soc_follows f
    WHERE f.status = N''active''
    GROUP BY f.follower_user_id
) following_stats
    ON following_stats.user_id = ai.user_id
LEFT JOIN (
    SELECT f.target_user_id AS user_id, COUNT(*) AS followers_total
    FROM [ATLX_ANTOJADOS_APP].antojados_core.soc_follows f
    WHERE f.status = N''active''
      AND f.target_type = N''user''
      AND f.target_user_id IS NOT NULL
    GROUP BY f.target_user_id
) follower_stats
    ON follower_stats.user_id = ai.user_id;
';
EXEC sp_executesql @v;
-- =============================================================================
-- analytics_antojados_city_activity
-- Actividad territorial por ciudad/barrio — pkg_inteligencia + GT dashboard
-- Fuente: food_territorial_activity
-- =============================================================================
SET @v = N'
CREATE OR ALTER VIEW gt_antojados.analytics_antojados_city_activity AS
SELECT
    city_code,
    barrio_code,
    activity_date,
    hour_bucket,
    SUM(event_count)  AS total_events,
    MAX(event_count)  AS peak_event_count,
    MAX(computed_at)  AS last_computed
FROM gt_antojados.food_territorial_activity
GROUP BY city_code, barrio_code, activity_date, hour_bucket;
';
EXEC sp_executesql @v;
-- =============================================================================
-- analytics_antojados_tile_performance
-- KPIs de tiles agrupados por placement — GT panel Tab 3 Tiles
-- Fuente: food_tile_performance_pmonth
-- =============================================================================
SET @v = N'
CREATE OR ALTER VIEW gt_antojados.analytics_antojados_tile_performance AS
SELECT
    placement,
    city_code,
    period_year,
    period_month,
    COUNT(DISTINCT tile_id)                                                   AS active_tiles,
    SUM(views_count)                                                          AS total_views,
    SUM(clicks_count)                                                         AS total_clicks,
    SUM(follows_count)                                                        AS total_follows,
    CAST(SUM(clicks_count)  AS DECIMAL(10,4)) / NULLIF(SUM(views_count), 0)  AS avg_ctr,
    CAST(SUM(follows_count) AS DECIMAL(10,4)) / NULLIF(SUM(views_count), 0)  AS avg_follow_rate
FROM gt_antojados.food_tile_performance_pmonth
GROUP BY placement, city_code, period_year, period_month;
';
EXEC sp_executesql @v;
-- =============================================================================
-- analytics_antojados_arre_events
-- Actividad nocturna tipo arre_event — GT panel Tab 3 Nightlife
-- Fuente: food_nightlife_activity WHERE activity_type = 'arre_event'
-- =============================================================================
SET @v = N'
CREATE OR ALTER VIEW gt_antojados.analytics_antojados_arre_events AS
SELECT
    city_code,
    barrio_code,
    place_id,
    event_count,
    hour_bucket,
    activity_date,
    computed_at
FROM gt_antojados.food_nightlife_activity
WHERE activity_type = N''arre_event'';
';
EXEC sp_executesql @v;
-- =============================================================================
-- analytics_antojados_screen_performance
-- Rendimiento agregado de placements — GT panel Tab 4 Pantallas
-- Nota: misma fuente que tile_performance pero agrupada diferente
--   (por placement+ciudad, no por tile individual)
-- Fuente: food_tile_performance_pmonth
-- =============================================================================
SET @v = N'
CREATE OR ALTER VIEW gt_antojados.analytics_antojados_screen_performance AS
SELECT
    placement,
    city_code,
    period_year,
    period_month,
    COUNT(DISTINCT tenant_id)                                                 AS tenants_activos,
    SUM(views_count)                                                          AS total_views,
    SUM(clicks_count)                                                         AS total_clicks,
    SUM(follows_count)                                                        AS total_follows,
    CAST(SUM(clicks_count)  AS DECIMAL(10,4)) / NULLIF(SUM(views_count), 0)  AS avg_ctr,
    CAST(SUM(follows_count) AS DECIMAL(10,4)) / NULLIF(SUM(views_count), 0)  AS avg_follow_rate
FROM gt_antojados.food_tile_performance_pmonth
GROUP BY placement, city_code, period_year, period_month;
';
EXEC sp_executesql @v;
-- =============================================================================
-- Indices adicionales §5.11 en tablas existentes (idempotente)
-- =============================================================================
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_fem_place_period'
        AND object_id = OBJECT_ID(N'gt_antojados.food_engagement_pmonth')
) EXEC(
    N'CREATE INDEX IX_fem_place_period ON gt_antojados.food_engagement_pmonth (place_id, period_year, period_month)'
) IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_fem_city_period'
        AND object_id = OBJECT_ID(N'gt_antojados.food_engagement_pmonth')
) EXEC(
    N'CREATE INDEX IX_fem_city_period ON gt_antojados.food_engagement_pmonth (city_code, period_year, period_month)'
) IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_fps_place_period'
        AND object_id = OBJECT_ID(N'gt_antojados.food_place_score_pmonth')
) EXEC(
    N'CREATE INDEX IX_fps_place_period ON gt_antojados.food_place_score_pmonth (place_id, period_year, period_month)'
) IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_fps_city_score'
        AND object_id = OBJECT_ID(N'gt_antojados.food_place_score_pmonth')
) EXEC(
    N'CREATE INDEX IX_fps_city_score ON gt_antojados.food_place_score_pmonth (city_code, score DESC) INCLUDE (place_id, period_year, period_month, rank_in_city)'
) IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_fus_user_period'
        AND object_id = OBJECT_ID(N'gt_antojados.food_user_score_pmonth')
) EXEC(
    N'CREATE INDEX IX_fus_user_period ON gt_antojados.food_user_score_pmonth (user_id, period_year, period_month)'
) IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_fbpe_place_period2'
        AND object_id = OBJECT_ID(N'gt_antojados.food_biz_post_engagement_pmonth')
) EXEC(
    N'CREATE INDEX IX_fbpe_place_period2 ON gt_antojados.food_biz_post_engagement_pmonth (place_id, period_year, period_month)'
) IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_fzop_place_period'
        AND object_id = OBJECT_ID(N'gt_antojados.food_zonad_order_pmonth')
) EXEC(
    N'CREATE INDEX IX_fzop_place_period ON gt_antojados.food_zonad_order_pmonth (place_id, year, month)'
)
