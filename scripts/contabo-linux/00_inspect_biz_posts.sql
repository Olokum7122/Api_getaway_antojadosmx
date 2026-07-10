-- Inspect biz_posts structure
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'antojados_core' AND TABLE_NAME = 'biz_posts'
ORDER BY ORDINAL_POSITION;

-- Check FK dependencies on biz_posts
SELECT 
    fk.name AS fk_name,
    tp.name AS parent_table,
    ref.name AS referenced_table,
    cp.name AS parent_column,
    cr.name AS referenced_column
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
INNER JOIN sys.tables tp ON tp.object_id = fkc.parent_object_id
INNER JOIN sys.tables ref ON ref.object_id = fkc.referenced_object_id
INNER JOIN sys.columns cp ON cp.object_id = fkc.parent_object_id AND cp.column_id = fkc.parent_column_id
INNER JOIN sys.columns cr ON cr.object_id = fkc.referenced_object_id AND cr.column_id = fkc.referenced_column_id
WHERE ref.name = 'biz_posts';

-- Get all indexes on biz_posts
SELECT i.name AS index_name, i.type_desc, 
    STUFF((
        SELECT ', ' + c2.name
        FROM sys.index_columns ic2
        JOIN sys.columns c2 ON c2.object_id = ic2.object_id AND c2.column_id = ic2.column_id
        WHERE ic2.object_id = i.object_id AND ic2.index_id = i.index_id
        ORDER BY ic2.key_ordinal
        FOR XML PATH('')
    ), 1, 2, '') AS columns
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('antojados_core.biz_posts');

-- Check dependencies on place_id column
SELECT 
    OBJECT_NAME(d.referencing_id) AS referencing_object
FROM sys.sql_expression_dependencies d
WHERE d.referenced_entity_name = 'biz_posts';
