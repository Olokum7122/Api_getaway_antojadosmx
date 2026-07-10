-- Drop FKs that reference biz_posts
DECLARE @fk_sql NVARCHAR(MAX);
SELECT @fk_sql = STRING_AGG('ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(fk.schema_id)) + '.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) + ' DROP CONSTRAINT ' + QUOTENAME(fk.name) + ';', ' ')
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id = OBJECT_ID('antojados_core.biz_posts');
IF @fk_sql IS NOT NULL
    EXEC sp_executesql @fk_sql;
GO

-- Add NEW columns
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'sponsor_id')
    ALTER TABLE antojados_core.biz_posts ADD sponsor_id NVARCHAR(64) NULL;
GO

-- Drop LEGACY columns one by one
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
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'publisher_user_id')
    ALTER TABLE antojados_core.biz_posts DROP COLUMN publisher_user_id;
GO

-- Drop any leftover defaults
DECLARE @dc_sql NVARCHAR(MAX);
SELECT @dc_sql = STRING_AGG('ALTER TABLE antojados_core.biz_posts DROP CONSTRAINT ' + QUOTENAME(dc.name) + ';', ' ')
FROM sys.default_constraints dc
WHERE dc.parent_object_id = OBJECT_ID('antojados_core.biz_posts');
IF @dc_sql IS NOT NULL
    EXEC sp_executesql @dc_sql;
GO

-- Drop old indexes
DECLARE @idx_sql NVARCHAR(MAX);
SELECT @idx_sql = STRING_AGG('DROP INDEX ' + QUOTENAME(i.name) + ' ON antojados_core.biz_posts;', ' ')
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('antojados_core.biz_posts')
  AND i.name IS NOT NULL
  AND i.is_primary_key = 0
  AND i.is_unique_constraint = 0;
IF @idx_sql IS NOT NULL
    EXEC sp_executesql @idx_sql;
GO

-- Make sponsor_id NOT NULL and backfill
UPDATE antojados_core.biz_posts SET sponsor_id = biz_post_id WHERE sponsor_id IS NULL;
GO
ALTER TABLE antojados_core.biz_posts ALTER COLUMN sponsor_id NVARCHAR(64) NOT NULL;
GO

-- Add remaining new columns
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'engagement_score')
    ALTER TABLE antojados_core.biz_posts ADD engagement_score DECIMAL(10,4) NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'taps_whatsapp_count')
    ALTER TABLE antojados_core.biz_posts ADD taps_whatsapp_count INT NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('antojados_core.biz_posts') AND name = 'taps_maps_count')
    ALTER TABLE antojados_core.biz_posts ADD taps_maps_count INT NOT NULL DEFAULT 0;
GO

-- Recreate indexes
CREATE NONCLUSTERED INDEX IX_biz_posts_sponsor_id ON antojados_core.biz_posts (sponsor_id);
GO
CREATE NONCLUSTERED INDEX IX_biz_posts_channel ON antojados_core.biz_posts (channel);
GO
CREATE NONCLUSTERED INDEX IX_biz_posts_created_at ON antojados_core.biz_posts (created_at DESC);
GO
