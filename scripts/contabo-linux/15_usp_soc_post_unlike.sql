-- ============================================================
-- SP: usp_soc_post_unlike
-- ============================================================
CREATE OR ALTER PROCEDURE antojados_core.usp_soc_post_unlike
    @post_id NVARCHAR(64),
    @user_id NVARCHAR(64)
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM antojados_core.soc_post_interactions
    WHERE post_id = @post_id
      AND user_id = @user_id
      AND interaction_type = 'like_created';

    IF @@ROWCOUNT > 0
        UPDATE antojados_core.soc_posts
        SET likes_count = CASE WHEN likes_count > 0 THEN likes_count - 1 ELSE 0 END
        WHERE post_id = @post_id;
END;
GO
