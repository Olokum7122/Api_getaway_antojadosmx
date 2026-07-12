-- ============================================================
-- SP: usp_publish_soc_post — Publicar Post Social
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DOMINIO:      Feed de AntojadosMX — Posts Sociales (soc)
-- RESPONSABLE:  Insertar un nuevo soc_post con los campos del modelo
--               feed.md §3 y §5.
--
-- PARÁMETROS (según feed.md §5):
--   @user_id, @channel, @feed_type (NULL), @city_code (NULL),
--   @zone_code (NULL), @media_url (NULL), @doc_json (NULL),
--   @post_id OUTPUT
--
-- city_code y zone_code:
--   - Permiten filtrar posts por ciudad o zona metropolitana
--   - NULL significa que el post aplica a nivel nacional (mexico)
--   - Ver feed.md §11.2 para el flujo de filtro geo
--
-- GENERA:
--   - post_id = LOWER(NEWID()) si no se provee
--   - status = 'active'
--   - created_at = SYSUTCDATETIME()
--
-- REFERENCIAS:
--   - apps-antojados/docs/feed.md (Sección 3: soc_posts)
--   - apps-antojados/docs/feed.md (Sección 5: SPs de Publicación)
--   - apps-antojados/docs/feed.md (Sección 6: Diferencias Biz vs Soc)
-- ═══════════════════════════════════════════════════════════════════════════
--
CREATE OR ALTER PROCEDURE antojados_core.usp_publish_soc_post
    @user_id         NVARCHAR(64),
    @channel         NVARCHAR(30),
    @feed_type       NVARCHAR(30)  = NULL,
    @city_code       NVARCHAR(20)  = NULL,
    @zone_code       NVARCHAR(20)  = NULL,
    @media_url       NVARCHAR(500) = NULL,
    @doc_json        NVARCHAR(MAX) = NULL,
    @post_id         NVARCHAR(64)  = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @id NVARCHAR(64) = COALESCE(@post_id, LOWER(NEWID()));

    INSERT INTO antojados_core.soc_posts (
        post_id,
        user_id,
        channel,
        feed_type,
        city_code,
        zone_code,
        media_url,
        doc_json,
        status,
        created_at
    )
    VALUES (
        @id,
        @user_id,
        @channel,
        @feed_type,
        @city_code,
        @zone_code,
        @media_url,
        @doc_json,
        'active',
        SYSUTCDATETIME()
    );

    SET @post_id = @id;
END;
GO
