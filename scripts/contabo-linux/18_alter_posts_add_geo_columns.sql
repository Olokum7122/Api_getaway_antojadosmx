-- ============================================================
-- Migration: 18_alter_posts_add_geo_columns.sql
--
-- ══════════════════════════════════════════════════════════════
-- DOMINIO:      Feed de AntojadosMX — Posts (biz + soc)
-- RESPONSABLE:  Agregar city_code y zone_code a biz_posts y soc_posts
--               para permitir filtro geo por ciudad y zona.
--
-- CONTEXTO:
--   El sistema geo (useLocationScope) maneja scope_level como
--   concepto de filtro: 'ciudad' → filtrar por city_code,
--   'zona' → filtrar por zone_code, 'mexico' → sin filtro.
--   Los posts deben tener estos códigos para que el feedService.js
--   pueda filtrar correctamente según el scope seleccionado.
--
-- REGLAS:
--   - city_code: código de ciudad (ej. 'MTY', 'CDMX', 'GDL')
--     NULL significa que el post aplica a nivel nacional (mexico)
--   - zone_code: código de zona metropolitana (ej. 'ZMVM', 'ZMGD')
--     NULL significa que el post solo aplica a nivel ciudad o mexico
--   - Ambos campos son NULL por defecto (compatibilidad con posts existentes)
--   - Los SPs de publicación se actualizan para recibir estos parámetros
--
-- REFERENCIAS:
--   - apps-antojados/docs/feed.md (Sección 1: biz_posts.city_code/zone_code)
--   - apps-antojados/docs/feed.md (Sección 3: soc_posts.city_code/zone_code)
--   - apps-antojados/docs/feed.md (Sección 11.2: Filtro geo por scope_level)
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 1. biz_posts — Agregar city_code y zone_code
-- ══════════════════════════════════════════════════════════════
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('antojados_core.biz_posts')
      AND name = 'city_code'
)
BEGIN
    ALTER TABLE antojados_core.biz_posts
        ADD city_code NVARCHAR(20) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('antojados_core.biz_posts')
      AND name = 'zone_code'
)
BEGIN
    ALTER TABLE antojados_core.biz_posts
        ADD zone_code NVARCHAR(20) NULL;
END
GO

-- Índices para filtro geo
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('antojados_core.biz_posts')
      AND name = 'IX_biz_posts_city_code'
)
BEGIN
    CREATE INDEX IX_biz_posts_city_code
        ON antojados_core.biz_posts (city_code)
        WHERE city_code IS NOT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('antojados_core.biz_posts')
      AND name = 'IX_biz_posts_zone_code'
)
BEGIN
    CREATE INDEX IX_biz_posts_zone_code
        ON antojados_core.biz_posts (zone_code)
        WHERE zone_code IS NOT NULL;
END
GO

-- ══════════════════════════════════════════════════════════════
-- 2. soc_posts — Agregar city_code y zone_code
-- ══════════════════════════════════════════════════════════════
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('antojados_core.soc_posts')
      AND name = 'city_code'
)
BEGIN
    ALTER TABLE antojados_core.soc_posts
        ADD city_code NVARCHAR(20) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('antojados_core.soc_posts')
      AND name = 'zone_code'
)
BEGIN
    ALTER TABLE antojados_core.soc_posts
        ADD zone_code NVARCHAR(20) NULL;
END
GO

-- Índices para filtro geo
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('antojados_core.soc_posts')
      AND name = 'IX_soc_posts_city_code'
)
BEGIN
    CREATE INDEX IX_soc_posts_city_code
        ON antojados_core.soc_posts (city_code)
        WHERE city_code IS NOT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('antojados_core.soc_posts')
      AND name = 'IX_soc_posts_zone_code'
)
BEGIN
    CREATE INDEX IX_soc_posts_zone_code
        ON antojados_core.soc_posts (zone_code)
        WHERE zone_code IS NOT NULL;
END
GO

PRINT 'Migration 18_alter_posts_add_geo_columns.sql completada.';
PRINT '  - biz_posts: +city_code, +zone_code + índices';
PRINT '  - soc_posts: +city_code, +zone_code + índices';
GO
