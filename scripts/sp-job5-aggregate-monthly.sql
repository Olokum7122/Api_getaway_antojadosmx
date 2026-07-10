SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
-- =============================================================================
-- sp-job5-aggregate-monthly.sql
-- Ejecutar contra: ATLX_GT_ANALYTICS
-- sqlcmd -S 185.187.235.253 -U sa -P "..." -C -d ATLX_GT_ANALYTICS
--        -i sp-job5-aggregate-monthly.sql
-- Idempotente: DROP + CREATE via sp_executesql.
-- SPs creados:
--   usp_s5_engagement_pmonth         -> food_engagement_pmonth
--   usp_s5_place_score_pmonth        -> food_place_score_pmonth
--   usp_s5_user_score_pmonth         -> food_user_score_pmonth
--   usp_s5_tile_performance_pmonth   -> food_tile_performance_pmonth
--   usp_s5_tag_trends_pmonth         -> food_tag_trends_pmonth
--   usp_s5_biz_post_engagement_pmonth-> food_biz_post_engagement_pmonth
--   usp_s5_aggregate_monthly         -> orchestrator J5 (llama todos los sub-SPs)
-- Prerequisito: migrate-03, migrate-04 aplicados; sp-job4 aplicado.
-- §5.6 / §5.9 Job J5
-- =============================================================================
USE ATLX_GT_ANALYTICS;
SET NOCOUNT ON;
-- =============================================================================
-- Sub-SP 1: usp_s5_engagement_pmonth
-- Fuente: food_place_event_stream (GT_INTEGRATION)
-- Destino: food_engagement_pmonth (GT_ANALYTICS)
-- =============================================================================
DECLARE @sp NVARCHAR(MAX) = N'';
SET @sp = N'
CREATE PROCEDURE gt_antojados.usp_s5_engagement_pmonth
    @year  SMALLINT,
    @month TINYINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @first_day DATE = DATEFROMPARTS(@year, @month, 1);
    DECLARE @last_day  DATE = EOMONTH(@first_day);

    ;WITH src AS (
        SELECT
            fpes.place_id,
            fpes.city_code,
            ISNULL(fpes.zone_code, ISNULL(gps.zone_code, ISNULL(pl.zone_code, fpes.city_code))) AS zone_code,
            ISNULL(pl.category, N''general'') AS category,
            SUM(CASE WHEN fpes.event_type = N''post_created''   THEN fpes.event_count ELSE 0 END) AS post_count,
            SUM(CASE WHEN fpes.event_type = N''post_liked''     THEN fpes.event_count ELSE 0 END) AS likes_total,
            SUM(CASE WHEN fpes.event_type = N''post_commented'' THEN fpes.event_count ELSE 0 END) AS comments_total,
            SUM(CASE WHEN fpes.event_type = N''post_shared''    THEN fpes.event_count ELSE 0 END) AS shares_total,
            SUM(CASE WHEN fpes.event_type = N''verified_visit'' THEN fpes.event_count ELSE 0 END) AS verified_visit_count
        FROM [ATLX_GT_INTEGRATION].gt_antojados.food_place_event_stream fpes
        LEFT JOIN [ATLX_ANTOJADOS_APP].antojados_core.geo_place_scope_map gps
            ON gps.place_id = fpes.place_id
        LEFT JOIN [ATLX_ANTOJADOS_APP].antojados_core.soc_places pl
            ON pl.place_id = fpes.place_id
        WHERE fpes.event_date BETWEEN @first_day AND @last_day
        GROUP BY fpes.place_id, fpes.city_code,
                 ISNULL(fpes.zone_code, ISNULL(gps.zone_code, ISNULL(pl.zone_code, fpes.city_code))),
                 ISNULL(pl.category, N''general'')
    ),
    scored AS (
        SELECT
            src.*,
            CASE WHEN src.post_count > 0
                 THEN CAST(
                     (src.likes_total * 1.0
                      + src.comments_total * 2.0
                      + src.shares_total   * 3.0
                      + src.verified_visit_count * 5.0
                     ) / src.post_count AS FLOAT)
                 ELSE 0
            END AS avg_engagement_score
        FROM src
    ),
    with_trend AS (
        SELECT
            s.*,
            s.avg_engagement_score - ISNULL(
                (SELECT TOP 1 e2.avg_engagement_score
                 FROM gt_antojados.food_engagement_pmonth e2
                 WHERE e2.place_id    = s.place_id
                   AND e2.city_code   = s.city_code
                   AND e2.category    = s.category
                   AND (e2.period_year < @year
                        OR (e2.period_year = @year AND e2.period_month < @month))
                 ORDER BY e2.period_year DESC, e2.period_month DESC),
            0) AS trend_score
        FROM scored s
    )
    MERGE gt_antojados.food_engagement_pmonth AS tgt
    USING with_trend AS src
    ON  tgt.place_id     = src.place_id
    AND tgt.city_code    = src.city_code
    AND tgt.category     = src.category
    AND tgt.period_year  = @year
    AND tgt.period_month = @month
    WHEN MATCHED THEN
        UPDATE SET
            tgt.post_count           = src.post_count,
            tgt.likes_total          = src.likes_total,
            tgt.comments_total       = src.comments_total,
            tgt.shares_total         = src.shares_total,
            tgt.visit_verified_count = src.verified_visit_count,
            tgt.zone_code            = src.zone_code,
            tgt.scope_level          = N''ciudad'',
            tgt.scope_code           = src.city_code,
            tgt.avg_engagement_score = src.avg_engagement_score,
            tgt.trend_score          = src.trend_score,
            tgt.materialized_at      = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (id, period_year, period_month, place_id, city_code, zone_code, scope_level, scope_code, category,
                post_count, visit_verified_count, unique_users,
                likes_total, comments_total, shares_total,
                avg_rating, avg_engagement_score, trend_score, materialized_at)
        VALUES (NEWID(), @year, @month, src.place_id, src.city_code, src.zone_code, N''ciudad'', src.city_code, src.category,
                src.post_count, src.verified_visit_count, 0,
                src.likes_total, src.comments_total, src.shares_total,
                0, src.avg_engagement_score, src.trend_score, SYSUTCDATETIME());
END
';
IF OBJECT_ID(N'gt_antojados.usp_s5_engagement_pmonth', 'P') IS NOT NULL EXEC(
    N'DROP PROCEDURE gt_antojados.usp_s5_engagement_pmonth'
);
EXEC sp_executesql @sp;
-- =============================================================================
-- Sub-SP 2: usp_s5_place_score_pmonth
-- Fuente: food_place_event_stream (GT_INTEGRATION)
-- Destino: food_place_score_pmonth (GT_ANALYTICS)
-- =============================================================================
SET @sp = N'
CREATE PROCEDURE gt_antojados.usp_s5_place_score_pmonth
    @year  SMALLINT,
    @month TINYINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @first_day DATE = DATEFROMPARTS(@year, @month, 1);
    DECLARE @last_day  DATE = EOMONTH(@first_day);

    ;WITH src AS (
        SELECT
            fpes.place_id,
            fpes.city_code,
            ISNULL(fpes.zone_code, ISNULL(gps.zone_code, ISNULL(pl.zone_code, fpes.city_code))) AS zone_code,
            ISNULL(pl.category, N''general'') AS category,
            SUM(CASE WHEN fpes.event_type IN (
                         N''post_viewed'', N''place_viewed'', N''biz_post_viewed'')
                     THEN fpes.event_count ELSE 0 END) AS views,
            SUM(CASE WHEN fpes.event_type = N''place_saved''
                     THEN fpes.event_count ELSE 0 END) AS saves,
            SUM(CASE WHEN fpes.event_type = N''place_followed''
                     THEN fpes.event_count ELSE 0 END) AS follows,
            SUM(CASE WHEN fpes.event_type IN (
                         N''cta_whatsapp'', N''cta_maps'', N''cta_call'',
                         N''cta_reservation'', N''biz_cta_clicked'')
                     THEN fpes.event_count ELSE 0 END) AS ctas,
            SUM(CASE WHEN fpes.event_type = N''reward_redeemed''
                     THEN fpes.event_count ELSE 0 END) AS rewards,
            SUM(CASE WHEN fpes.event_type = N''verified_visit''
                     THEN fpes.event_count ELSE 0 END) AS visits
        FROM [ATLX_GT_INTEGRATION].gt_antojados.food_place_event_stream fpes
        LEFT JOIN [ATLX_ANTOJADOS_APP].antojados_core.geo_place_scope_map gps
            ON gps.place_id = fpes.place_id
        LEFT JOIN [ATLX_ANTOJADOS_APP].antojados_core.soc_places pl
            ON pl.place_id = fpes.place_id
        WHERE fpes.event_date BETWEEN @first_day AND @last_day
        GROUP BY fpes.place_id, fpes.city_code,
                 ISNULL(fpes.zone_code, ISNULL(gps.zone_code, ISNULL(pl.zone_code, fpes.city_code))),
                 ISNULL(pl.category, N''general'')
    ),
    scored AS (
        SELECT
            src.*,
            ROUND(
                src.views   * 0.10
              + src.saves   * 0.30
              + src.follows * 0.50
              + src.ctas    * 1.00
              + src.visits  * 2.00
              + src.rewards * 3.00
            , 2) AS score
        FROM src
    ),
    ranked AS (
        SELECT
            s.*,
            RANK() OVER (PARTITION BY s.city_code ORDER BY s.score DESC) AS rank_in_city,
            RANK() OVER (PARTITION BY s.city_code, s.category ORDER BY s.score DESC) AS rank_in_category,
            s.score - ISNULL(
                (SELECT TOP 1 ps2.score
                 FROM gt_antojados.food_place_score_pmonth ps2
                 WHERE ps2.place_id    = s.place_id
                   AND ps2.city_code   = s.city_code
                   AND ps2.category    = s.category
                   AND (ps2.period_year < @year
                        OR (ps2.period_year = @year AND ps2.period_month < @month))
                 ORDER BY ps2.period_year DESC, ps2.period_month DESC),
            0) AS score_delta
        FROM scored s
    )
    MERGE gt_antojados.food_place_score_pmonth AS tgt
    USING ranked AS src
    ON  tgt.place_id     = src.place_id
    AND tgt.city_code    = src.city_code
    AND tgt.category     = src.category
    AND tgt.period_year  = @year
    AND tgt.period_month = @month
    WHEN MATCHED THEN
        UPDATE SET
            tgt.score            = src.score,
            tgt.score_delta_pct  = CASE WHEN src.score_delta <> 0 THEN
                                       ROUND(src.score_delta / NULLIF(ABS(src.score - src.score_delta), 0) * 100, 2)
                                   ELSE 0 END,
            tgt.zone_code        = src.zone_code,
            tgt.scope_level      = N''ciudad'',
            tgt.scope_code       = src.city_code,
            tgt.rank_in_city     = src.rank_in_city,
            tgt.rank_in_category = src.rank_in_category,
            tgt.computed_at      = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (id, place_id, city_code, zone_code, scope_level, scope_code, category,
                score, score_delta_pct, rank_in_city, rank_in_category,
                period_year, period_month, computed_at)
        VALUES (NEWID(), src.place_id, src.city_code, src.zone_code, N''ciudad'', src.city_code, src.category,
                src.score, 0, src.rank_in_city, src.rank_in_category,
                @year, @month, SYSUTCDATETIME());
END
';
IF OBJECT_ID(N'gt_antojados.usp_s5_place_score_pmonth', 'P') IS NOT NULL EXEC(
    N'DROP PROCEDURE gt_antojados.usp_s5_place_score_pmonth'
);
EXEC sp_executesql @sp;
-- =============================================================================
-- Sub-SP 3: usp_s5_user_score_pmonth
-- Fuente: food_user_event_stream (GT_INTEGRATION)
-- Destino: food_user_score_pmonth (GT_ANALYTICS)
-- =============================================================================
SET @sp = N'
CREATE PROCEDURE gt_antojados.usp_s5_user_score_pmonth
    @year  SMALLINT,
    @month TINYINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @first_day DATE = DATEFROMPARTS(@year, @month, 1);
    DECLARE @last_day  DATE = EOMONTH(@first_day);

    ;WITH src AS (
        SELECT
            user_id,
            city_code,
            SUM(CASE WHEN event_type = N''post_created''    THEN event_count ELSE 0 END) AS post_count,
            SUM(CASE WHEN event_type = N''post_liked''      THEN event_count ELSE 0 END) AS likes_total,
            SUM(CASE WHEN event_type = N''post_commented''  THEN event_count ELSE 0 END) AS comments_total,
            SUM(CASE WHEN event_type = N''post_shared''     THEN event_count ELSE 0 END) AS shares_total,
            SUM(CASE WHEN event_type = N''verified_visit''  THEN event_count ELSE 0 END) AS verified_visits_count,
            SUM(CASE WHEN event_type = N''reward_redeemed'' THEN event_count ELSE 0 END) AS rewards_earned
        FROM [ATLX_GT_INTEGRATION].gt_antojados.food_user_event_stream
        WHERE event_date BETWEEN @first_day AND @last_day
        GROUP BY user_id, city_code
    ),
    unique_places AS (
        SELECT
            fei.user_id,
            pl.city_code,
            COUNT(DISTINCT fei.place_id) AS unique_places_visited
        FROM [ATLX_GT_INTEGRATION].gt_antojados.food_event_ingesta fei
        JOIN [ATLX_ANTOJADOS_APP].antojados_core.soc_places pl
            ON pl.place_id = fei.place_id
        WHERE CAST(fei.event_ts AS DATE) BETWEEN @first_day AND @last_day
          AND fei.user_id IS NOT NULL
          AND fei.place_id IS NOT NULL
        GROUP BY fei.user_id, pl.city_code
    ),
    scored AS (
        SELECT
            src.*,
            ISNULL(up.unique_places_visited, 0) AS unique_places_visited,
            CAST(
                src.post_count           * 3.0
              + src.likes_total          * 0.5
              + src.comments_total       * 1.0
              + src.shares_total         * 1.5
              + src.verified_visits_count * 2.0
              + src.rewards_earned       * 2.0
            AS FLOAT) AS engagement_score
        FROM src
        LEFT JOIN unique_places up
            ON up.user_id = src.user_id
           AND up.city_code = src.city_code
    ),
    ranked AS (
        SELECT
            s.*,
            RANK() OVER (PARTITION BY s.city_code ORDER BY s.engagement_score DESC) AS reputation_rank_in_city
        FROM scored s
    )
    MERGE gt_antojados.food_user_score_pmonth AS tgt
    USING ranked AS src
    ON  tgt.user_id      = src.user_id
    AND tgt.city_code    = src.city_code
    AND tgt.period_year  = @year
    AND tgt.period_month = @month
    WHEN MATCHED THEN
        UPDATE SET
            tgt.post_count              = src.post_count,
            tgt.likes_total             = src.likes_total,
            tgt.comments_total          = src.comments_total,
            tgt.shares_total            = src.shares_total,
            tgt.verified_visits_count   = src.verified_visits_count,
            tgt.unique_places_visited   = src.unique_places_visited,
            tgt.rewards_earned          = src.rewards_earned,
            tgt.engagement_score        = src.engagement_score,
            tgt.reputation_rank_in_city = src.reputation_rank_in_city,
            tgt.materialized_at         = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (id, period_year, period_month, user_id, city_code,
                post_count, likes_total, comments_total, shares_total,
                verified_visits_count, unique_places_visited, rewards_earned,
                engagement_score, reputation_rank_in_city, materialized_at)
        VALUES (NEWID(), @year, @month, src.user_id, src.city_code,
                src.post_count, src.likes_total, src.comments_total, src.shares_total,
                src.verified_visits_count, src.unique_places_visited, src.rewards_earned,
                src.engagement_score, src.reputation_rank_in_city, SYSUTCDATETIME());
END
';
IF OBJECT_ID(N'gt_antojados.usp_s5_user_score_pmonth', 'P') IS NOT NULL EXEC(
    N'DROP PROCEDURE gt_antojados.usp_s5_user_score_pmonth'
);
EXEC sp_executesql @sp;
-- =============================================================================
-- Sub-SP 4: usp_s5_tile_performance_pmonth
-- Fuente: food_tile_event_stream (GT_INTEGRATION)
-- Destino: food_tile_performance_pmonth (GT_ANALYTICS)
-- =============================================================================
SET @sp = N'
CREATE PROCEDURE gt_antojados.usp_s5_tile_performance_pmonth
    @year  SMALLINT,
    @month TINYINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @first_day DATE = DATEFROMPARTS(@year, @month, 1);
    DECLARE @last_day  DATE = EOMONTH(@first_day);

    ;WITH src AS (
        SELECT
            tile_id,
            tenant_id,
            placement,
            city_code,
            SUM(CASE WHEN event_type = N''tile_viewed''           THEN event_count ELSE 0 END) AS views_count,
            SUM(CASE WHEN event_type = N''tile_clicked''          THEN event_count ELSE 0 END) AS clicks_count,
            SUM(CASE WHEN event_type = N''tile_follow_from_tile'' THEN event_count ELSE 0 END) AS follows_count
        FROM [ATLX_GT_INTEGRATION].gt_antojados.food_tile_event_stream
        WHERE event_date BETWEEN @first_day AND @last_day
        GROUP BY tile_id, tenant_id, placement, city_code
    )
    MERGE gt_antojados.food_tile_performance_pmonth AS tgt
    USING src
    ON  tgt.tile_id      = src.tile_id
    AND tgt.placement    = src.placement
    AND tgt.city_code    = src.city_code
    AND tgt.period_year  = @year
    AND tgt.period_month = @month
    WHEN MATCHED THEN
        UPDATE SET
            tgt.views_count   = src.views_count,
            tgt.clicks_count  = src.clicks_count,
            tgt.follows_count = src.follows_count,
            tgt.ctr           = CAST(src.clicks_count  AS DECIMAL(10,4)) / NULLIF(src.views_count, 0),
            tgt.follow_rate   = CAST(src.follows_count AS DECIMAL(10,4)) / NULLIF(src.views_count, 0),
            tgt.computed_at   = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (perf_id, tile_id, tenant_id, placement, city_code,
                views_count, clicks_count, follows_count, ctr, follow_rate,
                period_year, period_month, computed_at)
        VALUES (NEWID(), src.tile_id, src.tenant_id, src.placement, src.city_code,
                src.views_count, src.clicks_count, src.follows_count,
                CAST(src.clicks_count  AS DECIMAL(10,4)) / NULLIF(src.views_count, 0),
                CAST(src.follows_count AS DECIMAL(10,4)) / NULLIF(src.views_count, 0),
                @year, @month, SYSUTCDATETIME());
END
';
IF OBJECT_ID(
    N'gt_antojados.usp_s5_tile_performance_pmonth',
    'P'
) IS NOT NULL EXEC(
    N'DROP PROCEDURE gt_antojados.usp_s5_tile_performance_pmonth'
);
EXEC sp_executesql @sp;
-- =============================================================================
-- Sub-SP 5: usp_s5_tag_trends_pmonth
-- Fuente: food_tag_event_stream (GT_INTEGRATION)
-- Destino: food_tag_trends_pmonth (GT_ANALYTICS)
-- =============================================================================
SET @sp = N'
CREATE PROCEDURE gt_antojados.usp_s5_tag_trends_pmonth
    @year  SMALLINT,
    @month TINYINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @first_day  DATE    = DATEFROMPARTS(@year, @month, 1);
    DECLARE @last_day   DATE    = EOMONTH(@first_day);
    DECLARE @prev_year  SMALLINT;
    DECLARE @prev_month TINYINT;

    SET @prev_month = CASE WHEN @month = 1 THEN 12 ELSE @month - 1 END;
    SET @prev_year  = CASE WHEN @month = 1 THEN @year - 1 ELSE @year END;

    ;WITH src AS (
        SELECT
            tag_text,
            city_code,
            SUM(post_count) AS post_count
        FROM [ATLX_GT_INTEGRATION].gt_antojados.food_tag_event_stream
        WHERE event_date BETWEEN @first_day AND @last_day
        GROUP BY tag_text, city_code
    ),
    with_rank AS (
        SELECT
            src.*,
            RANK() OVER (PARTITION BY src.city_code ORDER BY src.post_count DESC) AS rank_in_city,
            src.post_count - ISNULL(
                (SELECT TOP 1 prev.post_count
                 FROM gt_antojados.food_tag_trends_pmonth prev
                 WHERE prev.tag_text     = src.tag_text
                   AND prev.city_code    = src.city_code
                   AND prev.period_year  = @prev_year
                   AND prev.period_month = @prev_month),
            NULL) AS trend_delta
        FROM src
    )
    MERGE gt_antojados.food_tag_trends_pmonth AS tgt
    USING with_rank AS src
    ON  tgt.tag_text     = src.tag_text
    AND tgt.city_code    = src.city_code
    AND tgt.period_year  = @year
    AND tgt.period_month = @month
    WHEN MATCHED THEN
        UPDATE SET
            tgt.post_count   = src.post_count,
            tgt.trend_delta  = src.trend_delta,
            tgt.rank_in_city = src.rank_in_city,
            tgt.computed_at  = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (trend_id, tag_text, city_code, post_count,
                period_year, period_month, trend_delta, rank_in_city, computed_at)
        VALUES (NEWID(), src.tag_text, src.city_code, src.post_count,
                @year, @month, src.trend_delta, src.rank_in_city, SYSUTCDATETIME());
END
';
IF OBJECT_ID(N'gt_antojados.usp_s5_tag_trends_pmonth', 'P') IS NOT NULL EXEC(
    N'DROP PROCEDURE gt_antojados.usp_s5_tag_trends_pmonth'
);
EXEC sp_executesql @sp;
-- =============================================================================
-- Sub-SP 6: usp_s5_biz_post_engagement_pmonth
-- Excepcion arquitectonica: lee food_event_ingesta (GT_INTEGRATION)
-- porque la granularidad biz_post_id no se preserva en streams.
-- Destino: food_biz_post_engagement_pmonth (GT_ANALYTICS)
-- =============================================================================
SET @sp = N'
CREATE PROCEDURE gt_antojados.usp_s5_biz_post_engagement_pmonth
    @year  SMALLINT,
    @month TINYINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @first_day DATETIME2 = CAST(DATEFROMPARTS(@year, @month, 1) AS DATETIME2);
    DECLARE @last_day  DATETIME2 = CAST(DATEADD(ms, -3, DATEADD(month, 1, @first_day)) AS DATETIME2);

    ;WITH src AS (
        SELECT
            ISNULL(btu.instance_id, N''UNKNOWN'') AS tenant_instance_id,
            fei.place_id,
            ISNULL(pl.city_code, N''UNKNOWN'') AS city_code,
            ISNULL(gps.zone_code, ISNULL(pl.zone_code, ISNULL(pl.city_code, N''UNKNOWN''))) AS zone_code,
            ISNULL(pl.category, N''general'')  AS category,
            N''biz''                            AS post_type,
            COUNT(DISTINCT fei.biz_post_id)   AS biz_post_count,
            SUM(CASE WHEN fei.event_type = N''biz_post_viewed'' THEN 1 ELSE 0 END) AS impressions_total,
            SUM(CASE WHEN fei.event_type = N''biz_post_liked''  THEN 1 ELSE 0 END) AS likes_total,
            SUM(CASE WHEN fei.event_type = N''biz_post_commented'' THEN 1 ELSE 0 END) AS comments_total,
            SUM(CASE WHEN fei.event_type = N''biz_post_shared'' THEN 1 ELSE 0 END) AS shares_total,
            SUM(CASE WHEN fei.event_type = N''biz_cta_clicked'' THEN 1 ELSE 0 END) AS cta_clicks_total,
            0 AS profile_visits_total,
            SUM(CASE WHEN fei.event_type = N''cta_whatsapp''    THEN 1 ELSE 0 END) AS whatsapp_taps_total,
            SUM(CASE WHEN fei.event_type = N''cta_maps''        THEN 1 ELSE 0 END) AS maps_taps_total,
            SUM(CASE WHEN fei.event_type = N''cta_call''        THEN 1 ELSE 0 END) AS calls_total
        FROM [ATLX_GT_INTEGRATION].gt_antojados.food_event_ingesta fei
        LEFT JOIN [ATLX_ANTOJADOS_APP].antojados_core.biz_posts bp
            ON bp.biz_post_id = fei.biz_post_id
        LEFT JOIN [ATLX_ANTOJADOS_APP].antojados_core.biz_tenant_users btu
            ON btu.user_id = bp.publisher_user_id
           AND btu.status = N''active''
        LEFT JOIN [ATLX_ANTOJADOS_APP].antojados_core.geo_place_scope_map gps
            ON gps.place_id = fei.place_id
        LEFT JOIN [ATLX_ANTOJADOS_APP].antojados_core.soc_places pl
            ON pl.place_id = fei.place_id
        WHERE fei.biz_post_id IS NOT NULL
          AND fei.event_ts    BETWEEN @first_day AND @last_day
          AND fei.status_code IN (N''PROCESSED'', N''ERROR'')
        GROUP BY
            ISNULL(btu.instance_id, N''UNKNOWN''),
            fei.place_id,
            ISNULL(pl.city_code, N''UNKNOWN''),
            ISNULL(gps.zone_code, ISNULL(pl.zone_code, ISNULL(pl.city_code, N''UNKNOWN''))),
            ISNULL(pl.category, N''general'')
    ),
    scored AS (
        SELECT
            src.*,
            CAST(
                src.impressions_total * 0.5
              + src.likes_total       * 1.5
              + src.comments_total    * 1.5
              + src.shares_total      * 2.0
              + src.cta_clicks_total  * 2.0
            AS FLOAT) AS avg_engagement_score
        FROM src
    )
    MERGE gt_antojados.food_biz_post_engagement_pmonth AS tgt
    USING scored AS src
    ON  tgt.tenant_instance_id = src.tenant_instance_id
    AND tgt.place_id     = src.place_id
    AND tgt.city_code    = src.city_code
    AND tgt.category     = src.category
    AND tgt.post_type    = src.post_type
    AND tgt.period_year  = @year
    AND tgt.period_month = @month
    WHEN MATCHED THEN
        UPDATE SET
            tgt.biz_post_count       = src.biz_post_count,
            tgt.zone_code            = src.zone_code,
            tgt.scope_level          = N''ciudad'',
            tgt.scope_code           = src.city_code,
            tgt.impressions_total    = src.impressions_total,
            tgt.likes_total          = src.likes_total,
            tgt.comments_total       = src.comments_total,
            tgt.shares_total         = src.shares_total,
            tgt.cta_clicks_total     = src.cta_clicks_total,
            tgt.profile_visits_total = src.profile_visits_total,
            tgt.whatsapp_taps_total  = src.whatsapp_taps_total,
            tgt.maps_taps_total      = src.maps_taps_total,
            tgt.calls_total          = src.calls_total,
            tgt.avg_engagement_score = src.avg_engagement_score,
            tgt.materialized_at      = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (id, period_year, period_month, tenant_instance_id, place_id, city_code, zone_code, scope_level, scope_code, category, post_type,
                biz_post_count, impressions_total, likes_total, comments_total, shares_total,
                cta_clicks_total, profile_visits_total, whatsapp_taps_total,
                maps_taps_total, calls_total, avg_engagement_score, materialized_at)
        VALUES (NEWID(), @year, @month, src.tenant_instance_id, src.place_id, src.city_code, src.zone_code, N''ciudad'', src.city_code, src.category, src.post_type,
                src.biz_post_count, src.impressions_total, src.likes_total, src.comments_total, src.shares_total,
                src.cta_clicks_total, src.profile_visits_total, src.whatsapp_taps_total,
                src.maps_taps_total, src.calls_total, src.avg_engagement_score, SYSUTCDATETIME());
END
';
IF OBJECT_ID(
    N'gt_antojados.usp_s5_biz_post_engagement_pmonth',
    'P'
) IS NOT NULL EXEC(
    N'DROP PROCEDURE gt_antojados.usp_s5_biz_post_engagement_pmonth'
);
EXEC sp_executesql @sp;
-- =============================================================================
-- Orchestrator J5: usp_s5_aggregate_monthly
-- Llama los 6 sub-SPs en orden y marca streams consumidos.
-- =============================================================================
SET @sp = N'
CREATE PROCEDURE gt_antojados.usp_s5_aggregate_monthly
    @year  SMALLINT = NULL,
    @month TINYINT  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Por defecto: mes anterior
    IF @year IS NULL OR @month IS NULL
    BEGIN
        DECLARE @ref DATE = DATEADD(month, -1, GETUTCDATE());
        SET @year  = CAST(YEAR(@ref)  AS SMALLINT);
        SET @month = CAST(MONTH(@ref) AS TINYINT);
    END

    DECLARE @first_day DATE = DATEFROMPARTS(@year, @month, 1);
    DECLARE @last_day  DATE = EOMONTH(@first_day);

    -- 1. Engagement por negocio
    EXEC gt_antojados.usp_s5_engagement_pmonth          @year, @month;
    -- 2. Score por negocio
    EXEC gt_antojados.usp_s5_place_score_pmonth         @year, @month;
    -- 3. Score por usuario
    EXEC gt_antojados.usp_s5_user_score_pmonth          @year, @month;
    -- 4. Performance de tiles
    EXEC gt_antojados.usp_s5_tile_performance_pmonth    @year, @month;
    -- 5. Tendencias de tags
    EXEC gt_antojados.usp_s5_tag_trends_pmonth          @year, @month;
    -- 6. Engagement biz posts (excepcion: lee food_event_ingesta)
    EXEC gt_antojados.usp_s5_biz_post_engagement_pmonth @year, @month;

    -- Marcar 4 streams restantes como consumidos por S5
    -- (food_city_event_stream ya fue marcado por J4 daily)
    UPDATE [ATLX_GT_INTEGRATION].gt_antojados.food_user_event_stream
    SET consumed_by_s5 = 1
    WHERE consumed_by_s5 = 0
      AND event_date BETWEEN @first_day AND @last_day;

    UPDATE [ATLX_GT_INTEGRATION].gt_antojados.food_place_event_stream
    SET consumed_by_s5 = 1
    WHERE consumed_by_s5 = 0
      AND event_date BETWEEN @first_day AND @last_day;

    UPDATE [ATLX_GT_INTEGRATION].gt_antojados.food_tile_event_stream
    SET consumed_by_s5 = 1
    WHERE consumed_by_s5 = 0
      AND event_date BETWEEN @first_day AND @last_day;

    UPDATE [ATLX_GT_INTEGRATION].gt_antojados.food_tag_event_stream
    SET consumed_by_s5 = 1
    WHERE consumed_by_s5 = 0
      AND event_date BETWEEN @first_day AND @last_day;
END
';
IF OBJECT_ID(N'gt_antojados.usp_s5_aggregate_monthly', 'P') IS NOT NULL EXEC(
    N'DROP PROCEDURE gt_antojados.usp_s5_aggregate_monthly'
);
EXEC sp_executesql @sp;
