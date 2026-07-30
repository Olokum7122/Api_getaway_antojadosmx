-- ============================================================
-- DDL: soc_post_interactions — Interacciones de Posts Sociales
--
-- DOMINIO:      Feed de AntojadosMX — Interacciones Sociales
-- RESPONSABLE:  Definir la estructura fisica de la tabla
--               soc_post_interactions, usada por los SPs de interaccion
--               (usp_soc_post_like, unlike, comment, view, summary).
--
-- EJECUTAR CON PRECAUCION: usa IF NOT EXISTS para evitar sobrescritura.
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'antojados_core' AND t.name = 'soc_post_interactions')
BEGIN
    CREATE TABLE antojados_core.soc_post_interactions (
        interaction_id      NVARCHAR(64)   NOT NULL DEFAULT LOWER(NEWID()),
        post_id             NVARCHAR(64)   NOT NULL,
        user_id             NVARCHAR(64)   NOT NULL,
        interaction_type    NVARCHAR(30)   NOT NULL,
            -- like_created, comment_created, reply_created, post_viewed, rating_submitted, post_shared
        content_text        NVARCHAR(2000) NULL,
        parent_comment_id   NVARCHAR(64)   NULL,
        moderation_status   NVARCHAR(20)   NOT NULL DEFAULT 'approved',
            -- pending, approved, rejected, flagged
        created_at_client   DATETIME2(3)   NULL,
        received_at_server  DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_soc_post_interactions PRIMARY KEY CLUSTERED (interaction_id),
        CONSTRAINT FK_soc_post_interactions_post FOREIGN KEY (post_id)
            REFERENCES antojados_core.soc_posts(post_id) ON DELETE CASCADE
    );

    CREATE INDEX IX_soc_post_interactions_post_id
        ON antojados_core.soc_post_interactions(post_id, interaction_type)
        INCLUDE (user_id, content_text, received_at_server);

    CREATE INDEX IX_soc_post_interactions_user_id
        ON antojados_core.soc_post_interactions(user_id, interaction_type);

    CREATE INDEX IX_soc_post_interactions_parent
        ON antojados_core.soc_post_interactions(parent_comment_id)
        WHERE parent_comment_id IS NOT NULL;
END;
GO