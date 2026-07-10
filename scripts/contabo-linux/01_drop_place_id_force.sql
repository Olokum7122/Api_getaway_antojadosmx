-- Step 1: Disable all non-clustered indexes temporarily
DECLARE @idx_sql NVARCHAR(MAX) = N'';
SELECT @idx_sql = @idx_sql + 
    'ALTER INDEX ' + QUOTENAME(i.name) + ' ON antojados_core.biz_posts DISABLE; '
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('antojados_core.biz_posts')
  AND i.name IS NOT NULL
  AND i.is_primary_key = 0;
IF @idx_sql != N'' EXEC sp_executesql @idx_sql;
PRINT 'indexes disabled';

-- Step 2: Remove all FK constraints referencing this table
SET @idx_sql = N'';
SELECT @idx_sql = @idx_sql + 
    'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(fk.schema_id)) + '.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) + 
    ' DROP CONSTRAINT ' + QUOTENAME(fk.name) + '; '
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id = OBJECT_ID('antojados_core.biz_posts');
IF @idx_sql != N'' EXEC sp_executesql @idx_sql;
PRINT 'FKs dropped';

-- Step 3: Remove all default constraints
SET @idx_sql = N'';
SELECT @idx_sql = @idx_sql + 
    'ALTER TABLE antojados_core.biz_posts DROP CONSTRAINT ' + QUOTENAME(dc.name) + '; '
FROM sys.default_constraints dc
WHERE dc.parent_object_id = OBJECT_ID('antojados_core.biz_posts');
IF @idx_sql != N'' EXEC sp_executesql @idx_sql;
PRINT 'defaults dropped';

-- Step 4: Remove all check constraints
SET @idx_sql = N'';
SELECT @idx_sql = @idx_sql + 
    'ALTER TABLE antojados_core.biz_posts DROP CONSTRAINT ' + QUOTENAME(cc.name) + '; '
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('antojados_core.biz_posts');
IF @idx_sql != N'' EXEC sp_executesql @idx_sql;
PRINT 'checks dropped';

-- Step 5: Remove all auto-created stats
SET @idx_sql = N'';
SELECT @idx_sql = @idx_sql + 
    'DROP STATISTICS antojados_core.biz_posts.' + QUOTENAME(s.name) + '; '
FROM sys.stats s
WHERE s.object_id = OBJECT_ID('antojados_core.biz_posts')
  AND s.auto_created = 1;
IF @idx_sql != N'' EXEC sp_executesql @idx_sql;
PRINT 'stats dropped';

-- Step 6: Now drop place_id
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'place_id')
BEGIN
    ALTER TABLE antojados_core.biz_posts DROP COLUMN place_id;
    PRINT 'place_id dropped';
END
ELSE
    PRINT 'place_id already gone';
GO

-- Step 7: Rebuild indexes
DECLARE @ridx NVARCHAR(MAX) = N'';
SELECT @ridx = @ridx + 
    'ALTER INDEX ' + QUOTENAME(i.name) + ' ON antojados_core.biz_posts REBUILD; '
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('antojados_core.biz_posts')
  AND i.name IS NOT NULL
  AND i.is_primary_key = 0
  AND i.is_disabled = 1;
IF @ridx != N'' EXEC sp_executesql @ridx;
PRINT 'indexes rebuilt';
GO
