-- ============================================================
-- SP: usp_soc_post_interactions_summary
-- Regresa has_liked, likes_count, comments_count
-- ============================================================
CREATE OR ALTER PROCEDURE antojados_core.usp_soc_post_interactions_summary
    @post_id NVARCHAR(64),
    @user_id NVARCHAR(64) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @liked BIT = 0;
    DECLARE @likes_count INT = 0;
    DECLARE @comments_count INT = 0;

    SELECT @likes_count = likes_count,
           @comments_count = comments_count
    FROM antojados_core.soc_posts
    WHERE post_id = @post_id;

    IF @user_id IS NOT NULL
        SELECT @liked = 1
        FROM antojados_core.soc_post_interactions
        WHERE post_id = @post_id
          AND user_id = @user_id
          AND interaction_type = 'like_created';

    SELECT
        @liked AS has_liked,
        @likes_count AS likes_count,
        @comments_count AS comments_count;
END;
GO
