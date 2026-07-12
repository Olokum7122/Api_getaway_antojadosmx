-- ============================================================
-- SP: usp_publish_biz_post — Publicar Post de Negocio
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DOMINIO:      Feed de AntojadosMX — Posts de Negocios (biz)
-- RESPONSABLE:  Insertar un nuevo biz_post con los campos del modelo
--               feed.md §1 y §5.
--
-- PARÁMETROS (según feed.md §5):
--   @sponsor_id, @channel, @feed_type (NULL), @city_code (NULL),
--   @zone_code (NULL), @media_url (NULL), @doc_json (NULL),
--   @biz_post_id OUTPUT
--
-- city_code y zone_code:
--   - Permiten filtrar posts por ciudad o zona metropolitana
--   - NULL significa que el post aplica a nivel nacional (mexico)
--   - Ver feed.md §11.2 para el flujo de filtro geo
--
-- GENERA:
--   - biz_post_id = LOWER(NEWID()) si no se provee
--   - status = 'active'
--   - created_at = SYSUTCDATETIME()
--
-- REGLAS (feed.md §7):
--   §7.1: UUID con guiones (LOWER(NEWID()))
--   §7.2: doc_json solo contiene badge, price, descripciones[]
--   §7.5: status = 'active'
--
-- REFERENCIAS:
--   - apps-antojados/docs/feed.md (Sección 1: biz_posts)
--   - apps-antojados/docs/feed.md (Sección 5: SPs de Publicación)
--   - apps-antojados/docs/feed.md (Sección 7: Reglas de Negocio)
-- ═══════════════════════════════════════════════════════════════════════════
--
CREATE OR ALTER PROCEDURE antojados_core.usp_publish_biz_post
    @sponsor_id      NVARCHAR(64),
    @channel         NVARCHAR(30),
    @feed_type       NVARCHAR(30)  = NULL,
    @city_code       NVARCHAR(20)  = NULL,
    @zone_code       NVARCHAR(20)  = NULL,
    @media_url       NVARCHAR(500) = NULL,
    @doc_json        NVARCHAR(MAX) = NULL,
    @biz_post_id     NVARCHAR(64)  = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @id NVARCHAR(64) = COALESCE(@biz_post_id, LOWER(NEWID()));

    INSERT INTO antojados_core.biz_posts (
        biz_post_id,
        sponsor_id,
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
        @sponsor_id,
        @channel,
        @feed_type,
        @city_code,
        @zone_code,
        @media_url,
        @doc_json,
        'active',
        SYSUTCDATETIME()
    );

    SET @biz_post_id = @id;
END;
GO
