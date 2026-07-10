-- Show current columns of biz_posts
DECLARE @cols NVARCHAR(MAX);
SELECT @cols = STRING_AGG(COLUMN_NAME + ' ' + DATA_TYPE + 
    CASE WHEN CHARACTER_MAXIMUM_LENGTH IS NOT NULL THEN '(' + CAST(CHARACTER_MAXIMUM_LENGTH AS NVARCHAR) + ')' ELSE '' END, 
    ', ') 
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'antojados_core' AND TABLE_NAME = 'biz_posts'
ORDER BY ORDINAL_POSITION;
PRINT 'biz_posts columns: ' + ISNULL(@cols, 'TABLE NOT FOUND');

-- Show FK
SELECT STRING_AGG(fk.name, ', ') AS fk_list
FROM sys.foreign_keys fk
WHERE fk.parent_object_id = OBJECT_ID('antojados_core.biz_post_media')
   OR fk.parent_object_id = OBJECT_ID('antojados_core.biz_posts');
PRINT '--- END ---';
