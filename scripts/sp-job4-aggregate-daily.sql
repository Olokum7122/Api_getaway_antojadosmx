SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
-- =============================================================================
-- sp-job4-aggregate-daily.sql
-- Ejecutar contra: ATLX_GT_ANALYTICS
-- sqlcmd -S 185.187.235.253 -U sa -P "..." -C -d ATLX_GT_ANALYTICS
--        -i sp-job4-aggregate-daily.sql
-- Idempotente: DROP + CREATE via sp_executesql.
-- SP: usp_s5_aggregate_daily  (Job J4 — agrega actividad territorial diaria)
-- Descripcion: Lee food_city_event_stream (GT_INTEGRATION) con consumed_by_s5=0
--   y materializa en food_territorial_activity y food_nightlife_activity
--   (ambas en GT_ANALYTICS). Marca los registros consumidos al final.
-- Prerequisito: migrate-03 (streams) y migrate-04 (analytics nuevas) aplicados.
-- §5.6 / §5.9 Job J4
-- =============================================================================
USE ATLX_GT_ANALYTICS;
SET NOCOUNT ON;
DECLARE @sp NVARCHAR(MAX) = N'';
SET @sp = N'
CREATE PROCEDURE gt_antojados.usp_s5_aggregate_daily
    @run_date DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Por defecto procesa el dia anterior (UTC)
    IF @run_date IS NULL
        SET @run_date = CAST(DATEADD(day, -1, GETUTCDATE()) AS DATE);

    -- -------------------------------------------------------------------------
    -- Paso 1: Cargar eventos del dia en tabla temporal
    -- -------------------------------------------------------------------------
    SELECT
        city_code,
        barrio_code,
        zone_code,
        N''ciudad'' AS scope_level,
        city_code AS scope_code,
        event_type,
        hour_bucket,
        event_date,
        SUM(event_count) AS event_count
    INTO #src
    FROM [ATLX_GT_INTEGRATION].gt_antojados.food_city_event_stream
    WHERE consumed_by_s5 = 0
      AND event_date     <= @run_date
    GROUP BY city_code, barrio_code, zone_code, event_type, hour_bucket, event_date;

    -- -------------------------------------------------------------------------
    -- Paso 2: MERGE -> food_territorial_activity
    -- -------------------------------------------------------------------------
    MERGE gt_antojados.food_territorial_activity AS tgt
    USING #src AS src
    ON  tgt.city_code     = src.city_code
    AND tgt.barrio_code   = src.barrio_code
    AND tgt.event_type    = src.event_type
    AND tgt.hour_bucket   = src.hour_bucket
    AND tgt.activity_date = src.event_date
    WHEN MATCHED THEN
        UPDATE SET
            tgt.event_count = tgt.event_count + src.event_count,
            tgt.zone_code   = src.zone_code,
            tgt.scope_level = src.scope_level,
            tgt.scope_code  = src.scope_code,
            tgt.computed_at = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (activity_id, city_code, barrio_code, zone_code, scope_level, scope_code, event_type,
                event_count, hour_bucket, activity_date, computed_at)
        VALUES (NEWID(), src.city_code, src.barrio_code, src.zone_code, src.scope_level, src.scope_code, src.event_type,
                src.event_count, src.hour_bucket, src.event_date, SYSUTCDATETIME());

    -- -------------------------------------------------------------------------
    -- Paso 3: MERGE -> food_nightlife_activity
    --   Solo horas nocturnas: 20-23 y 0-4 UTC
    --   Clasificacion: arre_event_viewed -> ''arre_event'', resto -> ''post_nightlife''
    -- -------------------------------------------------------------------------
    ;WITH nightlife_src AS (
        SELECT
            city_code,
            barrio_code,
            zone_code,
            scope_level,
            scope_code,
            CASE
                WHEN event_type = N''arre_event_viewed'' THEN N''arre_event''
                ELSE N''post_nightlife''
            END AS activity_type,
            hour_bucket,
            event_date,
            SUM(event_count) AS event_count
        FROM #src
        WHERE hour_bucket IN (20, 21, 22, 23, 0, 1, 2, 3, 4)
        GROUP BY
            city_code, barrio_code, zone_code, scope_level, scope_code, hour_bucket, event_date,
            CASE
                WHEN event_type = N''arre_event_viewed'' THEN N''arre_event''
                ELSE N''post_nightlife''
            END
    )
    MERGE gt_antojados.food_nightlife_activity AS tgt
    USING nightlife_src AS src
    ON  tgt.city_code     = src.city_code
    AND tgt.barrio_code   = src.barrio_code
    AND tgt.activity_type = src.activity_type
    AND tgt.hour_bucket   = src.hour_bucket
    AND tgt.activity_date = src.event_date
    WHEN MATCHED THEN
        UPDATE SET
            tgt.event_count = tgt.event_count + src.event_count,
            tgt.zone_code   = src.zone_code,
            tgt.scope_level = src.scope_level,
            tgt.scope_code  = src.scope_code,
            tgt.computed_at = SYSUTCDATETIME()
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (nightlife_id, city_code, barrio_code, zone_code, scope_level, scope_code, place_id, activity_type,
                event_count, hour_bucket, activity_date, computed_at)
        VALUES (NEWID(), src.city_code, src.barrio_code, src.zone_code, src.scope_level, src.scope_code, NULL, src.activity_type,
                src.event_count, src.hour_bucket, src.event_date, SYSUTCDATETIME());

    DROP TABLE #src;

    -- -------------------------------------------------------------------------
    -- Paso 4: Marcar consumidos en GT_INTEGRATION
    -- -------------------------------------------------------------------------
    UPDATE [ATLX_GT_INTEGRATION].gt_antojados.food_city_event_stream
    SET consumed_by_s5 = 1
    WHERE consumed_by_s5 = 0
      AND event_date    <= @run_date;
END
';
IF OBJECT_ID(N'gt_antojados.usp_s5_aggregate_daily', 'P') IS NOT NULL EXEC(
    N'DROP PROCEDURE gt_antojados.usp_s5_aggregate_daily'
);
EXEC sp_executesql @sp;
