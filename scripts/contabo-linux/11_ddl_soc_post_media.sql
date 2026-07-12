-- ============================================================
-- DDL: soc_post_media — Multimedia de Posts Sociales
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DOMINIO:      Feed de AntojadosMX — Multimedia de Posts Sociales
-- RESPONSABLE:  Definir la estructura física de la tabla soc_post_media
--               según el modelo de datos de feed.md §4.
--
-- COLUMNAS (según feed.md §4):
--   media_id, post_id (FK → soc_posts), user_id,
--   media_type (DEFAULT 'photo'), media_url, sort_order (DEFAULT 0),
--   asset_id, thumb_url, feed_url, full_url, created_at
--
-- ÍNDICES (según feed.md §4):
--   IX_soc_post_media_post_id, IX_soc_post_media_sort_order (post_id, sort_order)
--
-- REFERENCIAS:
--   - apps-antojados/docs/feed.md (Sección 4: soc_post_media)
-- ═══════════════════════════════════════════════════════════════════════════
--
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'antojados_core' AND TABLE_NAME = 'soc_post_media'
)
BEGIN
    CREATE TABLE antojados_core.soc_post_media (
        media_id     NVARCHAR(64)    NOT NULL PRIMARY KEY,
        post_id      NVARCHAR(64)    NOT NULL,
        user_id      NVARCHAR(64)    NOT NULL,
        media_type   NVARCHAR(20)    NOT NULL DEFAULT 'photo',
        media_url    NVARCHAR(1000)  NOT NULL,
        sort_order   INT             NOT NULL DEFAULT 0,
        asset_id     NVARCHAR(64)    NULL,
        thumb_url    NVARCHAR(1000)  NULL,
        feed_url     NVARCHAR(1000)  NULL,
        full_url     NVARCHAR(1000)  NULL,
        created_at   DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT FK_soc_post_media_post
            FOREIGN KEY (post_id) REFERENCES antojados_core.soc_posts(post_id)
            ON DELETE CASCADE
    );

    CREATE NONCLUSTERED INDEX IX_soc_post_media_post_id ON antojados_core.soc_post_media (post_id);
    CREATE NONCLUSTERED INDEX IX_soc_post_media_sort_order ON antojados_core.soc_post_media (post_id, sort_order);

    PRINT 'soc_post_media created successfully';
END
ELSE
    PRINT 'soc_post_media already exists';
GO
