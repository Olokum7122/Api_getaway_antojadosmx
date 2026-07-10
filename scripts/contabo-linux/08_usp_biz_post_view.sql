-- ============================================================
-- SP: usp_biz_post_view
-- ============================================================
CREATE OR ALTER PROCEDURE antojados_core.usp_biz_post_view
    @biz_post_id NVARCHAR(64),
    @user_id     NVARCHAR(64) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO antojados_core.biz_post_interactions
        (interaction_id, biz_post_id, user_id, interaction_type,
         moderation_status, created_at_client, received_at_server)
    VALUES
        (LOWER(NEWID()), @biz_post_id, @user_id, 'post_viewed',
         'approved', SYSUTCDATETIME(), SYSUTCDATETIME());

    UPDATE antojados_core.biz_posts
    SET views_count = views_count + 1
    WHERE biz_post_id = @biz_post_id;
END;
GO
