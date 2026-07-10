SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
-- =============================================================================
-- migrate-13-geo-scope-detection-map.sql
-- Ejecutar contra ATLX_ANTOJADOS_APP.
-- Idempotente: seguro de re-ejecutar.
--
-- Objetivo:
--   - Crear tabla auxiliar para resolver GPS del dispositivo hacia scope territorial.
--   - Cubrir barra geo: Global / Mexico / Zona / Ciudad.
--   - Cubrir "cerca": entregar city_code y zone_code consistentes antes de pedir feeds.
--   - Evitar dependencia de codes legacy como MX y city_code sueltos.
--
-- Esta migracion NO toca feeds, rankings, places, posts ni datos existentes.
-- =============================================================================
SET NOCOUNT ON;

USE ATLX_ANTOJADOS_APP;

IF NOT EXISTS (
    SELECT 1
    FROM sys.schemas
    WHERE name = N'antojados_core'
) EXEC(N'CREATE SCHEMA antojados_core');

IF OBJECT_ID(N'antojados_core.geo_scope_detection_map', N'U') IS NULL
EXEC(N'
CREATE TABLE antojados_core.geo_scope_detection_map (
  detection_id       BIGINT IDENTITY(1,1) NOT NULL
    CONSTRAINT PK_geo_scope_detection_map PRIMARY KEY,

  -- Scope ciudad que debe ganar cuando el dispositivo cae en esta cobertura.
  city_scope_code    NVARCHAR(64)  NOT NULL,
  city_code          NVARCHAR(60)  NOT NULL,
  city_label         NVARCHAR(240) NOT NULL,

  -- Scope zona/metro padre de la ciudad.
  zone_scope_code    NVARCHAR(64)  NOT NULL,
  zone_code          NVARCHAR(60)  NOT NULL,
  zone_label         NVARCHAR(240) NOT NULL,

  -- Scope pais canonico. Para Mexico debe ser MX_52, no MX legacy.
  country_scope_code NVARCHAR(64)  NOT NULL
    CONSTRAINT DF_geo_scope_detection_map_country_scope DEFAULT (N''MX_52''),
  country_code       NVARCHAR(20)  NOT NULL
    CONSTRAINT DF_geo_scope_detection_map_country DEFAULT (N''MX''),

  -- Centroide/radio: MVP deterministico para resolver GPS.
  center_lat         DECIMAL(9,6)  NOT NULL,
  center_lng         DECIMAL(9,6)  NOT NULL,
  radius_km          DECIMAL(8,3)  NOT NULL,

  -- Bounds opcionales para prefiltrar rapido antes de distancia Haversine.
  min_lat            DECIMAL(9,6)  NULL,
  max_lat            DECIMAL(9,6)  NULL,
  min_lng            DECIMAL(9,6)  NULL,
  max_lng            DECIMAL(9,6)  NULL,

  -- Desempate cuando coberturas se traslapan.
  -- Mayor priority gana; despues menor distancia al centro.
  priority           INT           NOT NULL
    CONSTRAINT DF_geo_scope_detection_map_priority DEFAULT (100),

  -- Calidad y trazabilidad del registro de cobertura.
  confidence         DECIMAL(5,4)  NOT NULL
    CONSTRAINT DF_geo_scope_detection_map_confidence DEFAULT (0.7000),
  source_type        NVARCHAR(40)  NOT NULL
    CONSTRAINT DF_geo_scope_detection_map_source DEFAULT (N''inegi_centroid''),
  source_ref         NVARCHAR(240) NULL,

  status             NVARCHAR(20)  NOT NULL
    CONSTRAINT DF_geo_scope_detection_map_status DEFAULT (N''active''),
  created_at         DATETIME2(3)  NOT NULL
    CONSTRAINT DF_geo_scope_detection_map_created DEFAULT SYSUTCDATETIME(),
  updated_at         DATETIME2(3)  NOT NULL
    CONSTRAINT DF_geo_scope_detection_map_updated DEFAULT SYSUTCDATETIME(),

  CONSTRAINT CK_geo_scope_detection_map_country_scope
    CHECK (country_scope_code = N''MX_52''),
  CONSTRAINT CK_geo_scope_detection_map_status
    CHECK (status IN (N''active'', N''inactive'')),
  CONSTRAINT CK_geo_scope_detection_map_source
    CHECK (source_type IN (N''inegi_centroid'', N''manual'', N''google_geocode'', N''admin_bounds'')),
  CONSTRAINT CK_geo_scope_detection_map_lat
    CHECK (center_lat BETWEEN -90 AND 90),
  CONSTRAINT CK_geo_scope_detection_map_lng
    CHECK (center_lng BETWEEN -180 AND 180),
  CONSTRAINT CK_geo_scope_detection_map_radius
    CHECK (radius_km > 0 AND radius_km <= 250),
  CONSTRAINT CK_geo_scope_detection_map_confidence
    CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT CK_geo_scope_detection_map_bounds_lat
    CHECK (
      (min_lat IS NULL AND max_lat IS NULL)
      OR (min_lat IS NOT NULL AND max_lat IS NOT NULL AND min_lat <= max_lat)
    ),
  CONSTRAINT CK_geo_scope_detection_map_bounds_lng
    CHECK (
      (min_lng IS NULL AND max_lng IS NULL)
      OR (min_lng IS NOT NULL AND max_lng IS NOT NULL AND min_lng <= max_lng)
    ),
  CONSTRAINT FK_geo_scope_detection_map_country_scope
    FOREIGN KEY (country_scope_code)
    REFERENCES antojados_core.geo_scope_catalog(scope_code),
  CONSTRAINT FK_geo_scope_detection_map_zone_scope
    FOREIGN KEY (zone_scope_code)
    REFERENCES antojados_core.geo_scope_catalog(scope_code),
  CONSTRAINT FK_geo_scope_detection_map_city_scope
    FOREIGN KEY (city_scope_code)
    REFERENCES antojados_core.geo_scope_catalog(scope_code)
)');

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_geo_scope_detection_map_city_active'
      AND object_id = OBJECT_ID(N'antojados_core.geo_scope_detection_map')
)
EXEC(N'
CREATE UNIQUE INDEX UX_geo_scope_detection_map_city_active
ON antojados_core.geo_scope_detection_map(city_scope_code)
WHERE status = N''active''
');

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_geo_scope_detection_map_lookup'
      AND object_id = OBJECT_ID(N'antojados_core.geo_scope_detection_map')
)
EXEC(N'
CREATE INDEX IX_geo_scope_detection_map_lookup
ON antojados_core.geo_scope_detection_map(status, country_scope_code, priority DESC)
INCLUDE (
  city_scope_code,
  city_code,
  city_label,
  zone_scope_code,
  zone_code,
  zone_label,
  center_lat,
  center_lng,
  radius_km,
  min_lat,
  max_lat,
  min_lng,
  max_lng,
  confidence
)
');

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_geo_scope_detection_map_bounds'
      AND object_id = OBJECT_ID(N'antojados_core.geo_scope_detection_map')
)
EXEC(N'
CREATE INDEX IX_geo_scope_detection_map_bounds
ON antojados_core.geo_scope_detection_map(status, min_lat, max_lat, min_lng, max_lng)
INCLUDE (
  city_scope_code,
  zone_scope_code,
  center_lat,
  center_lng,
  radius_km,
  priority
)
');

IF OBJECT_ID(N'antojados_core.v_geo_scope_detection_active', N'V') IS NULL
EXEC(N'
CREATE VIEW antojados_core.v_geo_scope_detection_active
AS
SELECT
  detection_id,
  country_scope_code,
  country_code,
  zone_scope_code,
  zone_code,
  zone_label,
  city_scope_code,
  city_code,
  city_label,
  center_lat,
  center_lng,
  radius_km,
  min_lat,
  max_lat,
  min_lng,
  max_lng,
  priority,
  confidence,
  source_type,
  source_ref,
  updated_at
FROM antojados_core.geo_scope_detection_map
WHERE status = N''active''
');

SELECT
  OBJECT_SCHEMA_NAME(OBJECT_ID(N'antojados_core.geo_scope_detection_map')) AS schema_name,
  OBJECT_NAME(OBJECT_ID(N'antojados_core.geo_scope_detection_map')) AS table_name,
  COUNT(*) AS current_rows
FROM antojados_core.geo_scope_detection_map;
