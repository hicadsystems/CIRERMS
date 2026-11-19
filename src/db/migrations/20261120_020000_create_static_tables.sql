-- UP
-- Static Tables (WP2). The 16 tables drive the other modules, so each carries what they need (codes,
-- flags, links) and every old column that held real data (docs/legacy/static-tables.md), so the later
-- import of the old records loses nothing. Dead old columns (never saved) are not carried.
-- Codes are NULL-able here (so the migration runs on a table that has rows) and unique; the engine
-- (src/modules/tables) requires them where the specification says so. A foreign key is declared for
-- every link: the in-use check on delete reads them from information_schema.

-- Branch: the code goes in the drafting and advancement batch numbers (DOD-SM-...)
ALTER TABLE ref_branch
  ADD COLUMN code VARCHAR(2) NULL AFTER name,
  ADD UNIQUE KEY uq_ref_branch_code (code);

-- Exit Type: the code (A, M and C kept a rating current), the flag that decides Current or Former, and
-- Death (Discharge shows the death documents only for an exit type marked Death)
ALTER TABLE ref_exit_type
  ADD COLUMN code VARCHAR(2) NULL AFTER name,
  ADD COLUMN keeps_current TINYINT(1) NOT NULL DEFAULT 0 AFTER code,
  ADD COLUMN is_death TINYINT(1) NOT NULL DEFAULT 0 AFTER keeps_current,
  ADD UNIQUE KEY uq_ref_exit_type_code (code);

ALTER TABLE ref_entry_mode
  ADD COLUMN code VARCHAR(5) NULL AFTER name,
  ADD UNIQUE KEY uq_ref_entry_mode_code (code);

ALTER TABLE ref_local_government
  ADD COLUMN code VARCHAR(10) NULL AFTER name,
  ADD UNIQUE KEY uq_ref_local_government_code (code);

ALTER TABLE ref_next_of_kin_type
  ADD COLUMN code VARCHAR(5) NULL AFTER name,
  ADD UNIQUE KEY uq_ref_next_of_kin_type_code (code);

-- Staff Branch: the rating form's list follows the chosen Command
ALTER TABLE ref_staff_branch
  ADD COLUMN code       VARCHAR(20)  NULL AFTER name,
  ADD COLUMN command_id INT UNSIGNED NULL AFTER code,
  ADD COLUMN department VARCHAR(20)  NULL AFTER command_id,
  ADD COLUMN cdr        VARCHAR(20)  NULL AFTER department,
  ADD UNIQUE KEY uq_ref_staff_branch_code (code),
  ADD CONSTRAINT fk_ref_staff_branch_command FOREIGN KEY (command_id) REFERENCES ref_command (id);

-- Specialisation: the code goes in the batch numbers; the specialisation is the department whose
-- approval Drafting and Advancement ask for
ALTER TABLE ref_specialisation
  ADD COLUMN code               VARCHAR(15) NULL AFTER name,
  ADD COLUMN second_description VARCHAR(20) NULL AFTER code,
  ADD UNIQUE KEY uq_ref_specialisation_code (code);

-- Ships: Ship, Base or Training (the old Sea, Land and Training), its command and description
ALTER TABLE ref_ship
  ADD COLUMN type        VARCHAR(20)  NOT NULL DEFAULT 'Ship' AFTER name,
  ADD COLUMN command_id  INT UNSIGNED NULL AFTER type,
  ADD COLUMN description VARCHAR(150) NULL AFTER command_id,
  ADD CONSTRAINT fk_ref_ship_command FOREIGN KEY (command_id) REFERENCES ref_command (id);

-- States: the rating form fills the geo-political zone from the chosen state
ALTER TABLE ref_state
  ADD COLUMN code VARCHAR(5) NULL AFTER name,
  ADD COLUMN geo_political_zone_id INT UNSIGNED NULL AFTER code,
  ADD UNIQUE KEY uq_ref_state_code (code),
  ADD CONSTRAINT fk_ref_state_zone FOREIGN KEY (geo_political_zone_id) REFERENCES ref_geo_political_zone (id);

ALTER TABLE ref_title
  ADD COLUMN description VARCHAR(50) NULL AFTER name;

-- Rates (no screen, seeded): the code, and sort_order is the rank order (lowest rate first)
ALTER TABLE ref_rate
  ADD COLUMN code VARCHAR(5) NULL AFTER name,
  ADD UNIQUE KEY uq_ref_rate_code (code);

-- Appraisal Ratings: Code, Grade, lowest and highest score (0 to 100; no two grades overlap, checked by the engine)
CREATE TABLE ref_appraisal_rating (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(5)   NOT NULL,
  name        VARCHAR(50)  NOT NULL,
  score_low   TINYINT UNSIGNED NOT NULL,
  score_high  TINYINT UNSIGNED NOT NULL,
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
  code       VARCHAR(10)  NOT NULL,
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
  code       VARCHAR(30)  NULL,
  name       VARCHAR(100) NOT NULL,
  location   VARCHAR(100) NULL,
  type       VARCHAR(30)  NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_institution_name (name),
  UNIQUE KEY uq_ref_institution_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Training: a course and who may attend it (PLAN 9c decision 4). branch_id and
-- specialisation_id NULL mean Any; no row in ref_training_rate means every rate.
CREATE TABLE ref_training (
  id                INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  code              VARCHAR(10)       NULL,
  name              VARCHAR(60)       NOT NULL,
  qualification     VARCHAR(50)       NULL,
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
  UNIQUE KEY uq_ref_training_code (code),
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

-- The rating's Education and Training entries point at the tables (an existing entry keeps its text
-- until the import maps it; the record still shows the name)
ALTER TABLE rating_education
  ADD COLUMN institution_id INT UNSIGNED NULL AFTER institution,
  ADD CONSTRAINT fk_rating_education_institution FOREIGN KEY (institution_id) REFERENCES ref_institution (id);

ALTER TABLE rating_training
  ADD COLUMN institution_id     INT UNSIGNED NULL AFTER institution,
  ADD COLUMN training_course_id INT UNSIGNED NULL AFTER institution_id,
  ADD CONSTRAINT fk_rating_training_institution FOREIGN KEY (institution_id) REFERENCES ref_institution (id),
  ADD CONSTRAINT fk_rating_training_course FOREIGN KEY (training_course_id) REFERENCES ref_training (id);

-- DOWN
ALTER TABLE rating_training DROP FOREIGN KEY fk_rating_training_course, DROP FOREIGN KEY fk_rating_training_institution,
  DROP COLUMN training_course_id, DROP COLUMN institution_id;
ALTER TABLE rating_education DROP FOREIGN KEY fk_rating_education_institution, DROP COLUMN institution_id;
DROP TABLE ref_training_rate;
DROP TABLE ref_training;
DROP TABLE ref_institution;
DROP TABLE ref_disciplinary_sanction;
DROP TABLE ref_disciplinary_offence;
DROP TABLE ref_appraisal_rating;
ALTER TABLE ref_rate DROP INDEX uq_ref_rate_code, DROP COLUMN code;
ALTER TABLE ref_title DROP COLUMN description;
ALTER TABLE ref_state DROP FOREIGN KEY fk_ref_state_zone, DROP INDEX uq_ref_state_code, DROP COLUMN geo_political_zone_id, DROP COLUMN code;
ALTER TABLE ref_ship DROP FOREIGN KEY fk_ref_ship_command, DROP COLUMN description, DROP COLUMN command_id, DROP COLUMN type;
ALTER TABLE ref_specialisation DROP INDEX uq_ref_specialisation_code, DROP COLUMN second_description, DROP COLUMN code;
ALTER TABLE ref_staff_branch DROP FOREIGN KEY fk_ref_staff_branch_command, DROP INDEX uq_ref_staff_branch_code,
  DROP COLUMN cdr, DROP COLUMN department, DROP COLUMN command_id, DROP COLUMN code;
ALTER TABLE ref_next_of_kin_type DROP INDEX uq_ref_next_of_kin_type_code, DROP COLUMN code;
ALTER TABLE ref_local_government DROP INDEX uq_ref_local_government_code, DROP COLUMN code;
ALTER TABLE ref_entry_mode DROP INDEX uq_ref_entry_mode_code, DROP COLUMN code;
ALTER TABLE ref_exit_type DROP INDEX uq_ref_exit_type_code, DROP COLUMN is_death, DROP COLUMN keeps_current, DROP COLUMN code;
ALTER TABLE ref_branch DROP INDEX uq_ref_branch_code, DROP COLUMN code;
