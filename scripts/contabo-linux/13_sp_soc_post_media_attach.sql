-- ============================================================
-- SP: sp_soc_post_media_attach — Adjuntar Multimedia a Post Social
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DOMINIO:      Feed de AntojadosMX — Multimedia de Posts Sociales
-- RESPONSABLE:  Insertar un registro multimedia (thumb/feed/full)
--               en soc_post_media, vinculado a un soc_post existente.
--
-- NO HACE:
--   - No publica el post (lo hace usp_publish_soc_post)
--   - No procesa media (lo hace Media Engine)
--   - No acepta @sponsor_id (solo soc usa @user_id)
--
-- PARÁMETROS (según feed.md §5):
--   @post_id, @user_id, @media_type (DEFAULT 'photo'),
--   @media_url, @sort_order (DEFAULT 0), @asset_id (NULL),
--   @thumb_url (NULL), @feed_url (NULL), @full_url (NULL)
--
-- REGLAS (feed.md):
--   §4: asset_id es el mediaId del Media Engine
--   §6: thumb/feed/full son la interfaz estable
--
-- REFERENCIAS:
--   - apps-antojados/docs/feed.md (Sección 4: soc_post_media)
--   - apps-antojados/docs/feed.md (Sección 5: SPs — Media Attach)
-- ═══════════════════════════════════════════════════════════════════════════
--
CREATE OR ALTER PROCEDURE antojados_core.sp_soc_post_media_attach
    @post_id     NVARCHAR(64),
    @user_id     NVARCHAR(64),
    @media_type  NVARCHAR(20)  = 'photo',
    @media_url   NVARCHAR(1000),
    @sort_order  INT           = 0,
    @asset_id    NVARCHAR(64)  = NULL,
    @thumb_url   NVARCHAR(1000)= NULL,
    @feed_url    NVARCHAR(1000)= NULL,
    @full_url    NVARCHAR(1000)= NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @id NVARCHAR(64) = LOWER(NEWID());

    INSERT INTO antojados_core.soc_post_media (
        media_id,
        post_id,
        user_id,
        media_type,
        media_url,
        sort_order,
        asset_id,
        thumb_url,
        feed_url,
        full_url,
        created_at
    )
    VALUES (
        @id,
        @post_id,
        @user_id,
        @media_type,
        @media_url,
        @sort_order,
        @asset_id,
        @thumb_url,
        @feed_url,
        @full_url,
        SYSUTCDATETIME()
    );
END;
GO
