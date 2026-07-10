-- ============================================================
-- Migración: biz_posts → columnas FINALES
-- ============================================================

-- 1. Eliminar dependencias (FK, indices, default constraints)
DECLARE @sql NVARCHAR(MAX) = N'';

-- Drop FK references from biz_post_media
SELECT @sql = @sql + N'ALTER TABLE antojados_core.biz_post_media DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';'
FROM sys.foreign_keys fk
WHERE fk.parent_object_id = OBJECT_ID('antojados_core.biz_post_media')
  AND fk.referenced_object_id = OBJECT_ID('antojados_core.biz_posts');

-- Drop FK references from biz_post_interactions (if exists)
SELECT @sql = @sql + N'ALTER TABLE antojados_core.biz_post_interactions DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';'
FROM sys.foreign_keys fk
WHERE fk.parent_object_id = OBJECT_ID('antojados_core.biz_post_interactions')
  AND fk.referenced_object_id = OBJECT_ID('antojados_core.biz_posts');

-- Drop default constraints on columns we will modify
SELECT @sql = @sql + N'ALTER TABLE antojados_core.biz_posts DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';'
FROM sys.default_constraints dc
WHERE dc.parent_object_id = OBJECT_ID('antojados_core.biz_posts')
  AND dc.parent_column_id IN (
    SELECT column_id FROM sys.columns 
    WHERE object_id = OBJECT_ID('antojados_core.biz_posts')
    AND name IN ('post_type','publication_type','title','body','media_type','cta_label','cta_url','starts_at','ends_at','sponsored','sponsored_priority','updated_at','category')
  );

-- Drop indexes on columns to be dropped
SELECT @sql = @sql + N'DROP INDEX ' + QUOTENAME(idx.name) + N' ON antojados_core.biz_posts;'
FROM sys.index_columns ic
JOIN sys.indexes idx ON idx.object_id = ic.object_id AND idx.index_id = ic.index_id
WHERE ic.object_id = OBJECT_ID('antojados_core.biz_posts')
  AND idx.name IS NOT NULL
  AND ic.column_id IN (
    SELECT column_id FROM sys.columns 
    WHERE object_id = OBJECT_ID('antojados_core.biz_posts')
    AND name IN ('post_type','publication_type','category')
  );

EXEC sp_executesql @sql;
GO

-- 2. Drop columns LEGACY from biz_posts
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'place_id')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN place_id;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'post_type')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN post_type;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'publication_type')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN publication_type;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'title')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN title;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'body')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN body;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'media_type')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN media_type;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'cta_label')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN cta_label;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'cta_url')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN cta_url;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'starts_at')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN starts_at;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'ends_at')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN ends_at;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'sponsored')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN sponsored;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'sponsored_priority')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN sponsored_priority;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'updated_at')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN updated_at;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'category')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN category;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'publisher_user_id')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN publisher_user_id;
GO

-- 3. Add NEW columns that may be missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'engagement_score')
    ALTER TABLE antojados_core.biz_posts ADD engagement_score DECIMAL(10,4) NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'taps_whatsapp_count')
    ALTER TABLE antojados_core.biz_posts ADD taps_whatsapp_count INT NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'taps_maps_count')
    ALTER TABLE antojados_core.biz_posts ADD taps_maps_count INT NOT NULL DEFAULT 0;
GO

-- 4. Add sponsor_id if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'sponsor_id')
    ALTER TABLE antojados_core.biz_posts ADD sponsor_id NVARCHAR(64) NULL;
GO

-- 5. Backfill sponsor_id from publisher_user_id
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'sponsor_id')
   AND EXISTS (SELECT 1 FROM antojados_core.biz_posts WHERE sponsor_id IS NULL)
BEGIN
    UPDATE antojados_core.biz_posts SET sponsor_id = biz_post_id WHERE sponsor_id IS NULL;
END
GO

-- 6. Recreate indexes clean
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_biz_posts_sponsor_id' AND object_id = OBJECT_ID('antojados_core.biz_posts'))
    CREATE NONCLUSTERED INDEX IX_biz_posts_sponsor_id ON antojados_core.biz_posts (sponsor_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_biz_posts_channel' AND object_id = OBJECT_ID('antojados_core.biz_posts'))
    CREATE NONCLUSTERED INDEX IX_biz_posts_channel ON antojados_core.biz_posts (channel);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_biz_posts_created_at' AND object_id = OBJECT_ID('antojados_core.biz_posts'))
    CREATE NONCLUSTERED INDEX IX_biz_posts_created_at ON antojados_core.biz_posts (created_at DESC);
GO

PRINT '✅ biz_posts migration complete';
GO
