-- ============================================================
-- MIGRACION: biz_posts → columnas FINALES
-- ============================================================

-- Drop FKs that reference biz_posts
DECLARE @fk_sql NVARCHAR(MAX);
SELECT @fk_sql = STRING_AGG('ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(fk.schema_id)) + '.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) + ' DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';', ' ')
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id = OBJECT_ID('antojados_core.biz_posts');
IF @fk_sql IS NOT NULL EXEC sp_executesql @fk_sql;
PRINT 'Fks dropped';

-- Drop default constraints on legacy columns
DECLARE @dc_sql NVARCHAR(MAX);
SELECT @dc_sql = STRING_AGG('ALTER TABLE antojados_core.biz_posts DROP CONSTRAINT ' + QUOTENAME(dc.name) + ';', ' ')
FROM sys.default_constraints dc
WHERE dc.parent_object_id = OBJECT_ID('antojados_core.biz_posts');
IF @dc_sql IS NOT NULL EXEC sp_executesql @dc_sql;
PRINT 'Defaults dropped';

-- Drop indexes that reference legacy columns
DECLARE @idx_sql NVARCHAR(MAX);
SELECT @idx_sql = STRING_AGG('DROP INDEX ' + QUOTENAME(i.name) + ' ON antojados_core.biz_posts;', ' ')
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('antojados_core.biz_posts')
  AND i.name IS NOT NULL
  AND i.name NOT IN ('PK__biz_posts__biz_post_id', 'PK__biz_post__biz_post_id')
  AND i.is_primary_key = 0;
IF @idx_sql IS NOT NULL EXEC sp_executesql @idx_sql;
PRINT 'Indexes dropped';

-- Add NEW columns
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'sponsor_id')
BEGIN
    ALTER TABLE antojados_core.biz_posts ADD sponsor_id NVARCHAR(64) NULL;
    UPDATE antojados_core.biz_posts SET sponsor_id = biz_post_id WHERE sponsor_id IS NULL;
    ALTER TABLE antojados_core.biz_posts ALTER COLUMN sponsor_id NVARCHAR(64) NOT NULL;
    PRINT 'Added sponsor_id';
END
ELSE PRINT 'sponsor_id already exists';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'engagement_score')
BEGIN
    ALTER TABLE antojados_core.biz_posts ADD engagement_score DECIMAL(10,4) NOT NULL DEFAULT 0;
    PRINT 'Added engagement_score';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'taps_whatsapp_count')
BEGIN
    ALTER TABLE antojados_core.biz_posts ADD taps_whatsapp_count INT NOT NULL DEFAULT 0;
    PRINT 'Added taps_whatsapp_count';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'taps_maps_count')
BEGIN
    ALTER TABLE antojados_core.biz_posts ADD taps_maps_count INT NOT NULL DEFAULT 0;
    PRINT 'Added taps_maps_count';
END

-- Drop LEGACY columns (only if they exist)
DECLARE @drop_sql NVARCHAR(MAX) = '';
SELECT @drop_sql = @drop_sql + 'ALTER TABLE antojados_core.biz_posts DROP COLUMN ' + QUOTENAME(c.name) + '; '
FROM sys.columns c
WHERE c.object_id = OBJECT_ID('antojados_core.biz_posts')
  AND c.name IN ('place_id','post_type','publication_type','title','body','media_type','cta_label','cta_url','starts_at','ends_at','sponsored','sponsored_priority','updated_at','category','publisher_user_id');

IF @drop_sql != ''
BEGIN
    EXEC sp_executesql @drop_sql;
    PRINT 'Legacy columns dropped';
END
ELSE PRINT 'No legacy columns to drop';

-- Create indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_biz_posts_sponsor_id' AND object_id = OBJECT_ID('antojados_core.biz_posts'))
    CREATE NONCLUSTERED INDEX IX_biz_posts_sponsor_id ON antojados_core.biz_posts (sponsor_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_biz_posts_channel' AND object_id = OBJECT_ID('antojados_core.biz_posts'))
    CREATE NONCLUSTERED INDEX IX_biz_posts_channel ON antojados_core.biz_posts (channel);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_biz_posts_created_at' AND object_id = OBJECT_ID('antojados_core.biz_posts'))
    CREATE NONCLUSTERED INDEX IX_biz_posts_created_at ON antojados_core.biz_posts (created_at DESC);

PRINT '✅ biz_posts migration complete';
GO
ENDOFSQL