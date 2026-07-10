SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
-- =============================================================================
-- migrate-11-territorial-scope-v2.sql
-- Ejecutar contra SQL Server de Contabo.
-- Idempotente: seguro de re-ejecutar.
-- Objetivo:
--   - ampliar el modelo territorial sin romper city_code
--   - preparar scope_level/scope_code/zone_code
--   - mantener compatibilidad con el consumo actual por SPs
-- =============================================================================
SET NOCOUNT ON;

-- =============================================================================
-- APP DB: tablas base de ubicacion y ampliaciones owner
-- =============================================================================
USE ATLX_ANTOJADOS_APP;

IF NOT EXISTS (
    SELECT 1 FROM sys.schemas WHERE name = N'antojados_core'
) EXEC(N'CREATE SCHEMA antojados_core');

IF OBJECT_ID(N'antojados_core.geo_scope_catalog', N'U') IS NULL
EXEC(N'
CREATE TABLE antojados_core.geo_scope_catalog (
  scope_code        NVARCHAR(64)  NOT NULL
    CONSTRAINT PK_geo_scope_catalog PRIMARY KEY,
  scope_level       NVARCHAR(20)  NOT NULL,
  scope_label       NVARCHAR(120) NOT NULL,
  parent_scope_code NVARCHAR(64)  NULL,
  country_code      NVARCHAR(10)  NULL,
  city_code         NVARCHAR(30)  NULL,
  zone_code         NVARCHAR(30)  NULL,
  status            NVARCHAR(20)  NOT NULL CONSTRAINT DF_geo_scope_catalog_status DEFAULT (N''active''),
  created_at        DATETIME2(3)  NOT NULL CONSTRAINT DF_geo_scope_catalog_created DEFAULT SYSUTCDATETIME(),
  updated_at        DATETIME2(3)  NOT NULL CONSTRAINT DF_geo_scope_catalog_updated DEFAULT SYSUTCDATETIME()
)');

IF OBJECT_ID(N'antojados_core.geo_place_scope_map', N'U') IS NULL
EXEC(N'
CREATE TABLE antojados_core.geo_place_scope_map (
  place_id          NVARCHAR(64)  NOT NULL
    CONSTRAINT PK_geo_place_scope_map PRIMARY KEY,
  city_code         NVARCHAR(30)  NULL,
  zone_code         NVARCHAR(30)  NULL,
  municipality_code NVARCHAR(30)  NULL,
  lat               FLOAT         NULL,
  lng               FLOAT         NULL,
  google_place_id   NVARCHAR(128) NULL,
  source_type       NVARCHAR(20)  NOT NULL CONSTRAINT DF_geo_place_scope_map_source DEFAULT (N''manual''),
  resolved_at       DATETIME2(3)  NOT NULL CONSTRAINT DF_geo_place_scope_map_resolved DEFAULT SYSUTCDATETIME(),
  updated_at        DATETIME2(3)  NOT NULL CONSTRAINT DF_geo_place_scope_map_updated DEFAULT SYSUTCDATETIME()
)');

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_geo_place_scope_map_city_zone'
      AND object_id = OBJECT_ID(N'antojados_core.geo_place_scope_map')
) EXEC(N'CREATE INDEX IX_geo_place_scope_map_city_zone
  ON antojados_core.geo_place_scope_map (city_code, zone_code)');

IF COL_LENGTH(N'antojados_core.soc_places', N'zone_code') IS NULL
    ALTER TABLE antojados_core.soc_places ADD zone_code NVARCHAR(30) NULL;

IF COL_LENGTH(N'antojados_core.soc_places', N'municipality_code') IS NULL
    ALTER TABLE antojados_core.soc_places ADD municipality_code NVARCHAR(30) NULL;

IF COL_LENGTH(N'antojados_feed.feed_top_places', N'scope_level') IS NULL
    ALTER TABLE antojados_feed.feed_top_places ADD scope_level NVARCHAR(20) NULL;

IF COL_LENGTH(N'antojados_feed.feed_top_places', N'scope_code') IS NULL
    ALTER TABLE antojados_feed.feed_top_places ADD scope_code NVARCHAR(64) NULL;

IF COL_LENGTH(N'antojados_feed.feed_top_places', N'zone_code') IS NULL
    ALTER TABLE antojados_feed.feed_top_places ADD zone_code NVARCHAR(30) NULL;

IF COL_LENGTH(N'antojados_feed.feed_items', N'scope_level') IS NULL
    ALTER TABLE antojados_feed.feed_items ADD scope_level NVARCHAR(20) NULL;

IF COL_LENGTH(N'antojados_feed.feed_items', N'scope_code') IS NULL
    ALTER TABLE antojados_feed.feed_items ADD scope_code NVARCHAR(64) NULL;

IF COL_LENGTH(N'antojados_feed.feed_items', N'zone_code') IS NULL
    ALTER TABLE antojados_feed.feed_items ADD zone_code NVARCHAR(30) NULL;

IF COL_LENGTH(N'antojados_feed.feed_biz_items', N'scope_level') IS NULL
    ALTER TABLE antojados_feed.feed_biz_items ADD scope_level NVARCHAR(20) NULL;

IF COL_LENGTH(N'antojados_feed.feed_biz_items', N'scope_code') IS NULL
    ALTER TABLE antojados_feed.feed_biz_items ADD scope_code NVARCHAR(64) NULL;

IF COL_LENGTH(N'antojados_feed.feed_biz_items', N'zone_code') IS NULL
    ALTER TABLE antojados_feed.feed_biz_items ADD zone_code NVARCHAR(30) NULL;

MERGE antojados_core.geo_scope_catalog AS tgt
USING (
    SELECT
      N'MX'         AS scope_code,
      N'mexico'     AS scope_level,
      N'México'     AS scope_label,
      CAST(NULL AS NVARCHAR(64)) AS parent_scope_code,
      N'MX'         AS country_code,
      CAST(NULL AS NVARCHAR(30)) AS city_code,
      CAST(NULL AS NVARCHAR(30)) AS zone_code
) AS src
ON tgt.scope_code = src.scope_code
WHEN MATCHED THEN
  UPDATE SET
    tgt.scope_level = src.scope_level,
    tgt.scope_label = src.scope_label,
    tgt.parent_scope_code = src.parent_scope_code,
    tgt.country_code = src.country_code,
    tgt.city_code = src.city_code,
    tgt.zone_code = src.zone_code,
    tgt.updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (scope_code, scope_level, scope_label, parent_scope_code, country_code, city_code, zone_code)
  VALUES (src.scope_code, src.scope_level, src.scope_label, src.parent_scope_code, src.country_code, src.city_code, src.zone_code);

MERGE antojados_core.geo_scope_catalog AS tgt
USING (
    SELECT DISTINCT
      sp.city_code              AS scope_code,
      N'ciudad'                 AS scope_level,
      ISNULL(NULLIF(sp.city_code, N''), N'UNKNOWN') AS scope_label,
      N'MX'                     AS parent_scope_code,
      N'MX'                     AS country_code,
      sp.city_code              AS city_code,
      ISNULL(sp.zone_code, sp.city_code) AS zone_code
    FROM antojados_core.soc_places sp
    WHERE sp.city_code IS NOT NULL
) AS src
ON tgt.scope_code = src.scope_code
WHEN MATCHED THEN
  UPDATE SET
    tgt.scope_level = src.scope_level,
    tgt.scope_label = src.scope_label,
    tgt.parent_scope_code = src.parent_scope_code,
    tgt.country_code = src.country_code,
    tgt.city_code = src.city_code,
    tgt.zone_code = src.zone_code,
    tgt.updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (scope_code, scope_level, scope_label, parent_scope_code, country_code, city_code, zone_code)
  VALUES (src.scope_code, src.scope_level, src.scope_label, src.parent_scope_code, src.country_code, src.city_code, src.zone_code);

UPDATE antojados_core.soc_places
SET zone_code = ISNULL(zone_code, city_code)
WHERE city_code IS NOT NULL
  AND zone_code IS NULL;

MERGE antojados_core.geo_place_scope_map AS tgt
USING (
    SELECT
      sp.place_id,
      sp.city_code,
      ISNULL(sp.zone_code, sp.city_code) AS zone_code,
      sp.municipality_code,
      sp.lat,
      sp.lng,
      sp.google_place_id,
      N'manual' AS source_type
    FROM antojados_core.soc_places sp
    WHERE sp.place_id IS NOT NULL
) AS src
ON tgt.place_id = src.place_id
WHEN MATCHED THEN
  UPDATE SET
    tgt.city_code = src.city_code,
    tgt.zone_code = src.zone_code,
    tgt.municipality_code = src.municipality_code,
    tgt.lat = src.lat,
    tgt.lng = src.lng,
    tgt.google_place_id = src.google_place_id,
    tgt.source_type = src.source_type,
    tgt.updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (place_id, city_code, zone_code, municipality_code, lat, lng, google_place_id, source_type)
  VALUES (src.place_id, src.city_code, src.zone_code, src.municipality_code, src.lat, src.lng, src.google_place_id, src.source_type);

UPDATE ftp
SET
  ftp.scope_level = COALESCE(ftp.scope_level, N'ciudad'),
  ftp.scope_code  = COALESCE(ftp.scope_code, ftp.city_code),
  ftp.zone_code   = COALESCE(ftp.zone_code, gps.zone_code, sp.zone_code, ftp.city_code)
FROM antojados_feed.feed_top_places ftp
LEFT JOIN antojados_core.soc_places sp
  ON sp.place_id = ftp.place_id
LEFT JOIN antojados_core.geo_place_scope_map gps
  ON gps.place_id = ftp.place_id;

UPDATE fi
SET
  fi.scope_level = COALESCE(fi.scope_level, N'ciudad'),
  fi.scope_code  = COALESCE(fi.scope_code, fi.city_code),
  fi.zone_code   = COALESCE(fi.zone_code, gps.zone_code, sp.zone_code, fi.city_code)
FROM antojados_feed.feed_items fi
LEFT JOIN antojados_core.soc_places sp
  ON sp.place_id = fi.place_id
LEFT JOIN antojados_core.geo_place_scope_map gps
  ON gps.place_id = fi.place_id;

UPDATE fbi
SET
  fbi.scope_level = COALESCE(fbi.scope_level, N'ciudad'),
  fbi.scope_code  = COALESCE(fbi.scope_code, fbi.city_code),
  fbi.zone_code   = COALESCE(fbi.zone_code, gps.zone_code, sp.zone_code, fbi.city_code)
FROM antojados_feed.feed_biz_items fbi
LEFT JOIN antojados_core.soc_places sp
  ON sp.place_id = fbi.place_id
LEFT JOIN antojados_core.geo_place_scope_map gps
  ON gps.place_id = fbi.place_id;

-- =============================================================================
-- INTEGRATION DB: columnas nuevas en streams territoriales
-- =============================================================================
USE ATLX_GT_INTEGRATION;

IF COL_LENGTH(N'gt_antojados.food_place_event_stream', N'zone_code') IS NULL
    ALTER TABLE gt_antojados.food_place_event_stream ADD zone_code NVARCHAR(30) NULL;

IF COL_LENGTH(N'gt_antojados.food_city_event_stream', N'zone_code') IS NULL
    ALTER TABLE gt_antojados.food_city_event_stream ADD zone_code NVARCHAR(30) NULL;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_fpes_zone'
      AND object_id = OBJECT_ID(N'gt_antojados.food_place_event_stream')
) EXEC(N'CREATE INDEX IX_fpes_zone ON gt_antojados.food_place_event_stream (zone_code, event_date)');

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_fces_zone'
      AND object_id = OBJECT_ID(N'gt_antojados.food_city_event_stream')
) EXEC(N'CREATE INDEX IX_fces_zone ON gt_antojados.food_city_event_stream (zone_code, event_date)');

UPDATE fpes
SET zone_code = COALESCE(fpes.zone_code, gps.zone_code, sp.zone_code, fpes.city_code)
FROM gt_antojados.food_place_event_stream fpes
LEFT JOIN [ATLX_ANTOJADOS_APP].antojados_core.soc_places sp
  ON sp.place_id = fpes.place_id
LEFT JOIN [ATLX_ANTOJADOS_APP].antojados_core.geo_place_scope_map gps
  ON gps.place_id = fpes.place_id;

UPDATE fces
SET zone_code = COALESCE(fces.zone_code, gsc.zone_code, fces.city_code)
FROM gt_antojados.food_city_event_stream fces
LEFT JOIN [ATLX_ANTOJADOS_APP].antojados_core.geo_scope_catalog gsc
  ON gsc.scope_code = fces.city_code
 AND gsc.scope_level = N'ciudad';

-- =============================================================================
-- ANALYTICS DB: columnas nuevas en materializados y capas territoriales
-- =============================================================================
USE ATLX_GT_ANALYTICS;

IF COL_LENGTH(N'gt_antojados.food_engagement_pmonth', N'zone_code') IS NULL
    ALTER TABLE gt_antojados.food_engagement_pmonth ADD zone_code NVARCHAR(30) NULL;

IF COL_LENGTH(N'gt_antojados.food_engagement_pmonth', N'scope_level') IS NULL
    ALTER TABLE gt_antojados.food_engagement_pmonth ADD scope_level NVARCHAR(20) NULL;

IF COL_LENGTH(N'gt_antojados.food_engagement_pmonth', N'scope_code') IS NULL
    ALTER TABLE gt_antojados.food_engagement_pmonth ADD scope_code NVARCHAR(64) NULL;

IF COL_LENGTH(N'gt_antojados.food_place_score_pmonth', N'zone_code') IS NULL
    ALTER TABLE gt_antojados.food_place_score_pmonth ADD zone_code NVARCHAR(30) NULL;

IF COL_LENGTH(N'gt_antojados.food_place_score_pmonth', N'scope_level') IS NULL
    ALTER TABLE gt_antojados.food_place_score_pmonth ADD scope_level NVARCHAR(20) NULL;

IF COL_LENGTH(N'gt_antojados.food_place_score_pmonth', N'scope_code') IS NULL
    ALTER TABLE gt_antojados.food_place_score_pmonth ADD scope_code NVARCHAR(64) NULL;

IF COL_LENGTH(N'gt_antojados.food_biz_post_engagement_pmonth', N'tenant_instance_id') IS NULL
    ALTER TABLE gt_antojados.food_biz_post_engagement_pmonth ADD tenant_instance_id NVARCHAR(64) NULL;

IF COL_LENGTH(N'gt_antojados.food_biz_post_engagement_pmonth', N'zone_code') IS NULL
    ALTER TABLE gt_antojados.food_biz_post_engagement_pmonth ADD zone_code NVARCHAR(30) NULL;

IF COL_LENGTH(N'gt_antojados.food_biz_post_engagement_pmonth', N'scope_level') IS NULL
    ALTER TABLE gt_antojados.food_biz_post_engagement_pmonth ADD scope_level NVARCHAR(20) NULL;

IF COL_LENGTH(N'gt_antojados.food_biz_post_engagement_pmonth', N'scope_code') IS NULL
    ALTER TABLE gt_antojados.food_biz_post_engagement_pmonth ADD scope_code NVARCHAR(64) NULL;

IF COL_LENGTH(N'gt_antojados.food_territorial_activity', N'zone_code') IS NULL
    ALTER TABLE gt_antojados.food_territorial_activity ADD zone_code NVARCHAR(30) NULL;

IF COL_LENGTH(N'gt_antojados.food_territorial_activity', N'scope_level') IS NULL
    ALTER TABLE gt_antojados.food_territorial_activity ADD scope_level NVARCHAR(20) NULL;

IF COL_LENGTH(N'gt_antojados.food_territorial_activity', N'scope_code') IS NULL
    ALTER TABLE gt_antojados.food_territorial_activity ADD scope_code NVARCHAR(64) NULL;

IF COL_LENGTH(N'gt_antojados.food_nightlife_activity', N'zone_code') IS NULL
    ALTER TABLE gt_antojados.food_nightlife_activity ADD zone_code NVARCHAR(30) NULL;

IF COL_LENGTH(N'gt_antojados.food_nightlife_activity', N'scope_level') IS NULL
    ALTER TABLE gt_antojados.food_nightlife_activity ADD scope_level NVARCHAR(20) NULL;

IF COL_LENGTH(N'gt_antojados.food_nightlife_activity', N'scope_code') IS NULL
    ALTER TABLE gt_antojados.food_nightlife_activity ADD scope_code NVARCHAR(64) NULL;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_fps_scope'
      AND object_id = OBJECT_ID(N'gt_antojados.food_place_score_pmonth')
) EXEC(N'CREATE INDEX IX_fps_scope
  ON gt_antojados.food_place_score_pmonth (scope_level, scope_code, period_year, period_month)');

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_fbpe_instance_scope'
      AND object_id = OBJECT_ID(N'gt_antojados.food_biz_post_engagement_pmonth')
) EXEC(N'CREATE INDEX IX_fbpe_instance_scope
  ON gt_antojados.food_biz_post_engagement_pmonth (tenant_instance_id, scope_level, scope_code, period_year, period_month)');

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_fta_scope'
      AND object_id = OBJECT_ID(N'gt_antojados.food_territorial_activity')
) EXEC(N'CREATE INDEX IX_fta_scope
  ON gt_antojados.food_territorial_activity (scope_level, scope_code, activity_date)');
