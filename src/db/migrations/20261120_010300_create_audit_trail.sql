-- UP
-- The audit trail: who did what, when, to which record, and what changed. Written by
-- src/shared/audit.js inside the transaction of the write it records, so a row exists only
-- for a change that was saved. Sign in, sign out, lock and unlock are recorded too.
-- changes holds [{ "field", "from", "to" }]; passwords and other secrets are never stored.
CREATE TABLE audit_trail (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  user_id     INT UNSIGNED NULL,
  username    VARCHAR(50)  NOT NULL,
  action      ENUM('INSERT','UPDATE','DELETE','SIGN IN','SIGN OUT','LOCK','UNLOCK') NOT NULL,
  table_name  VARCHAR(64)  NULL,
  record_id   VARCHAR(100) NULL,
  changes     JSON         NULL,
  ip_address  VARCHAR(45)  NULL,
  user_agent  VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_user (user_id, created_at),
  KEY idx_audit_username (username, created_at),
  KEY idx_audit_action (action, created_at),
  KEY idx_audit_record (table_name, record_id),
  CONSTRAINT fk_audit_trail_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Every saved change and every sign in, sign out, lock and unlock.';

-- DOWN
DROP TABLE audit_trail;
