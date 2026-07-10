SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;

USE ATLX_ANTOJADOS_APP;

IF OBJECT_ID(N'antojados_core.auth_password_recovery', N'U') IS NULL
BEGIN
  CREATE TABLE antojados_core.auth_password_recovery (
    id NVARCHAR(64) NOT NULL PRIMARY KEY,
    user_id NVARCHAR(64) NOT NULL,
    email_hash NVARCHAR(128) NOT NULL,
    recovery_code_hash NVARCHAR(64) NOT NULL,
    status NVARCHAR(20) NOT NULL,
    attempt_count INT NOT NULL CONSTRAINT DF_auth_password_recovery_attempt_count DEFAULT 0,
    max_attempts INT NOT NULL CONSTRAINT DF_auth_password_recovery_max_attempts DEFAULT 5,
    expires_at DATETIME2(3) NOT NULL,
    verified_at DATETIME2(3) NULL,
    used_at DATETIME2(3) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_auth_password_recovery_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_auth_password_recovery_updated_at DEFAULT SYSUTCDATETIME()
  );
END;

IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'delivery_channel') IS NULL
  ALTER TABLE antojados_core.auth_password_recovery ADD delivery_channel NVARCHAR(20) NULL;

IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'delivery_target_masked') IS NULL
  ALTER TABLE antojados_core.auth_password_recovery ADD delivery_target_masked NVARCHAR(150) NULL;

IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'delivery_status') IS NULL
  ALTER TABLE antojados_core.auth_password_recovery ADD delivery_status NVARCHAR(30) NULL;

IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'delivery_provider') IS NULL
  ALTER TABLE antojados_core.auth_password_recovery ADD delivery_provider NVARCHAR(60) NULL;

IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'provider_message_id') IS NULL
  ALTER TABLE antojados_core.auth_password_recovery ADD provider_message_id NVARCHAR(160) NULL;

IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'delivery_error') IS NULL
  ALTER TABLE antojados_core.auth_password_recovery ADD delivery_error NVARCHAR(1000) NULL;

IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'sent_at') IS NULL
  ALTER TABLE antojados_core.auth_password_recovery ADD sent_at DATETIME2(3) NULL;

IF COL_LENGTH(N'antojados_core.auth_password_recovery', N'delivered_at') IS NULL
  ALTER TABLE antojados_core.auth_password_recovery ADD delivered_at DATETIME2(3) NULL;

IF OBJECT_ID(N'antojados_core.auth_password_recovery_delivery_log', N'U') IS NULL
BEGIN
  CREATE TABLE antojados_core.auth_password_recovery_delivery_log (
    delivery_log_id NVARCHAR(64) NOT NULL PRIMARY KEY,
    recovery_request_id NVARCHAR(64) NOT NULL,
    user_id NVARCHAR(64) NOT NULL,
    delivery_channel NVARCHAR(20) NOT NULL,
    delivery_target_masked NVARCHAR(150) NULL,
    provider NVARCHAR(60) NULL,
    provider_message_id NVARCHAR(160) NULL,
    status NVARCHAR(30) NOT NULL,
    error_message NVARCHAR(1000) NULL,
    raw_response NVARCHAR(MAX) NULL,
    created_at DATETIME2(3) NOT NULL CONSTRAINT DF_auth_recovery_delivery_log_created DEFAULT SYSUTCDATETIME()
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'antojados_core.auth_password_recovery_delivery_log')
    AND name = N'IX_auth_recovery_delivery_log_request'
)
  CREATE INDEX IX_auth_recovery_delivery_log_request
    ON antojados_core.auth_password_recovery_delivery_log(recovery_request_id, created_at DESC);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'antojados_core.auth_password_recovery')
    AND name = N'IX_auth_password_recovery_delivery'
)
  CREATE INDEX IX_auth_password_recovery_delivery
    ON antojados_core.auth_password_recovery(delivery_channel, delivery_status, created_at DESC);
