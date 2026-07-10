CREATE TABLE antojados_core.biz_post_media (
    media_id     NVARCHAR(64)    NOT NULL PRIMARY KEY,
    post_id      NVARCHAR(64)    NOT NULL,
    sponsor_id   NVARCHAR(64)    NOT NULL,
    media_type   NVARCHAR(20)    NOT NULL,
    media_url    NVARCHAR(1000)  NOT NULL,
    sort_order   INT             NOT NULL DEFAULT 0,
    asset_id     NVARCHAR(64)    NULL,
    thumb_url    NVARCHAR(1000)  NULL,
    feed_url     NVARCHAR(1000)  NULL,
    full_url     NVARCHAR(1000)  NULL,
    created_at   DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_biz_post_media_post
        FOREIGN KEY (post_id) REFERENCES antojados_core.biz_posts(biz_post_id)
        ON DELETE CASCADE
);

CREATE NONCLUSTERED INDEX IX_biz_post_media_post_id ON antojados_core.biz_post_media (post_id);
CREATE NONCLUSTERED INDEX IX_biz_post_media_sort_order ON antojados_core.biz_post_media (post_id, sort_order);
GO

