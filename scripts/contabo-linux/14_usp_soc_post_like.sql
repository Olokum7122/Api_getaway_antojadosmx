-- ============================================================
-- SP: usp_soc_post_like
-- ============================================================
CREATE OR ALTER PROCEDURE antojados_core.usp_soc_post_like
    @post_id NVARCHAR(64),
    @user_id NVARCHAR(64)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM antojados_core.soc_post_interactions WITH (UPDLOCK, HOLDLOCK)
        WHERE post_id = @post_id
          AND user_id = @user_id
          AND interaction_type = 'like_created'
    )
    BEGIN
        INSERT INTO antojados_core.soc_post_interactions
            (interaction_id, post_id, user_id, interaction_type,
             moderation_status, created_at_client, received_at_server)
        VALUES
            (LOWER(NEWID()), @post_id, @user_id, 'like_created',
             'approved', SYSUTCDATETIME(), SYSUTCDATETIME());

        UPDATE antojados_core.soc_posts
        SET likes_count = likes_count + 1
        WHERE post_id = @post_id;
    END;
END;
GO
