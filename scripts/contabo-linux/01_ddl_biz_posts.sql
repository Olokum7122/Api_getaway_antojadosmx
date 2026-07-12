CREATE TABLE antojados_core.biz_posts (
    biz_post_id          NVARCHAR(64)    NOT NULL PRIMARY KEY,
    sponsor_id           NVARCHAR(64)    NOT NULL,
    channel              NVARCHAR(30)    NOT NULL,
    feed_type            NVARCHAR(30)    NULL,
    city_code            NVARCHAR(20)    NULL,
    zone_code            NVARCHAR(20)    NULL,
    media_url            NVARCHAR(500)   NULL,
    doc_json             NVARCHAR(MAX)   NULL,
    views_count          INT             NOT NULL DEFAULT 0,
    likes_count          INT             NOT NULL DEFAULT 0,
    comments_count       INT             NOT NULL DEFAULT 0,
    shares_count         INT             NOT NULL DEFAULT 0,
    cta_clicks_count     INT             NOT NULL DEFAULT 0,
    taps_whatsapp_count  INT             NOT NULL DEFAULT 0,
    taps_maps_count      INT             NOT NULL DEFAULT 0,
    engagement_score     DECIMAL(10,4)   NOT NULL DEFAULT 0,
    status               NVARCHAR(20)    NOT NULL DEFAULT 'active',
    created_at           DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE NONCLUSTERED INDEX IX_biz_posts_sponsor_id ON antojados_core.biz_posts (sponsor_id);
CREATE NONCLUSTERED INDEX IX_biz_posts_channel ON antojados_core.biz_posts (channel);
CREATE NONCLUSTERED INDEX IX_biz_posts_city_code ON antojados_core.biz_posts (city_code) WHERE city_code IS NOT NULL;
CREATE NONCLUSTERED INDEX IX_biz_posts_zone_code ON antojados_core.biz_posts (zone_code) WHERE zone_code IS NOT NULL;
CREATE NONCLUSTERED INDEX IX_biz_posts_status ON antojados_core.biz_posts (status);
CREATE NONCLUSTERED INDEX IX_biz_posts_created_at ON antojados_core.biz_posts (created_at DESC);
GO
