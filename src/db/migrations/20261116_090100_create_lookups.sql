-- UP
CREATE TABLE ref_gender (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_gender_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_marital_status (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_marital_status_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_religion (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_religion_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_religion_denomination (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  religion_id INT UNSIGNED NOT NULL,
  name        VARCHAR(150) NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by  INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_religion_denomination (religion_id, name),
  CONSTRAINT fk_ref_religion_denomination_religion FOREIGN KEY (religion_id) REFERENCES ref_religion (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_state (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_state_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_local_government (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  state_id   INT UNSIGNED NOT NULL,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_local_government (state_id, name),
  CONSTRAINT fk_ref_local_government_state FOREIGN KEY (state_id) REFERENCES ref_state (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_tribe (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_tribe_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_rate (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_rate_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_title (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_title_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_ship (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_ship_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_language (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_language_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_next_of_kin_type (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_next_of_kin_type_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_exit_type (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_exit_type_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_geo_political_zone (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_geo_political_zone_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_mother_base (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_mother_base_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_identification_type (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_identification_type_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_hair_color (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_hair_color_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_eye_color (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_eye_color_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_complexion (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_complexion_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_blood_group (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_blood_group_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_blood_genotype (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_blood_genotype_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_disability (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_disability_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_branch (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_branch_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_command (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_command_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_staff_branch (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_staff_branch_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_entry_mode (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_entry_mode_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_specialisation (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_specialisation_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ref_document_category (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code       VARCHAR(40)  NOT NULL,
  name       VARCHAR(100) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_document_category_code (code),
  UNIQUE KEY uq_ref_document_category_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE ref_document_category;
DROP TABLE ref_specialisation;
DROP TABLE ref_entry_mode;
DROP TABLE ref_staff_branch;
DROP TABLE ref_command;
DROP TABLE ref_branch;
DROP TABLE ref_disability;
DROP TABLE ref_blood_genotype;
DROP TABLE ref_blood_group;
DROP TABLE ref_complexion;
DROP TABLE ref_eye_color;
DROP TABLE ref_hair_color;
DROP TABLE ref_identification_type;
DROP TABLE ref_mother_base;
DROP TABLE ref_geo_political_zone;
DROP TABLE ref_exit_type;
DROP TABLE ref_next_of_kin_type;
DROP TABLE ref_language;
DROP TABLE ref_ship;
DROP TABLE ref_title;
DROP TABLE ref_rate;
DROP TABLE ref_tribe;
DROP TABLE ref_local_government;
DROP TABLE ref_state;
DROP TABLE ref_religion_denomination;
DROP TABLE ref_religion;
DROP TABLE ref_marital_status;
DROP TABLE ref_gender;
