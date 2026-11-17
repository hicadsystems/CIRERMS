-- UP
CREATE TABLE rating_next_of_kin (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_number      VARCHAR(20)  NOT NULL,
  first_name          VARCHAR(100) NOT NULL,
  last_name           VARCHAR(100) NOT NULL,
  mobile_number       VARCHAR(30)  NULL,
  next_of_kin_type_id INT UNSIGNED NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by          INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_rating_next_of_kin_sn (service_number),
  CONSTRAINT fk_rating_next_of_kin_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rating_next_of_kin_type FOREIGN KEY (next_of_kin_type_id) REFERENCES ref_next_of_kin_type (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rating_spouse (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_number VARCHAR(20)  NOT NULL,
  name           VARCHAR(200) NOT NULL,
  phone_number   VARCHAR(30)  NULL,
  email_address  VARCHAR(150) NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by     INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_rating_spouse_sn (service_number),
  CONSTRAINT fk_rating_spouse_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rating_children (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_number VARCHAR(20)  NOT NULL,
  name           VARCHAR(200) NOT NULL,
  phone_number   VARCHAR(30)  NULL,
  email_address  VARCHAR(150) NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by     INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_rating_children_sn (service_number),
  CONSTRAINT fk_rating_children_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rating_advancement (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_number VARCHAR(20)  NOT NULL,
  start_date     DATE         NULL,
  end_date       DATE         NULL,
  rate_id        INT UNSIGNED NOT NULL,
  decoration     VARCHAR(150) NULL,
  authority      VARCHAR(150) NULL,
  gcbno          VARCHAR(50)  NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by     INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_rating_advancement_sn (service_number, start_date),
  CONSTRAINT fk_rating_advancement_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rating_advancement_rate FOREIGN KEY (rate_id) REFERENCES ref_rate (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rating_drafting (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_number VARCHAR(20)  NOT NULL,
  ship_id        INT UNSIGNED NOT NULL,
  rate_id        INT UNSIGNED NULL,
  start_date     DATE         NULL,
  end_date       DATE         NULL,
  remarks        VARCHAR(500) NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by     INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_rating_drafting_sn (service_number, start_date),
  KEY ix_rating_drafting_ship (ship_id),
  CONSTRAINT fk_rating_drafting_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rating_drafting_ship FOREIGN KEY (ship_id) REFERENCES ref_ship (id),
  CONSTRAINT fk_rating_drafting_rate FOREIGN KEY (rate_id) REFERENCES ref_rate (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rating_training (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_number VARCHAR(20)  NOT NULL,
  institution    VARCHAR(200) NOT NULL,
  qualification  VARCHAR(200) NULL,
  classification VARCHAR(100) NULL,
  start_date     DATE         NULL,
  end_date       DATE         NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by     INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_rating_training_sn (service_number, start_date),
  CONSTRAINT fk_rating_training_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rating_education (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_number VARCHAR(20)  NOT NULL,
  start_date     DATE         NULL,
  end_date       DATE         NULL,
  institution    VARCHAR(200) NOT NULL,
  qualification  VARCHAR(200) NULL,
  classification VARCHAR(100) NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by     INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_rating_education_sn (service_number, start_date),
  CONSTRAINT fk_rating_education_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rating_language (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_number VARCHAR(20)  NOT NULL,
  language_id    INT UNSIGNED NOT NULL,
  can_read       TINYINT(1)   NOT NULL DEFAULT 0,
  can_write      TINYINT(1)   NOT NULL DEFAULT 0,
  can_speak      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by     INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rating_language (service_number, language_id),
  CONSTRAINT fk_rating_language_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rating_language_language FOREIGN KEY (language_id) REFERENCES ref_language (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rating_documents (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_number VARCHAR(20)  NOT NULL,
  category_id    INT UNSIGNED NOT NULL,
  original_name  VARCHAR(255) NOT NULL,
  stored_name    VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(100) NULL,
  size_bytes     INT UNSIGNED NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by     INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_rating_documents_sn (service_number, category_id),
  CONSTRAINT fk_rating_documents_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rating_documents_category FOREIGN KEY (category_id) REFERENCES ref_document_category (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE rating_documents;
DROP TABLE rating_language;
DROP TABLE rating_education;
DROP TABLE rating_training;
DROP TABLE rating_drafting;
DROP TABLE rating_advancement;
DROP TABLE rating_children;
DROP TABLE rating_spouse;
DROP TABLE rating_next_of_kin;
