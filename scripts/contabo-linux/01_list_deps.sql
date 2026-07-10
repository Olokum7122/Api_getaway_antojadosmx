CREATE TABLE #deps (
    id INT IDENTITY(1,1),
    obj_name NVARCHAR(255),
    obj_type NVARCHAR(50)
);

DECLARE @sql NVARCHAR(MAX) = N'';

-- Find all views referencing biz_posts
INSERT INTO #deps (obj_name, obj_type)
SELECT DISTINCT OBJECT_NAME(d.referencing_id), 'view'
FROM sys.sql_expression_dependencies d
WHERE d.referenced_entity_name = 'biz_posts';

-- Find all modules (procs, functions) with SCHEMABINDING referencing biz_posts
INSERT INTO #deps (obj_name, obj_type)
SELECT DISTINCT OBJECT_NAME(d.referencing_id), 'module'
FROM sys.sql_expression_dependencies d
WHERE d.referenced_entity_name = 'biz_posts'
  AND d.is_schema_bound_reference = 1;

SELECT * FROM #deps;

IF NOT EXISTS (SELECT 1 FROM #deps)
    SELECT 'NO DEPS FOUND' AS result;

DROP TABLE #deps;
GO
