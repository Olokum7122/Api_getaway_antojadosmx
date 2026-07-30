-- ============================================================
-- DDL: Feed peripheral tables
--
-- DOMINIO:      AntojadosMX — Perifericos de Feed
-- RESPONSABLE:  Definir almacenamiento fisico para interacciones BIZ
--               faltantes y para Morral/Califica por post, sin depender
--               de place_id ni de rutas legacy.
--
-- TABLAS:
--   - biz_post_interactions: requerida por SPs BIZ existentes.
--   - feed_post_saves: Morral por feed_scope/post BIZ o SOC.
--   - feed_post_ratings: Califica/resena por feed_scope/post BIZ o SOC.
--   - soc_post_ratings: compatibilidad con placesResolver existente.
--   - rating_phrase: catalogo usado por rating.routes.
--
-- EJECUTAR CON PRECAUCION: usa IF NOT EXISTS y no sobreescribe datos.
-- ============================================================

IF NOT EXISTS (
    SELECT *
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'antojados_core'
      AND t.name = 'biz_post_interactions'
)
BEGIN
    CREATE TABLE antojados_core.biz_post_interactions (
        interaction_id      NVARCHAR(64)   NOT NULL DEFAULT LOWER(NEWID()),
        biz_post_id         NVARCHAR(64)   NOT NULL,
        user_id             NVARCHAR(64)   NOT NULL,
        interaction_type    NVARCHAR(30)   NOT NULL,
            -- like_created, comment_created, reply_created, post_viewed, post_shared, post_saved, rating_submitted
        content_text        NVARCHAR(2000) NULL,
        parent_comment_id   NVARCHAR(64)   NULL,
        moderation_status   NVARCHAR(20)   NOT NULL DEFAULT 'approved',
            -- pending, approved, rejected, flagged
        created_at_client   DATETIME2(3)   NULL,
        received_at_server  DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_biz_post_interactions PRIMARY KEY CLUSTERED (interaction_id),
        CONSTRAINT FK_biz_post_interactions_post FOREIGN KEY (biz_post_id)
            REFERENCES antojados_core.biz_posts(biz_post_id) ON DELETE CASCADE
    );

    CREATE INDEX IX_biz_post_interactions_post_id
        ON antojados_core.biz_post_interactions(biz_post_id, interaction_type)
        INCLUDE (user_id, content_text, received_at_server);

    CREATE INDEX IX_biz_post_interactions_user_id
        ON antojados_core.biz_post_interactions(user_id, interaction_type);

    CREATE INDEX IX_biz_post_interactions_parent
        ON antojados_core.biz_post_interactions(parent_comment_id)
        WHERE parent_comment_id IS NOT NULL;

    CREATE UNIQUE INDEX UX_biz_post_interactions_like_user_post
        ON antojados_core.biz_post_interactions(biz_post_id, user_id, interaction_type)
        WHERE interaction_type = 'like_created';
END;
GO

IF NOT EXISTS (
    SELECT *
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'antojados_core'
      AND t.name = 'soc_post_ratings'
)
BEGIN
    CREATE TABLE antojados_core.soc_post_ratings (
        rating_id           NVARCHAR(64)   NOT NULL DEFAULT LOWER(NEWID()),
        post_id             NVARCHAR(64)   NOT NULL,
        user_id             NVARCHAR(64)   NOT NULL,
        taste               TINYINT        NULL,
        price               TINYINT        NULL,
        service             TINYINT        NULL,
        cleanliness         TINYINT        NULL,
        ambience            TINYINT        NULL,
        wait_time           TINYINT        NULL,
        review_text         NVARCHAR(2000) NULL,
        moderation_status   NVARCHAR(20)   NOT NULL DEFAULT 'approved',
        created_at_client   DATETIME2(3)   NULL,
        received_at_server  DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_soc_post_ratings PRIMARY KEY CLUSTERED (rating_id),
        CONSTRAINT FK_soc_post_ratings_post FOREIGN KEY (post_id)
            REFERENCES antojados_core.soc_posts(post_id) ON DELETE CASCADE,
        CONSTRAINT CK_soc_post_ratings_taste CHECK (taste IS NULL OR taste BETWEEN 1 AND 5),
        CONSTRAINT CK_soc_post_ratings_price CHECK (price IS NULL OR price BETWEEN 1 AND 5),
        CONSTRAINT CK_soc_post_ratings_service CHECK (service IS NULL OR service BETWEEN 1 AND 5),
        CONSTRAINT CK_soc_post_ratings_cleanliness CHECK (cleanliness IS NULL OR cleanliness BETWEEN 1 AND 5),
        CONSTRAINT CK_soc_post_ratings_ambience CHECK (ambience IS NULL OR ambience BETWEEN 1 AND 5),
        CONSTRAINT CK_soc_post_ratings_wait_time CHECK (wait_time IS NULL OR wait_time BETWEEN 1 AND 5)
    );

    CREATE INDEX IX_soc_post_ratings_post
        ON antojados_core.soc_post_ratings(post_id, moderation_status)
        INCLUDE (user_id, received_at_server);

    CREATE INDEX IX_soc_post_ratings_user
        ON antojados_core.soc_post_ratings(user_id, received_at_server DESC);
END;
GO

IF NOT EXISTS (
    SELECT *
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'antojados_core'
      AND t.name = 'rating_phrase'
)
BEGIN
    CREATE TABLE antojados_core.rating_phrase (
        phrase_id           NVARCHAR(64)   NOT NULL DEFAULT LOWER(NEWID()),
        dim                 NVARCHAR(30)   NOT NULL,
            -- taste, price, service, cleanliness, ambience, wait_time
        level               TINYINT        NOT NULL,
        phrase              NVARCHAR(240)  NOT NULL,
        status              NVARCHAR(20)   NOT NULL DEFAULT 'active',
        created_at          DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_rating_phrase PRIMARY KEY CLUSTERED (phrase_id),
        CONSTRAINT CK_rating_phrase_level CHECK (level BETWEEN 1 AND 5)
    );

    CREATE INDEX IX_rating_phrase_dim_level
        ON antojados_core.rating_phrase(dim, level, status);
END;
GO

IF NOT EXISTS (
    SELECT *
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'antojados_core'
      AND t.name = 'feed_post_saves'
)
BEGIN
    CREATE TABLE antojados_core.feed_post_saves (
        save_id             NVARCHAR(64)  NOT NULL DEFAULT LOWER(NEWID()),
        feed_scope          NVARCHAR(30)  NOT NULL,
        post_type           NVARCHAR(10)  NOT NULL,
            -- biz, soc
        biz_post_id         NVARCHAR(64)  NULL,
        post_id             NVARCHAR(64)  NULL,
        user_id             NVARCHAR(64)  NOT NULL,
        status              NVARCHAR(20)  NOT NULL DEFAULT 'active',
            -- active, removed
        created_at_client   DATETIME2(3)  NULL,
        received_at_server  DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_feed_post_saves PRIMARY KEY CLUSTERED (save_id),
        CONSTRAINT CK_feed_post_saves_type CHECK (post_type IN ('biz', 'soc')),
        CONSTRAINT CK_feed_post_saves_target CHECK (
            (post_type = 'biz' AND biz_post_id IS NOT NULL AND post_id IS NULL)
            OR
            (post_type = 'soc' AND post_id IS NOT NULL AND biz_post_id IS NULL)
        ),
        CONSTRAINT FK_feed_post_saves_biz_post FOREIGN KEY (biz_post_id)
            REFERENCES antojados_core.biz_posts(biz_post_id),
        CONSTRAINT FK_feed_post_saves_soc_post FOREIGN KEY (post_id)
            REFERENCES antojados_core.soc_posts(post_id)
    );

    CREATE INDEX IX_feed_post_saves_biz_post
        ON antojados_core.feed_post_saves(biz_post_id, status)
        INCLUDE (user_id, feed_scope, received_at_server)
        WHERE biz_post_id IS NOT NULL;

    CREATE INDEX IX_feed_post_saves_soc_post
        ON antojados_core.feed_post_saves(post_id, status)
        INCLUDE (user_id, feed_scope, received_at_server)
        WHERE post_id IS NOT NULL;

    CREATE INDEX IX_feed_post_saves_user
        ON antojados_core.feed_post_saves(user_id, status, received_at_server DESC);

    CREATE UNIQUE INDEX UX_feed_post_saves_active_biz
        ON antojados_core.feed_post_saves(biz_post_id, user_id)
        WHERE biz_post_id IS NOT NULL AND status = 'active';

    CREATE UNIQUE INDEX UX_feed_post_saves_active_soc
        ON antojados_core.feed_post_saves(post_id, user_id)
        WHERE post_id IS NOT NULL AND status = 'active';
END;
GO

IF NOT EXISTS (
    SELECT *
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'antojados_core'
      AND t.name = 'feed_post_ratings'
)
BEGIN
    CREATE TABLE antojados_core.feed_post_ratings (
        rating_id           NVARCHAR(64)   NOT NULL DEFAULT LOWER(NEWID()),
        feed_scope          NVARCHAR(30)   NOT NULL,
        post_type           NVARCHAR(10)   NOT NULL,
            -- biz, soc
        biz_post_id         NVARCHAR(64)   NULL,
        post_id             NVARCHAR(64)   NULL,
        user_id             NVARCHAR(64)   NOT NULL,
        rating_origin       NVARCHAR(40)   NULL,
            -- feed_rail, review_rail, review_input
        taste               TINYINT        NULL,
        price               TINYINT        NULL,
        service             TINYINT        NULL,
        cleanliness         TINYINT        NULL,
        ambience            TINYINT        NULL,
        wait_time           TINYINT        NULL,
        review_text         NVARCHAR(2000) NULL,
        raw_payload         NVARCHAR(MAX)  NULL,
        moderation_status   NVARCHAR(20)   NOT NULL DEFAULT 'approved',
        created_at_client   DATETIME2(3)   NULL,
        received_at_server  DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_feed_post_ratings PRIMARY KEY CLUSTERED (rating_id),
        CONSTRAINT CK_feed_post_ratings_type CHECK (post_type IN ('biz', 'soc')),
        CONSTRAINT CK_feed_post_ratings_target CHECK (
            (post_type = 'biz' AND biz_post_id IS NOT NULL AND post_id IS NULL)
            OR
            (post_type = 'soc' AND post_id IS NOT NULL AND biz_post_id IS NULL)
        ),
        CONSTRAINT CK_feed_post_ratings_taste CHECK (taste IS NULL OR taste BETWEEN 1 AND 5),
        CONSTRAINT CK_feed_post_ratings_price CHECK (price IS NULL OR price BETWEEN 1 AND 5),
        CONSTRAINT CK_feed_post_ratings_service CHECK (service IS NULL OR service BETWEEN 1 AND 5),
        CONSTRAINT CK_feed_post_ratings_cleanliness CHECK (cleanliness IS NULL OR cleanliness BETWEEN 1 AND 5),
        CONSTRAINT CK_feed_post_ratings_ambience CHECK (ambience IS NULL OR ambience BETWEEN 1 AND 5),
        CONSTRAINT CK_feed_post_ratings_wait_time CHECK (wait_time IS NULL OR wait_time BETWEEN 1 AND 5),
        CONSTRAINT FK_feed_post_ratings_biz_post FOREIGN KEY (biz_post_id)
            REFERENCES antojados_core.biz_posts(biz_post_id),
        CONSTRAINT FK_feed_post_ratings_soc_post FOREIGN KEY (post_id)
            REFERENCES antojados_core.soc_posts(post_id)
    );

    CREATE INDEX IX_feed_post_ratings_biz_post
        ON antojados_core.feed_post_ratings(biz_post_id, moderation_status)
        INCLUDE (user_id, feed_scope, rating_origin, received_at_server)
        WHERE biz_post_id IS NOT NULL;

    CREATE INDEX IX_feed_post_ratings_soc_post
        ON antojados_core.feed_post_ratings(post_id, moderation_status)
        INCLUDE (user_id, feed_scope, rating_origin, received_at_server)
        WHERE post_id IS NOT NULL;

    CREATE INDEX IX_feed_post_ratings_user
        ON antojados_core.feed_post_ratings(user_id, received_at_server DESC);
END;
GO