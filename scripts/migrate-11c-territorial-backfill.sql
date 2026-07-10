SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;

USE ATLX_ANTOJADOS_APP;

MERGE antojados_core.geo_scope_catalog AS tgt
USING (
    SELECT
      N'MX' AS scope_code,
      N'mexico' AS scope_level,
      N'Mexico' AS scope_label,
      CAST(NULL AS NVARCHAR(64)) AS parent_scope_code,
      N'MX' AS country_code,
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

UPDATE antojados_core.soc_places
SET zone_code = COALESCE(zone_code, city_code)
WHERE city_code IS NOT NULL
  AND zone_code IS NULL;

MERGE antojados_core.geo_scope_catalog AS tgt
USING (
    SELECT DISTINCT
      sp.city_code AS scope_code,
      N'ciudad' AS scope_level,
      COALESCE(NULLIF(sp.city_code, N''), N'UNKNOWN') AS scope_label,
      N'MX' AS parent_scope_code,
      N'MX' AS country_code,
      sp.city_code AS city_code,
      COALESCE(sp.zone_code, sp.city_code) AS zone_code
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

MERGE antojados_core.geo_place_scope_map AS tgt
USING (
    SELECT
      sp.place_id,
      sp.city_code,
      COALESCE(sp.zone_code, sp.city_code) AS zone_code,
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
  ftp.scope_code = COALESCE(ftp.scope_code, ftp.city_code),
  ftp.zone_code = COALESCE(ftp.zone_code, gps.zone_code, sp.zone_code, ftp.city_code)
FROM antojados_feed.feed_top_places ftp
LEFT JOIN antojados_core.soc_places sp ON sp.place_id = ftp.place_id
LEFT JOIN antojados_core.geo_place_scope_map gps ON gps.place_id = ftp.place_id;

UPDATE fi
SET
  fi.scope_level = COALESCE(fi.scope_level, N'ciudad'),
  fi.scope_code = COALESCE(fi.scope_code, fi.city_code),
  fi.zone_code = COALESCE(fi.zone_code, gps.zone_code, sp.zone_code, fi.city_code)
FROM antojados_feed.feed_items fi
LEFT JOIN antojados_core.soc_places sp ON sp.place_id = fi.place_id
LEFT JOIN antojados_core.geo_place_scope_map gps ON gps.place_id = fi.place_id;

UPDATE fbi
SET
  fbi.scope_level = COALESCE(fbi.scope_level, N'ciudad'),
  fbi.scope_code = COALESCE(fbi.scope_code, fbi.city_code),
  fbi.zone_code = COALESCE(fbi.zone_code, gps.zone_code, sp.zone_code, fbi.city_code)
FROM antojados_feed.feed_biz_items fbi
LEFT JOIN antojados_core.soc_places sp ON sp.place_id = fbi.place_id
LEFT JOIN antojados_core.geo_place_scope_map gps ON gps.place_id = fbi.place_id;

USE ATLX_GT_INTEGRATION;

UPDATE fpes
SET zone_code = COALESCE(fpes.zone_code, gps.zone_code, sp.zone_code, fpes.city_code)
FROM gt_antojados.food_place_event_stream fpes
LEFT JOIN [ATLX_ANTOJADOS_APP].antojados_core.soc_places sp ON sp.place_id = fpes.place_id
LEFT JOIN [ATLX_ANTOJADOS_APP].antojados_core.geo_place_scope_map gps ON gps.place_id = fpes.place_id;

UPDATE fces
SET zone_code = COALESCE(fces.zone_code, gsc.zone_code, fces.city_code)
FROM gt_antojados.food_city_event_stream fces
LEFT JOIN [ATLX_ANTOJADOS_APP].antojados_core.geo_scope_catalog gsc
  ON gsc.scope_code = fces.city_code
 AND gsc.scope_level = N'ciudad';
