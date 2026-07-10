DECLARE @sql NVARCHAR(MAX); SET @sql = N'';

-- Find all FK constraints referencing biz_posts place_id
SELECT @sql = @sql + 
    'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(fk.schema_id)) + '.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) + 
    ' DROP CONSTRAINT ' + QUOTENAME(fk.name) + '; '
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id = OBJECT_ID('antojados_core.biz_posts');

PRINT @sql;

IF @sql IS NOT NULL AND @sql != ''
    EXEC sp_executesql @sql;

PRINT 'FKs dropped';
GO

-- Find all default constraints on biz_posts
DECLARE @dc NVARCHAR(MAX); SET @dc = N'';
SELECT @dc = @dc + 'ALTER TABLE antojados_core.biz_posts DROP CONSTRAINT ' + QUOTENAME(dc.name) + '; '
FROM sys.default_constraints dc
WHERE dc.parent_object_id = OBJECT_ID('antojados_core.biz_posts');

PRINT @dc;

IF @dc IS NOT NULL AND @dc != ''
    EXEC sp_executesql @dc;

PRINT 'Defaults dropped';
GO

-- Drop stats referencing place_id
DECLARE @st NVARCHAR(MAX); SET @st = N'';
SELECT @st = @st + 'DROP STATISTICS antojados_core.biz_posts.' + QUOTENAME(s.name) + '; '
FROM sys.stats s
WHERE s.object_id = OBJECT_ID('antojados_core.biz_posts')
  AND s.auto_created = 1;

PRINT @st;

IF @st IS NOT NULL AND @st != ''
    EXEC sp_executesql @st;

PRINT 'Stats dropped';
GO

-- Drop CHECK constraints referencing place_id
DECLARE @ch NVARCHAR(MAX); SET @ch = N'';
SELECT @ch = @ch + 'ALTER TABLE antojados_core.biz_posts DROP CONSTRAINT ' + QUOTENAME(cc.name) + '; '
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('antojados_core.biz_posts');

PRINT @ch;

IF @ch IS NOT NULL AND @ch != ''
    EXEC sp_executesql @ch;

PRINT 'Checks dropped';
GO

-- Now drop place_id
ALTER TABLE antojados_core.biz_posts DROP COLUMN place_id;
PRINT 'place_id dropped';
GO
