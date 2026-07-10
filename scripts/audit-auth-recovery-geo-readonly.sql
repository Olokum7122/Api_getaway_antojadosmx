SET NOCOUNT ON;

USE ATLX_ANTOJADOS_APP;

SELECT
  'auth_password_recovery.table' AS audit_area,
  CASE WHEN OBJECT_ID(N'antojados_core.auth_password_recovery', N'U') IS NULL THEN 0 ELSE 1 END AS exists_flag;

IF OBJECT_ID(N'antojados_core.auth_password_recovery', N'U') IS NOT NULL
BEGIN
  SELECT
    'auth_password_recovery.columns' AS audit_area,
    c.name AS column_name,
    t.name AS data_type,
    c.max_length,
    c.is_nullable
  FROM sys.columns c
  INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID(N'antojados_core.auth_password_recovery')
  ORDER BY c.column_id;

  SELECT
    'auth_password_recovery.counts' AS audit_area,
    status,
    COUNT(1) AS total
  FROM antojados_core.auth_password_recovery
  GROUP BY status
  ORDER BY status;
END;

SELECT
  'auth_identities.contact_columns' AS audit_area,
  c.name AS column_name,
  t.name AS data_type,
  c.max_length,
  c.is_nullable
FROM sys.columns c
INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'antojados_core.auth_identities')
  AND c.name IN (N'email_hash', N'phone_e164', N'password_secret_ref')
ORDER BY c.column_id;

SELECT
  'geo.tables' AS audit_area,
  v.table_name,
  CASE WHEN OBJECT_ID(v.table_name, N'U') IS NULL THEN 0 ELSE 1 END AS exists_flag
FROM (VALUES
  (N'antojados_core.geo_scope_catalog'),
  (N'antojados_core.geo_place_scope_map'),
  (N'antojados_core.soc_places'),
  (N'antojados_feed.feed_items'),
  (N'antojados_feed.feed_biz_items'),
  (N'antojados_feed.feed_top_places')
) AS v(table_name);

IF OBJECT_ID(N'antojados_core.geo_scope_catalog', N'U') IS NOT NULL
BEGIN
  SELECT
    'geo_scope_catalog.counts' AS audit_area,
    scope_level,
    status,
    COUNT(1) AS total
  FROM antojados_core.geo_scope_catalog
  GROUP BY scope_level, status
  ORDER BY scope_level, status;

  SELECT TOP 50
    'geo_scope_catalog.sample' AS audit_area,
    scope_code,
    scope_level,
    scope_label,
    parent_scope_code,
    city_code,
    zone_code,
    status
  FROM antojados_core.geo_scope_catalog
  ORDER BY scope_level, scope_code;
END;

IF OBJECT_ID(N'antojados_core.geo_place_scope_map', N'U') IS NOT NULL
BEGIN
  SELECT
    'geo_place_scope_map.coverage' AS audit_area,
    COUNT(1) AS total_places_mapped,
    SUM(CASE WHEN city_code IS NULL OR LTRIM(RTRIM(city_code)) = N'' THEN 1 ELSE 0 END) AS missing_city_code,
    SUM(CASE WHEN zone_code IS NULL OR LTRIM(RTRIM(zone_code)) = N'' THEN 1 ELSE 0 END) AS missing_zone_code,
    SUM(CASE WHEN municipality_code IS NULL OR LTRIM(RTRIM(municipality_code)) = N'' THEN 1 ELSE 0 END) AS missing_municipality_code,
    SUM(CASE WHEN lat IS NULL OR lng IS NULL THEN 1 ELSE 0 END) AS missing_lat_lng,
    SUM(CASE WHEN google_place_id IS NULL OR LTRIM(RTRIM(google_place_id)) = N'' THEN 1 ELSE 0 END) AS missing_google_place_id
  FROM antojados_core.geo_place_scope_map;

  SELECT
    'geo_place_scope_map.source_type' AS audit_area,
    source_type,
    COUNT(1) AS total
  FROM antojados_core.geo_place_scope_map
  GROUP BY source_type
  ORDER BY source_type;
END;

IF OBJECT_ID(N'antojados_core.soc_places', N'U') IS NOT NULL
BEGIN
  SELECT
    'soc_places.coverage' AS audit_area,
    COUNT(1) AS total_places,
    SUM(CASE WHEN city_code IS NULL OR LTRIM(RTRIM(city_code)) = N'' THEN 1 ELSE 0 END) AS missing_city_code,
    SUM(CASE WHEN zone_code IS NULL OR LTRIM(RTRIM(zone_code)) = N'' THEN 1 ELSE 0 END) AS missing_zone_code,
    SUM(CASE WHEN municipality_code IS NULL OR LTRIM(RTRIM(municipality_code)) = N'' THEN 1 ELSE 0 END) AS missing_municipality_code,
    SUM(CASE WHEN lat IS NULL OR lng IS NULL THEN 1 ELSE 0 END) AS missing_lat_lng,
    SUM(CASE WHEN google_place_id IS NULL OR LTRIM(RTRIM(google_place_id)) = N'' THEN 1 ELSE 0 END) AS missing_google_place_id
  FROM antojados_core.soc_places;
END;
