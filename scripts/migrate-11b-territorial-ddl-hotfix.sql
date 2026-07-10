SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;

-- Hotfix DDL puro para evitar problemas de compilacion por columnas agregadas
-- y referenciadas en el mismo batch.

USE ATLX_ANTOJADOS_APP;

IF OBJECT_ID(N'antojados_core.geo_scope_catalog', N'U') IS NULL
EXEC(N'
CREATE TABLE antojados_core.geo_scope_catalog (
  scope_code        NVARCHAR(64)  NOT NULL PRIMARY KEY,
  scope_level       NVARCHAR(20)  NOT NULL,
  scope_label       NVARCHAR(120) NOT NULL,
  parent_scope_code NVARCHAR(64)  NULL,
  country_code      NVARCHAR(10)  NULL,
  city_code         NVARCHAR(30)  NULL,
  zone_code         NVARCHAR(30)  NULL,
  status            NVARCHAR(20)  NOT NULL DEFAULT (N''active''),
  created_at        DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at        DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
)');

IF OBJECT_ID(N'antojados_core.geo_place_scope_map', N'U') IS NULL
EXEC(N'
CREATE TABLE antojados_core.geo_place_scope_map (
  place_id          NVARCHAR(64)  NOT NULL PRIMARY KEY,
  city_code         NVARCHAR(30)  NULL,
  zone_code         NVARCHAR(30)  NULL,
  municipality_code NVARCHAR(30)  NULL,
  lat               FLOAT         NULL,
  lng               FLOAT         NULL,
  google_place_id   NVARCHAR(128) NULL,
  source_type       NVARCHAR(20)  NOT NULL DEFAULT (N''manual''),
  resolved_at       DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at        DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
)');

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

USE ATLX_GT_INTEGRATION;

IF COL_LENGTH(N'gt_antojados.food_place_event_stream', N'zone_code') IS NULL
    ALTER TABLE gt_antojados.food_place_event_stream ADD zone_code NVARCHAR(30) NULL;
IF COL_LENGTH(N'gt_antojados.food_city_event_stream', N'zone_code') IS NULL
    ALTER TABLE gt_antojados.food_city_event_stream ADD zone_code NVARCHAR(30) NULL;

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
