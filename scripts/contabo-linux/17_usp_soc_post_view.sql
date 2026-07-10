-- ============================================================
-- SP: usp_soc_post_view
-- ============================================================
CREATE OR ALTER PROCEDURE antojados_core.usp_soc_post_view
    @post_id NVARCHAR(64),
    @user_id NVARCHAR(64) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO antojados_core.soc_post_interactions
        (interaction_id, post_id, user_id, interaction_type,
         moderation_status, created_at_client, received_at_server)
    VALUES
        (LOWER(NEWID()), @post_id, @user_id, 'post_viewed',
         'approved', SYSUTCDATETIME(), SYSUTCDATETIME());

    UPDATE antojados_core.soc_posts
    SET views_count = views_count + 1
    WHERE post_id = @post_id;
END;
GO
