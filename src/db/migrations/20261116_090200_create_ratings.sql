-- UP
-- Personnel record. service_number is the primary key (e.g. B0539, B0559F), so this table
-- has no surrogate id. Every child table points at it with ON UPDATE CASCADE, so a
-- corrected service number carries through to all related records.
CREATE TABLE ratings (
  service_number                VARCHAR(20)  NOT NULL,
  status                        ENUM('current','former') NOT NULL DEFAULT 'current',

  -- Step 1: Basic Details
  rate_id                       INT UNSIGNED NULL,
  title_id                      INT UNSIGNED NULL,
  surname                       VARCHAR(100) NOT NULL,
  first_name                    VARCHAR(100) NOT NULL,
  middle_name                   VARCHAR(100) NULL,
  maiden_name                   VARCHAR(100) NULL,
  gender_id                     INT UNSIGNED NULL,
  date_of_birth                 DATE         NULL,
  marital_status_id             INT UNSIGNED NULL,
  married_to_military_personnel VARCHAR(100) NULL,
  religion_id                   INT UNSIGNED NULL,
  religion_denomination_id      INT UNSIGNED NULL,
  tribe_id                      INT UNSIGNED NULL,
  passport_photo_path           VARCHAR(255) NULL,
  next_of_kin_photo_path        VARCHAR(255) NULL,

  -- Step 2: Contact
  state_id                      INT UNSIGNED NULL,
  local_government_id           INT UNSIGNED NULL,
  home_address                  TEXT         NULL,
  mother_base_id                INT UNSIGNED NULL,
  place_of_birth                VARCHAR(150) NULL,
  email_address                 VARCHAR(150) NULL,
  phone                         VARCHAR(30)  NULL,
  geo_political_zone_id         INT UNSIGNED NULL,
  driver_license_number         VARCHAR(50)  NULL,
  driver_license_expiry_date    DATE         NULL,
  identification_type_id        INT UNSIGNED NULL,
  identity_number               VARCHAR(50)  NULL,

  -- Step 3: Health Info
  weight_kg                     DECIMAL(5,2) NULL,
  height_m                      DECIMAL(3,2) NULL,
  chest_cm                      DECIMAL(5,1) NULL,
  hair_color_id                 INT UNSIGNED NULL,
  eye_color_id                  INT UNSIGNED NULL,
  complexion_id                 INT UNSIGNED NULL,
  blood_group_id                INT UNSIGNED NULL,
  blood_genotype_id             INT UNSIGNED NULL,
  tribal_mark                   TINYINT(1)   NOT NULL DEFAULT 0,
  disability_id                 INT UNSIGNED NULL,
  disability_comment            TEXT         NULL,

  -- Step 4: Official (current ship is NOT stored here: it is the open rating_drafting row)
  branch_id                     INT UNSIGNED NULL,
  command_id                    INT UNSIGNED NULL,
  staff_branch_id               INT UNSIGNED NULL,
  seniority_date                DATE         NULL,
  entry_mode_id                 INT UNSIGNED NULL,
  exit_type_id                  INT UNSIGNED NULL,
  exit_date                     DATE         NULL,
  exit_reason                   TEXT         NULL,
  date_employed                 DATE         NULL,
  specialisation_id             INT UNSIGNED NULL,
  hobbies                       VARCHAR(255) NULL,

  created_at                    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by                    INT UNSIGNED NULL,
  PRIMARY KEY (service_number),
  KEY ix_ratings_status (status),
  KEY ix_ratings_name (surname, first_name),
  CONSTRAINT fk_ratings_rate           FOREIGN KEY (rate_id)                  REFERENCES ref_rate (id),
  CONSTRAINT fk_ratings_title          FOREIGN KEY (title_id)                 REFERENCES ref_title (id),
  CONSTRAINT fk_ratings_gender         FOREIGN KEY (gender_id)                REFERENCES ref_gender (id),
  CONSTRAINT fk_ratings_marital        FOREIGN KEY (marital_status_id)        REFERENCES ref_marital_status (id),
  CONSTRAINT fk_ratings_religion       FOREIGN KEY (religion_id)              REFERENCES ref_religion (id),
  CONSTRAINT fk_ratings_denom          FOREIGN KEY (religion_denomination_id) REFERENCES ref_religion_denomination (id),
  CONSTRAINT fk_ratings_tribe          FOREIGN KEY (tribe_id)                 REFERENCES ref_tribe (id),
  CONSTRAINT fk_ratings_state          FOREIGN KEY (state_id)                 REFERENCES ref_state (id),
  CONSTRAINT fk_ratings_lga            FOREIGN KEY (local_government_id)      REFERENCES ref_local_government (id),
  CONSTRAINT fk_ratings_mother_base    FOREIGN KEY (mother_base_id)           REFERENCES ref_mother_base (id),
  CONSTRAINT fk_ratings_geo_zone       FOREIGN KEY (geo_political_zone_id)    REFERENCES ref_geo_political_zone (id),
  CONSTRAINT fk_ratings_ident_type     FOREIGN KEY (identification_type_id)   REFERENCES ref_identification_type (id),
  CONSTRAINT fk_ratings_hair           FOREIGN KEY (hair_color_id)            REFERENCES ref_hair_color (id),
  CONSTRAINT fk_ratings_eyes           FOREIGN KEY (eye_color_id)             REFERENCES ref_eye_color (id),
  CONSTRAINT fk_ratings_complexion     FOREIGN KEY (complexion_id)            REFERENCES ref_complexion (id),
  CONSTRAINT fk_ratings_blood_group    FOREIGN KEY (blood_group_id)           REFERENCES ref_blood_group (id),
  CONSTRAINT fk_ratings_genotype       FOREIGN KEY (blood_genotype_id)        REFERENCES ref_blood_genotype (id),
  CONSTRAINT fk_ratings_disability     FOREIGN KEY (disability_id)            REFERENCES ref_disability (id),
  CONSTRAINT fk_ratings_branch         FOREIGN KEY (branch_id)                REFERENCES ref_branch (id),
  CONSTRAINT fk_ratings_command        FOREIGN KEY (command_id)               REFERENCES ref_command (id),
  CONSTRAINT fk_ratings_staff_branch   FOREIGN KEY (staff_branch_id)          REFERENCES ref_staff_branch (id),
  CONSTRAINT fk_ratings_entry_mode     FOREIGN KEY (entry_mode_id)            REFERENCES ref_entry_mode (id),
  CONSTRAINT fk_ratings_exit_type      FOREIGN KEY (exit_type_id)             REFERENCES ref_exit_type (id),
  CONSTRAINT fk_ratings_specialisation FOREIGN KEY (specialisation_id)        REFERENCES ref_specialisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Personnel records (the people). Not login accounts - see users.';

ALTER TABLE users
  ADD CONSTRAINT fk_users_rating FOREIGN KEY (service_number)
  REFERENCES ratings (service_number) ON DELETE SET NULL ON UPDATE CASCADE;

-- DOWN
ALTER TABLE users DROP FOREIGN KEY fk_users_rating;
DROP TABLE ratings;
