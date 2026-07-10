-- ============================================================
-- SP: usp_biz_post_unlike
-- ============================================================
CREATE OR ALTER PROCEDURE antojados_core.usp_biz_post_unlike
    @biz_post_id NVARCHAR(64),
    @user_id     NVARCHAR(64)
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM antojados_core.biz_post_interactions
    WHERE biz_post_id = @biz_post_id
      AND user_id = @user_id
      AND interaction_type = 'like_created';

    IF @@ROWCOUNT > 0
        UPDATE antojados_core.biz_posts
        SET likes_count = CASE WHEN likes_count > 0 THEN likes_count - 1 ELSE 0 END
        WHERE biz_post_id = @biz_post_id;
END;
GO
