-- UP
-- One row per sign-in. The session cookie names its row, so the server can end a session
-- (Sign Out), lock it (idle time or Lock Screen) and refuse every request while it is locked.
CREATE TABLE user_sessions (
  id            CHAR(32)     NOT NULL,
  user_id       INT UNSIGNED NOT NULL,
  ip_address    VARCHAR(45)  NULL,
  user_agent    VARCHAR(255) NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_at     DATETIME     NULL,
  lock_reason   ENUM('idle','manual') NULL,
  ended_at      DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_user_sessions_user (user_id),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sign-in sessions: open, locked or ended.';

-- DOWN
DROP TABLE user_sessions;
