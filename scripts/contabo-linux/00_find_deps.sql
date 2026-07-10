
SELECT 
    OBJECT_NAME(d.referencing_id) AS referencing_object,
    d.is_schema_bound_reference
FROM sys.sql_expression_dependencies d
WHERE d.referenced_entity_name = 'biz_posts';
GO
SELECT 
    OBJECT_NAME(i.object_id) AS table_name,
    i.name AS stats_name,
    ic.column_id
FROM sys.stats i
JOIN sys.stats_columns ic ON ic.object_id = i.object_id AND ic.stats_id = i.stats_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID('antojados_core.biz_posts')
  AND c.name = 'place_id';
GO
