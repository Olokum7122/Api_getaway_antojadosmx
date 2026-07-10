SELECT
  s.name AS schema_name,
  p.name AS procedure_name,
  m.definition
FROM sys.procedures AS p
INNER JOIN sys.schemas AS s
  ON s.schema_id = p.schema_id
LEFT JOIN sys.sql_modules AS m
  ON m.object_id = p.object_id
WHERE s.name IN (N'antojados_core', N'antojados_feed', N'gt_antojados')
  AND (
    p.name LIKE N'%geo%'
    OR p.name LIKE N'%scope%'
    OR p.name LIKE N'%territorial%'
    OR p.name LIKE N'%top_places%'
  )
ORDER BY s.name, p.name;
