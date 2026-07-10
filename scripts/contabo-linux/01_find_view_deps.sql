SELECT DISTINCT 
    OBJECT_NAME(d.referencing_id) AS referencing_object,
    OBJECT_SCHEMA_NAME(d.referencing_id) AS referencing_schema,
    d.is_schema_bound_reference
FROM sys.sql_expression_dependencies d
WHERE d.referenced_entity_name = 'biz_posts'
ORDER BY referencing_object;
GO
