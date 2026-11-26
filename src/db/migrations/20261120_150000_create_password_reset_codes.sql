-- UP
-- Forgot Password: the one-time codes e-mailed to an account. One row for each code made.
-- A code is kept only as an HMAC (code_hash, with a server secret), never in clear; the row is
-- valid until expires_at (10 minutes), allows 5 wrong tries (wrong_tries), and is deleted when
-- it is used. A code that is replaced or dead has its hash cleared and its row kept for an hour,
-- so the limit of 3 codes an account an hour can be counted.
CREATE TABLE password_reset_codes (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  code_hash     CHAR(64)     NULL,
  expires_at    DATETIME     NOT NULL,
  wrong_tries   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_password_reset_user (user_id, created_at),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='E-mailed one-time codes for Forgot Password (hashed, 10 minutes, one use).';

-- DOWN
DROP TABLE password_reset_codes;
