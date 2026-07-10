SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
-- =============================================================================
-- sp-geo-bars-v1.sql
-- Ejecutar contra ATLX_ANTOJADOS_APP.
-- Idempotente: CREATE OR ALTER.
--
-- Objetivo:
--   - Cerrar contrato SQL para barras geo.
--   - Resolver GPS del dispositivo hacia contexto de barra.
--   - Buscar ciudades para contexto temporal de pantalla.
--   - Listar catalogo territorial activo.
--   - Aceptar scope_level zona/tu_zona en rankings existentes.
--
-- No crea datos, no toca frontend, no modifica posts/places/feeds.
-- =============================================================================
SET NOCOUNT ON;

USE ATLX_ANTOJADOS_APP;
GO

CREATE OR ALTER PROCEDURE antojados_core.usp_geo_scope_catalog_list
  @scope_level       NVARCHAR(20)  = NULL,
  @parent_scope_code NVARCHAR(64)  = NULL,
  @q                 NVARCHAR(120) = NULL,
  @limit             INT           = 100
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @safe_limit INT = CASE
    WHEN @limit IS NULL OR @limit < 1 THEN 100
    WHEN @limit > 500 THEN 500
    ELSE @limit
  END;

  SELECT TOP (@safe_limit)
    scope_code,
    scope_level,
    scope_label,
    parent_scope_code,
    country_code,
    city_code,
    zone_code,
    status
  FROM antojados_core.geo_scope_catalog
  WHERE status = N'active'
    AND (@scope_level IS NULL OR scope_level = @scope_level)
    AND (@parent_scope_code IS NULL OR parent_scope_code = @parent_scope_code)
    AND (
      @q IS NULL
      OR scope_label LIKE N'%' + @q + N'%'
      OR scope_code LIKE N'%' + @q + N'%'
    )
  ORDER BY
    CASE scope_level
      WHEN N'mexico' THEN 1
      WHEN N'metro' THEN 2
      WHEN N'zona' THEN 2
      WHEN N'ciudad' THEN 3
      ELSE 9
    END,
    scope_label,
    scope_code;
END;
GO

CREATE OR ALTER PROCEDURE antojados_core.usp_geo_city_search
  @q     NVARCHAR(120) = NULL,
  @limit INT           = 50
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @safe_limit INT = CASE
    WHEN @limit IS NULL OR @limit < 1 THEN 50
    WHEN @limit > 100 THEN 100
    ELSE @limit
  END;

  SELECT TOP (@safe_limit)
    city.scope_code AS city_scope_code,
    city.city_code,
    city.scope_label AS city_label,
    zone.scope_code AS zone_scope_code,
    zone.zone_code,
    zone.scope_label AS zone_label,
    country.scope_code AS country_scope_code,
    country.country_code,
    country.scope_label AS country_label
  FROM antojados_core.geo_scope_catalog AS city
  INNER JOIN antojados_core.geo_scope_catalog AS zone
    ON zone.scope_code = city.parent_scope_code
   AND zone.status = N'active'
  INNER JOIN antojados_core.geo_scope_catalog AS country
    ON country.scope_code = zone.parent_scope_code
   AND country.status = N'active'
  WHERE city.status = N'active'
    AND city.scope_level = N'ciudad'
    AND country.scope_code = N'MX_52'
    AND (
      @q IS NULL
      OR city.scope_label LIKE N'%' + @q + N'%'
      OR city.scope_code LIKE N'%' + @q + N'%'
      OR zone.scope_label LIKE N'%' + @q + N'%'
    )
  ORDER BY
    CASE WHEN city.scope_label = @q THEN 0 ELSE 1 END,
    city.scope_label,
    zone.scope_label;
END;
GO

CREATE OR ALTER PROCEDURE antojados_core.usp_geo_bar_context_resolve
  @lat DECIMAL(9,6) = NULL,
  @lng DECIMAL(9,6) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE
    @country_scope_code NVARCHAR(64) = N'MX_52',
    @country_code       NVARCHAR(20) = N'MX',
    @country_label      NVARCHAR(240) = N'Mexico',
    @zone_scope_code    NVARCHAR(64) = NULL,
    @zone_code          NVARCHAR(60) = NULL,
    @zone_label         NVARCHAR(240) = NULL,
    @city_scope_code    NVARCHAR(64) = NULL,
    @city_code          NVARCHAR(60) = NULL,
    @city_label         NVARCHAR(240) = NULL,
    @device_resolved    BIT = 0,
    @device_in_coverage BIT = 0,
    @distance_km        DECIMAL(12,6) = NULL,
    @confidence         DECIMAL(5,4) = NULL,
    @source_type        NVARCHAR(40) = NULL;

  SELECT
    @country_label = scope_label,
    @country_code = COALESCE(country_code, N'MX')
  FROM antojados_core.geo_scope_catalog
  WHERE scope_code = @country_scope_code
    AND status = N'active';

  IF @lat IS NOT NULL
     AND @lng IS NOT NULL
     AND @lat BETWEEN -90 AND 90
     AND @lng BETWEEN -180 AND 180
  BEGIN
    ;WITH candidates AS (
      SELECT
        d.*,
        CAST(
          6371.0 * 2.0 * ASIN(SQRT(
            POWER(SIN((PI() / 180.0) * (CAST(d.center_lat AS FLOAT) - CAST(@lat AS FLOAT)) / 2.0), 2)
            + COS((PI() / 180.0) * CAST(@lat AS FLOAT))
            * COS((PI() / 180.0) * CAST(d.center_lat AS FLOAT))
            * POWER(SIN((PI() / 180.0) * (CAST(d.center_lng AS FLOAT) - CAST(@lng AS FLOAT)) / 2.0), 2)
          ))
        AS DECIMAL(12,6)) AS distance_km
      FROM antojados_core.geo_scope_detection_map AS d
      WHERE d.status = N'active'
        AND d.country_scope_code = @country_scope_code
        AND (@lat >= COALESCE(d.min_lat, -90) AND @lat <= COALESCE(d.max_lat, 90))
        AND (@lng >= COALESCE(d.min_lng, -180) AND @lng <= COALESCE(d.max_lng, 180))
    )
    SELECT TOP (1)
      @zone_scope_code = zone_scope_code,
      @zone_code = zone_code,
      @zone_label = zone_label,
      @city_scope_code = city_scope_code,
      @city_code = city_code,
      @city_label = city_label,
      @distance_km = distance_km,
      @confidence = confidence,
      @source_type = source_type,
      @device_resolved = 1,
      @device_in_coverage = 1
    FROM candidates
    WHERE distance_km <= radius_km
    ORDER BY priority DESC, distance_km ASC, confidence DESC, city_label ASC;
  END;

  SELECT
    @device_resolved AS device_resolved,
    @device_in_coverage AS device_in_coverage,
    @country_scope_code AS country_scope_code,
    @country_code AS country_code,
    @country_label AS country_label,
    @zone_scope_code AS zone_scope_code,
    @zone_code AS zone_code,
    @zone_label AS zone_label,
    @city_scope_code AS city_scope_code,
    @city_code AS city_code,
    @city_label AS city_label,
    CASE WHEN @city_scope_code IS NULL THEN N'mexico' ELSE N'ciudad' END AS normal_default_scope_level,
    CASE WHEN @city_scope_code IS NULL THEN @country_scope_code ELSE @city_scope_code END AS normal_default_scope_code,
    N'mexico' AS barrio_default_scope_level,
    @country_scope_code AS barrio_default_scope_code,
    CAST(1 AS BIT) AS global_available,
    CASE WHEN @city_scope_code IS NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS search_required_for_zone_city,
    @distance_km AS device_distance_km,
    @confidence AS detection_confidence,
    @source_type AS detection_source_type;

  SELECT
    item_order,
    scope_level,
    scope_code,
    scope_label,
    enabled,
    is_default
  FROM (
    SELECT 1 AS item_order, N'mexico' AS scope_level, @country_scope_code AS scope_code, @country_label AS scope_label, CAST(1 AS BIT) AS enabled, CASE WHEN @city_scope_code IS NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS is_default
    UNION ALL
    SELECT 2, N'zona', @zone_scope_code, @zone_label, CASE WHEN @zone_scope_code IS NULL THEN CAST(0 AS BIT) ELSE CAST(1 AS BIT) END, CAST(0 AS BIT)
    UNION ALL
    SELECT 3, N'ciudad', @city_scope_code, @city_label, CASE WHEN @city_scope_code IS NULL THEN CAST(0 AS BIT) ELSE CAST(1 AS BIT) END, CASE WHEN @city_scope_code IS NULL THEN CAST(0 AS BIT) ELSE CAST(1 AS BIT) END
  ) AS normal_bar
  ORDER BY item_order;

  SELECT
    item_order,
    scope_level,
    scope_code,
    scope_label,
    enabled,
    is_default
  FROM (
    SELECT 0 AS item_order, N'global' AS scope_level, CAST(NULL AS NVARCHAR(64)) AS scope_code, N'Global' AS scope_label, CAST(1 AS BIT) AS enabled, CAST(0 AS BIT) AS is_default
    UNION ALL
    SELECT 1, N'mexico', @country_scope_code, @country_label, CAST(1 AS BIT), CAST(1 AS BIT)
    UNION ALL
    SELECT 2, N'zona', @zone_scope_code, @zone_label, CASE WHEN @zone_scope_code IS NULL THEN CAST(0 AS BIT) ELSE CAST(1 AS BIT) END, CAST(0 AS BIT)
    UNION ALL
    SELECT 3, N'ciudad', @city_scope_code, @city_label, CASE WHEN @city_scope_code IS NULL THEN CAST(0 AS BIT) ELSE CAST(1 AS BIT) END, CAST(0 AS BIT)
  ) AS barrio_bar
  ORDER BY item_order;
END;
GO

CREATE OR ALTER PROCEDURE antojados_feed.usp_api_top_places_v2
  @scope_level NVARCHAR(20) = NULL,
  @scope_code  NVARCHAR(64) = NULL,
  @city_code   NVARCHAR(30) = NULL,
  @category    NVARCHAR(80) = NULL,
  @limit       INT = 10
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @normalized_scope_level NVARCHAR(20) = CASE
    WHEN @scope_level IN (N'zona', N'metro', N'tu_zona') THEN N'zona'
    WHEN @scope_level IN (N'mexico', N'global', N'ciudad') THEN @scope_level
    ELSE @scope_level
  END;

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
      @normalized_scope_level IS NULL
      OR @normalized_scope_level = N'global'
      OR @normalized_scope_level = N'mexico'
      OR (@normalized_scope_level = N'ciudad' AND tp.city_code = @scope_code)
      OR (@normalized_scope_level = N'zona' AND COALESCE(tp.zone_code, tp.city_code) = @scope_code)
    )
    AND (
      @normalized_scope_level IS NOT NULL
      OR @city_code IS NULL
      OR tp.city_code = @city_code
    )
  ORDER BY tp.rank_position ASC, tp.score DESC;
END;
GO
