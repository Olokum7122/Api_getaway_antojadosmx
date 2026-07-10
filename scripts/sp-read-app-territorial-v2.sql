SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;

USE ATLX_ANTOJADOS_APP;

DECLARE @sp NVARCHAR(MAX) = N'
CREATE OR ALTER PROCEDURE antojados_feed.usp_api_top_places_v2
  @scope_level NVARCHAR(20) = NULL,
  @scope_code  NVARCHAR(64) = NULL,
  @city_code   NVARCHAR(30) = NULL,
  @category    NVARCHAR(80) = NULL,
  @limit       INT = 10
AS
BEGIN
  SET NOCOUNT ON;

  SELECT TOP (@limit)
         tp.place_id,
         tp.place_name,
         tp.category,
         tp.city_code,
         tp.zone_code,
         tp.scope_level,
         tp.scope_code,
         tp.score,
         tp.rank_position,
         tp.post_count,
         tp.verified_visit_count,
         tp.avg_rating,
         tp.sponsored,
         tp.computed_at,
         tp.saves_count
  FROM antojados_feed.feed_top_places tp
  WHERE (@category IS NULL OR tp.category = @category)
    AND (
      @scope_level IS NULL
      OR @scope_level = N''global''
      OR @scope_level = N''mexico''
      OR (@scope_level = N''ciudad'' AND tp.city_code = @scope_code)
      OR (@scope_level = N''tu_zona'' AND COALESCE(tp.zone_code, tp.city_code) = @scope_code)
    )
    AND (
      @scope_level IS NOT NULL
      OR @city_code IS NULL
      OR tp.city_code = @city_code
    )
  ORDER BY tp.rank_position ASC, tp.score DESC;
END;
';
EXEC sp_executesql @sp;
