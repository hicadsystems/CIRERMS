-- UP
-- Static Tables (WP2): the five tables the demo shows that had no table yet, and the one column
-- an existing table lacked (a ship's Type). Same shape as every ref_ table (docs/CONVENTIONS.md,
-- Database): id, name, sort_order, is_active, created_at, updated_at, created_by.

-- A ship or a shore base (the demo's Type column on Ships)
ALTER TABLE ref_ship
  ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'Ship' AFTER name;

-- Appraisal Ratings: Grade, Code, Score Range
CREATE TABLE ref_appraisal_rating (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(50)  NOT NULL,
  code        VARCHAR(5)   NOT NULL,
  score_range VARCHAR(20)  NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by  INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_appraisal_rating_name (name),
  UNIQUE KEY uq_ref_appraisal_rating_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Disciplinary Offence: Offence, Code, Category
CREATE TABLE ref_disciplinary_offence (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  code       VARCHAR(10)  NULL,
  category   VARCHAR(30)  NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_disciplinary_offence_name (name),
  UNIQUE KEY uq_ref_disciplinary_offence_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Disciplinary Sanction: Sanction, Severity
CREATE TABLE ref_disciplinary_sanction (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  severity   VARCHAR(10)  NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_disciplinary_sanction_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Institution: Institution, Location, Type
CREATE TABLE ref_institution (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  location   VARCHAR(100) NULL,
  type       VARCHAR(30)  NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_institution_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Training: a course and who may attend it (PLAN 9c decision 4). branch_id and
-- specialisation_id NULL mean Any; no row in ref_training_rate means every rate.
CREATE TABLE ref_training (
  id                INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  name              VARCHAR(100)      NOT NULL,
  institution_id    INT UNSIGNED      NULL,
  weeks             SMALLINT UNSIGNED NULL,
  branch_id         INT UNSIGNED      NULL,
  specialisation_id INT UNSIGNED      NULL,
  sort_order        INT               NOT NULL DEFAULT 0,
  is_active         TINYINT(1)        NOT NULL DEFAULT 1,
  created_at        DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by        INT UNSIGNED      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_training_name (name),
  CONSTRAINT fk_ref_training_institution    FOREIGN KEY (institution_id)    REFERENCES ref_institution (id),
  CONSTRAINT fk_ref_training_branch         FOREIGN KEY (branch_id)         REFERENCES ref_branch (id),
  CONSTRAINT fk_ref_training_specialisation FOREIGN KEY (specialisation_id) REFERENCES ref_specialisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_training_rate (
  training_id INT UNSIGNED NOT NULL,
  rate_id     INT UNSIGNED NOT NULL,
  PRIMARY KEY (training_id, rate_id),
  CONSTRAINT fk_ref_training_rate_training FOREIGN KEY (training_id) REFERENCES ref_training (id) ON DELETE CASCADE,
  CONSTRAINT fk_ref_training_rate_rate     FOREIGN KEY (rate_id)     REFERENCES ref_rate (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE ref_training_rate;
DROP TABLE ref_training;
DROP TABLE ref_institution;
DROP TABLE ref_disciplinary_sanction;
DROP TABLE ref_disciplinary_offence;
DROP TABLE ref_appraisal_rating;
ALTER TABLE ref_ship DROP COLUMN type;
