-- ============================================================
-- DDL: soc_posts — Posts Sociales (Usuario)
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DOMINIO:      Feed de AntojadosMX — Posts Sociales (soc)
-- RESPONSABLE:  Definir la estructura física de la tabla soc_posts
--               según el modelo de datos de feed.md §3.
--
-- COLUMNAS (según feed.md §3):
--   post_id, user_id, channel, feed_type, city_code, zone_code,
--   media_url, doc_json, views_count, likes_count, comments_count,
--   shares_count, cta_clicks_count, engagement_score, status, created_at
--
-- city_code y zone_code:
--   - Permiten filtrar posts por ciudad o zona metropolitana
--   - NULL significa que el post aplica a nivel nacional (mexico)
--   - Ver feed.md §11.2 para el flujo de filtro geo
--
-- ÍNDICES (según feed.md §3):
--   IX_soc_posts_user_id, IX_soc_posts_channel,
--   IX_soc_posts_city_code, IX_soc_posts_zone_code,
--   IX_soc_posts_status, IX_soc_posts_created_at DESC
--
-- REFERENCIAS:
--   - apps-antojados/docs/feed.md (Sección 3: soc_posts)
--   - apps-antojados/docs/feed.md (Sección 6: Diferencias Biz vs Soc)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Eliminar si existe (usar con precaución en prod)
-- DROP TABLE IF EXISTS antojados_core.soc_posts;

CREATE TABLE antojados_core.soc_posts (
    post_id          NVARCHAR(64)    NOT NULL PRIMARY KEY,
    user_id          NVARCHAR(64)    NOT NULL,
    channel          NVARCHAR(30)    NOT NULL,
    feed_type        NVARCHAR(30)    NULL,
    city_code        NVARCHAR(20)    NULL,
    zone_code        NVARCHAR(20)    NULL,
    media_url        NVARCHAR(500)   NULL,
    doc_json         NVARCHAR(MAX)   NULL,

    -- Métricas
    views_count      INT             NOT NULL DEFAULT 0,
    likes_count      INT             NOT NULL DEFAULT 0,
    comments_count   INT             NOT NULL DEFAULT 0,
    shares_count     INT             NOT NULL DEFAULT 0,
    cta_clicks_count INT             NOT NULL DEFAULT 0,
    engagement_score DECIMAL(10,4)   NOT NULL DEFAULT 0,

    status           NVARCHAR(20)    NOT NULL DEFAULT 'active',
    created_at       DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE NONCLUSTERED INDEX IX_soc_posts_user_id ON antojados_core.soc_posts (user_id);
CREATE NONCLUSTERED INDEX IX_soc_posts_channel ON antojados_core.soc_posts (channel);
CREATE NONCLUSTERED INDEX IX_soc_posts_city_code ON antojados_core.soc_posts (city_code) WHERE city_code IS NOT NULL;
CREATE NONCLUSTERED INDEX IX_soc_posts_zone_code ON antojados_core.soc_posts (zone_code) WHERE zone_code IS NOT NULL;
CREATE NONCLUSTERED INDEX IX_soc_posts_status ON antojados_core.soc_posts (status);
CREATE NONCLUSTERED INDEX IX_soc_posts_created_at ON antojados_core.soc_posts (created_at DESC);
GO
