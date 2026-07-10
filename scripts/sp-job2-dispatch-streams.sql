SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
-- =============================================================================
-- sp-job2-dispatch-streams.sql
-- Ejecutar contra: ATLX_GT_INTEGRATION
-- sqlcmd -S 185.187.235.253 -U sa -P "..." -C -d ATLX_GT_INTEGRATION
--        -i sp-job2-dispatch-streams.sql
-- Idempotente: DROP si existe + CREATE (sin GO, todo en EXEC)
-- usp_fei_dispatch_streams: PROCESSED -> MERGE en 5 tablas de stream
-- Reglas de dispatch §4.12.
-- Prerequisitos: sp-job1 (PROCESSED), migrate-03 (5 stream tables).
-- Scheduling: cada 15 min (ver sp-job-scheduling.sql).
-- NOTA: migrate-01 ya incluye 'DISPATCHED' en CK_fei_status; no se necesita
--       ALTER TABLE aqui.
-- =============================================================================
USE ATLX_GT_INTEGRATION;
SET NOCOUNT ON;

-- Crear schema gt_antojados (idempotente):
IF NOT EXISTS (
    SELECT 1 FROM sys.schemas WHERE name = N'gt_antojados'
) EXEC(N'CREATE SCHEMA gt_antojados')

-- DROP si existe (idempotente):
IF OBJECT_ID(N'gt_antojados.usp_fei_dispatch_streams', N'P') IS NOT NULL
    EXEC(N'DROP PROCEDURE gt_antojados.usp_fei_dispatch_streams')

-- CREATE via variable (multiples += para soportar cuerpos > 4000 chars):
DECLARE @sp NVARCHAR(MAX) = N'';
SET @sp += N'CREATE PROCEDURE gt_antojados.usp_fei_dispatch_streams
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @batchSize INT = 1000;
    DECLARE @today     DATE = CAST(SYSUTCDATETIME() AS DATE);

    -- Tabla temporal del lote con campos resueltos.
    CREATE TABLE #dispatch (
        ingesta_id       NVARCHAR(36)  NOT NULL,
        user_id          NVARCHAR(64)  NULL,
        event_type       NVARCHAR(80)  NOT NULL,
        post_id          NVARCHAR(64)  NULL,
        place_id         NVARCHAR(64)  NULL,
        biz_post_id      NVARCHAR(64)  NULL,
        tile_id          NVARCHAR(64)  NULL,
        source_placement NVARCHAR(50)  NULL,
        barrio_code      NVARCHAR(50)  NULL,
        event_ts         DATETIME2(3)  NOT NULL,
        event_date       DATE          NOT NULL,
        hour_bucket      TINYINT       NOT NULL,
        resolved_place_id NVARCHAR(64) NULL,
        city_code        NVARCHAR(30)  NULL,
        zone_code        NVARCHAR(30)  NULL,
        tenant_id        NVARCHAR(64)  NULL
    );

    INSERT INTO #dispatch
    SELECT TOP (@batchSize)
        ingesta_id, user_id, event_type, post_id, place_id, biz_post_id,
        tile_id, source_placement, barrio_code, event_ts,
        CAST(event_ts AS DATE)                  AS event_date,
        CAST(DATEPART(HOUR, event_ts) AS TINYINT) AS hour_bucket,
        NULL, NULL, NULL, NULL
    FROM  gt_antojados.food_event_ingesta WITH (UPDLOCK, READPAST)
    WHERE status_code = ''PROCESSED''
    ORDER BY event_ts ASC;
';
SET @sp += N'
    -- Resolver place_id: biz_post puede no tener place_id directo.
    UPDATE d
    SET    d.resolved_place_id = ISNULL(d.place_id, bp.place_id)
    FROM   #dispatch d
    LEFT   JOIN [ATLX_ANTOJADOS_APP].[antojados_core].[biz_posts] bp
               ON bp.biz_post_id = d.biz_post_id
    WHERE  d.resolved_place_id IS NULL;

    -- Resolver city_code / zone_code y normalizar barrio_code desde geografia.
    UPDATE d
    SET    d.city_code  = ISNULL(d.city_code,  pl.city_code),
           d.zone_code  = ISNULL(d.zone_code, gps.zone_code),
           d.barrio_code = ISNULL(d.barrio_code, ''GLOBAL'')
    FROM   #dispatch d
    LEFT   JOIN [ATLX_ANTOJADOS_APP].[antojados_core].[geo_place_scope_map] gps
               ON gps.place_id = d.resolved_place_id
    LEFT   JOIN [ATLX_ANTOJADOS_APP].[antojados_core].[soc_places] pl
               ON pl.place_id = d.resolved_place_id;

    -- Fallback para eventos sin place (tile_viewed, etc.).
    UPDATE #dispatch SET city_code  = ''UNKNOWN'' WHERE city_code  IS NULL;
    UPDATE #dispatch SET zone_code  = city_code   WHERE zone_code  IS NULL;
    UPDATE #dispatch SET barrio_code = ''GLOBAL''  WHERE barrio_code IS NULL;
';
SET @sp += N'
    -- ─────────────────────────────────────────────────────────────────────
    -- STREAM 1: food_user_event_stream
    -- Criterio: user_id no nulo; excluir tile_viewed/tile_clicked puros.
    -- ─────────────────────────────────────────────────────────────────────
    MERGE gt_antojados.food_user_event_stream AS tgt
    USING (
        SELECT   user_id, event_type, city_code, event_date, COUNT(*) AS cnt
        FROM     #dispatch
        WHERE    user_id   IS NOT NULL
          AND    event_type NOT IN (''tile_viewed'', ''tile_clicked'')
        GROUP BY user_id, event_type, city_code, event_date
    ) AS src
        ON  tgt.user_id    = src.user_id
        AND tgt.event_type = src.event_type
        AND tgt.city_code  = src.city_code
        AND tgt.event_date = src.event_date
    WHEN MATCHED THEN
        UPDATE SET
            tgt.event_count   = tgt.event_count + src.cnt,
            tgt.aggregated_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (stream_id, user_id, event_type, event_count, city_code, event_date)
        VALUES (NEWID(), src.user_id, src.event_type, src.cnt, src.city_code, src.event_date);
';
SET @sp += N'
    -- ─────────────────────────────────────────────────────────────────────
    -- STREAM 2: food_place_event_stream
    -- Criterio: resolved_place_id no nulo; excluir eventos negativos.
    -- ─────────────────────────────────────────────────────────────────────
    MERGE gt_antojados.food_place_event_stream AS tgt
    USING (
        SELECT   resolved_place_id AS place_id, event_type, city_code,
                 barrio_code, zone_code, event_date, COUNT(*) AS cnt
        FROM     #dispatch
        WHERE    resolved_place_id IS NOT NULL
          AND    event_type NOT IN (''post_unliked'', ''place_unfollowed'', ''place_unsaved'')
        GROUP BY resolved_place_id, event_type, city_code, barrio_code, zone_code, event_date
    ) AS src
        ON  tgt.place_id   = src.place_id
        AND tgt.event_type = src.event_type
        AND tgt.city_code  = src.city_code
        AND tgt.barrio_code = src.barrio_code
        AND tgt.event_date = src.event_date
    WHEN MATCHED THEN
        UPDATE SET
            tgt.event_count   = tgt.event_count + src.cnt,
            tgt.zone_code     = src.zone_code,
            tgt.aggregated_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (stream_id, place_id, event_type, event_count, city_code, barrio_code, zone_code, event_date)
        VALUES (NEWID(), src.place_id, src.event_type, src.cnt, src.city_code, src.barrio_code, src.zone_code, src.event_date);
';
SET @sp += N'
    -- ─────────────────────────────────────────────────────────────────────
    -- STREAM 3: food_city_event_stream
    -- Criterio: contribuye al territorial; excluir negativos y CTAs.
    -- ─────────────────────────────────────────────────────────────────────
    MERGE gt_antojados.food_city_event_stream AS tgt
    USING (
        SELECT   city_code, barrio_code, zone_code, event_type, hour_bucket,
                 event_date, COUNT(*) AS cnt
        FROM     #dispatch
        WHERE    event_type NOT IN (
                     ''post_unliked'', ''place_unfollowed'', ''place_unsaved'',
                     ''place_saved'', ''post_rated'', ''biz_post_liked'',
                     ''reward_redeemed'', ''cta_whatsapp'', ''cta_maps'', ''cta_call''
                 )
        GROUP BY city_code, barrio_code, zone_code, event_type, hour_bucket, event_date
    ) AS src
        ON  tgt.city_code  = src.city_code
        AND tgt.barrio_code = src.barrio_code
        AND tgt.event_type = src.event_type
        AND tgt.hour_bucket = src.hour_bucket
        AND tgt.event_date = src.event_date
    WHEN MATCHED THEN
        UPDATE SET
            tgt.event_count   = tgt.event_count + src.cnt,
            tgt.zone_code     = src.zone_code,
            tgt.aggregated_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (stream_id, city_code, barrio_code, zone_code, event_type, event_count, hour_bucket, event_date)
        VALUES (NEWID(), src.city_code, src.barrio_code, src.zone_code, src.event_type, src.cnt, src.hour_bucket, src.event_date);
';
SET @sp += N'
    -- ─────────────────────────────────────────────────────────────────────
    -- STREAM 4: food_tile_event_stream
    -- Criterio: eventos tile_* con tile_id no nulo.
    -- tenant_id queda como ''UNKNOWN'' hasta que exista tabla de tiles.
    -- ─────────────────────────────────────────────────────────────────────
    MERGE gt_antojados.food_tile_event_stream AS tgt
    USING (
        SELECT   tile_id,
                 ISNULL(tenant_id, ''UNKNOWN'')        AS tenant_id,
                 ISNULL(source_placement, ''unknown'') AS placement,
                 event_type, city_code, event_date,
                 COUNT(*) AS cnt
        FROM     #dispatch
        WHERE    tile_id    IS NOT NULL
          AND    event_type LIKE ''tile_%''
        GROUP BY tile_id, tenant_id, source_placement, event_type, city_code, event_date
    ) AS src
        ON  tgt.tile_id    = src.tile_id
        AND tgt.placement  = src.placement
        AND tgt.event_type = src.event_type
        AND tgt.city_code  = src.city_code
        AND tgt.event_date = src.event_date
    WHEN MATCHED THEN
        UPDATE SET
            tgt.event_count   = tgt.event_count + src.cnt,
            tgt.aggregated_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (stream_id, tile_id, tenant_id, placement, event_type, event_count, city_code, event_date)
        VALUES (NEWID(), src.tile_id, src.tenant_id, src.placement, src.event_type, src.cnt, src.city_code, src.event_date);

    -- Marcar lote como DISPATCHED.
    UPDATE gt_antojados.food_event_ingesta
    SET    status_code = ''DISPATCHED''
    WHERE  ingesta_id IN (SELECT ingesta_id FROM #dispatch);

    DROP TABLE #dispatch;
END';
EXEC sp_executesql @sp;
