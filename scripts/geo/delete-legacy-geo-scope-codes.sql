BEGIN TRANSACTION;

IF EXISTS (
  SELECT 1
  FROM antojados_core.geo_scope_catalog
  WHERE parent_scope_code IN ('TGZ', 'MX')
    AND scope_code NOT IN ('TGZ', 'MX')
)
BEGIN
  ROLLBACK TRANSACTION;
  THROW 51000, 'No se puede eliminar TGZ/MX: existen scopes hijos fuera del set legacy.', 1;
END;

DELETE FROM antojados_core.geo_scope_catalog
WHERE scope_code = 'TGZ';

DELETE FROM antojados_core.geo_scope_catalog
WHERE scope_code = 'MX';

COMMIT TRANSACTION;

SELECT scope_level, COUNT(*) AS total
FROM antojados_core.geo_scope_catalog
GROUP BY scope_level
ORDER BY scope_level;

SELECT scope_code, scope_level, scope_label, parent_scope_code, country_code, city_code, zone_code, status
FROM antojados_core.geo_scope_catalog
WHERE scope_code IN ('TGZ', 'MX')
ORDER BY scope_code;
