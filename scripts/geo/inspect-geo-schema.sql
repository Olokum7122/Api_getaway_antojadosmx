SELECT
  s.name AS schema_name,
  t.name AS table_name,
  c.name AS column_name,
  ty.name AS data_type,
  c.max_length,
  c.is_nullable
FROM sys.tables AS t
INNER JOIN sys.schemas AS s
  ON s.schema_id = t.schema_id
INNER JOIN sys.columns AS c
  ON c.object_id = t.object_id
INNER JOIN sys.types AS ty
  ON ty.user_type_id = c.user_type_id
WHERE s.name IN ('antojados_core', 'antojados_feed', 'gt_sync')
  AND (
    t.name LIKE '%geo%'
    OR t.name LIKE '%scope%'
    OR t.name LIKE '%place%'
    OR c.name IN ('lat', 'lng', 'latitude', 'longitude', 'city_code', 'zone_code', 'municipality_code', 'google_place_id')
  )
ORDER BY s.name, t.name, c.column_id;

SELECT
  OBJECT_SCHEMA_NAME(fk.parent_object_id) AS child_schema,
  OBJECT_NAME(fk.parent_object_id) AS child_table,
  fk.name AS foreign_key_name,
  OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS parent_schema,
  OBJECT_NAME(fk.referenced_object_id) AS parent_table
FROM sys.foreign_keys AS fk
WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id) IN ('antojados_core', 'antojados_feed', 'gt_sync')
  AND (
    OBJECT_NAME(fk.parent_object_id) LIKE '%geo%'
    OR OBJECT_NAME(fk.parent_object_id) LIKE '%scope%'
    OR OBJECT_NAME(fk.parent_object_id) LIKE '%place%'
    OR OBJECT_NAME(fk.referenced_object_id) LIKE '%geo%'
    OR OBJECT_NAME(fk.referenced_object_id) LIKE '%scope%'
    OR OBJECT_NAME(fk.referenced_object_id) LIKE '%place%'
  )
ORDER BY child_schema, child_table, foreign_key_name;
