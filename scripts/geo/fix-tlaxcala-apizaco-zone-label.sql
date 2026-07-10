SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;

USE ATLX_ANTOJADOS_APP;

UPDATE antojados_core.geo_scope_catalog
SET scope_label = N'Tlaxcala-Apizaco',
    updated_at = SYSUTCDATETIME()
WHERE scope_code = N'NUL_290'
  AND scope_level = N'metro';

UPDATE antojados_core.geo_scope_detection_map
SET zone_label = N'Tlaxcala-Apizaco',
    updated_at = SYSUTCDATETIME()
WHERE zone_scope_code = N'NUL_290'
  AND status = N'active';

SELECT
  catalog.scope_code,
  catalog.scope_label,
  COUNT(detection.detection_id) AS detection_rows
FROM antojados_core.geo_scope_catalog AS catalog
LEFT JOIN antojados_core.geo_scope_detection_map AS detection
  ON detection.zone_scope_code = catalog.scope_code
 AND detection.status = N'active'
WHERE catalog.scope_code = N'NUL_290'
GROUP BY catalog.scope_code, catalog.scope_label;
