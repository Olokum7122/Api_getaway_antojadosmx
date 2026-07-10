-- ============================================================
-- SP: usp_soc_post_comment
-- ============================================================
CREATE OR ALTER PROCEDURE antojados_core.usp_soc_post_comment
    @post_id             NVARCHAR(64),
    @user_id             NVARCHAR(64),
    @interaction_type    NVARCHAR(30),  -- 'comment_created' | 'reply_created'
    @parent_comment_id   NVARCHAR(64) = NULL,
    @content_text        NVARCHAR(2000),
    @created_at_client   DATETIME2(3)  = NULL,
    @interaction_id      NVARCHAR(64)  = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @id NVARCHAR(64) = COALESCE(@interaction_id, LOWER(NEWID()));

    INSERT INTO antojados_core.soc_post_interactions
        (interaction_id, post_id, user_id, interaction_type, parent_comment_id,
         content_text, moderation_status, created_at_client, received_at_server)
    VALUES
        (@id, @post_id, @user_id, @interaction_type, @parent_comment_id,
         @content_text, 'approved', COALESCE(@created_at_client, SYSUTCDATETIME()), SYSUTCDATETIME());

    UPDATE antojados_core.soc_posts
    SET comments_count = comments_count + 1
    WHERE post_id = @post_id;

    SET @interaction_id = @id;
END;
GO
