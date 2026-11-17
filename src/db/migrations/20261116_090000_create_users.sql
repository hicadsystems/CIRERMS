-- UP
-- System login accounts. NOT the same thing as ratings (personnel records).
-- service_number is optional: set it only when the account belongs to a rating, so
-- "View My Details" knows which record to show. Admin accounts (e.g. HICO001) leave it NULL.
-- The foreign key to ratings is added in 20261116_090200_create_ratings.sql.
CREATE TABLE users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username       VARCHAR(50)  NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  full_name      VARCHAR(150) NOT NULL,
  role           VARCHAR(30)  NOT NULL DEFAULT 'admin',
  service_number VARCHAR(20)  NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at  DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by     INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_service_number (service_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='System login accounts. Not personnel records - see ratings.';

-- DOWN
DROP TABLE users;
