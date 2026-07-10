SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'antojados_core' AND TABLE_NAME = 'biz_posts'
ORDER BY ORDINAL_POSITION
FOR JSON PATH;
GO
SELECT name AS fk_name, OBJECT_NAME(parent_object_id) AS parent_table, OBJECT_NAME(referenced_object_id) AS ref_table
FROM sys.foreign_keys
WHERE parent_object_id = OBJECT_ID('antojados_core.biz_post_media')
   OR referenced_object_id = OBJECT_ID('antojados_core.biz_posts')
FOR JSON PATH;
GO
