-- ============================================================
-- SP: usp_publish_soc_post
-- Solo campos finales: user_id, channel, feed_type, media_url, doc_json
-- ============================================================
CREATE OR ALTER PROCEDURE antojados_core.usp_publish_soc_post
    @user_id         NVARCHAR(64),
    @channel         NVARCHAR(30),
    @feed_type       NVARCHAR(30)  = NULL,
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
        @media_url,
        @doc_json,
        'active',
        SYSUTCDATETIME()
    );

    SET @post_id = @id;
END;
GO
