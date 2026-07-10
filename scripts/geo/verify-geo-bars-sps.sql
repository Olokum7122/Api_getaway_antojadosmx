SELECT
  s.name AS schema_name,
  p.name AS procedure_name
FROM sys.procedures AS p
INNER JOIN sys.schemas AS s
  ON s.schema_id = p.schema_id
WHERE (s.name = N'antojados_core' AND p.name IN (
    N'usp_geo_scope_catalog_list',
    N'usp_geo_city_search',
    N'usp_geo_bar_context_resolve'
  ))
  OR (s.name = N'antojados_feed' AND p.name = N'usp_api_top_places_v2')
ORDER BY s.name, p.name;

EXEC antojados_core.usp_geo_scope_catalog_list
  @scope_level = N'mexico',
  @limit = 5;

EXEC antojados_core.usp_geo_city_search
  @q = N'Aguascalientes',
  @limit = 5;

EXEC antojados_core.usp_geo_bar_context_resolve
  @lat = NULL,
  @lng = NULL;
