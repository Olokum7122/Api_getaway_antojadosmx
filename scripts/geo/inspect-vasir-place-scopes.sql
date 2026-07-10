SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;

USE ATLX_ANTOJADOS_APP;

SELECT TOP (20)
  pl.place_id,
  pl.name,
  pl.city_code,
  pl.zone_code,
  pl.lat,
  pl.lng,
  bp.channel,
  bp.publication_type,
  bp.created_at
FROM antojados_core.biz_posts AS bp
INNER JOIN antojados_core.soc_places AS pl
  ON pl.place_id = bp.place_id
WHERE bp.status = N'active'
  AND bp.channel = N'vas_ir'
ORDER BY bp.created_at DESC;
