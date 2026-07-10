-- ============================================================
-- SP: usp_publish_biz_post
-- Solo campos finales: sponsor_id, channel, feed_type, media_url, doc_json
-- ============================================================
CREATE OR ALTER PROCEDURE antojados_core.usp_publish_biz_post
    @sponsor_id      NVARCHAR(64),
    @channel         NVARCHAR(30),
    @feed_type       NVARCHAR(30)  = NULL,
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
        @media_url,
        @doc_json,
        'active',
        SYSUTCDATETIME()
    );

    SET @biz_post_id = @id;
END;
GO
