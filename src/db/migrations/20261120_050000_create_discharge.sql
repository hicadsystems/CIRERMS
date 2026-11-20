-- UP
-- Discharge Administration (WP5).
-- A proposal contains one row per rating. Closed rows apply the exit immediately; future exits
-- are kept in scheduled_changes and applied by the shared scheduled-change worker.
CREATE TABLE discharge_proposals (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  proposal_number  VARCHAR(20)  NOT NULL,
  proposed_by      INT UNSIGNED NULL,
  proposed_at      DATETIME     NOT NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by       INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_discharge_proposal_number (proposal_number),
  KEY ix_discharge_proposal_date (proposed_at),
  CONSTRAINT fk_discharge_proposal_user FOREIGN KEY (proposed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE discharge_rows (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  proposal_id           INT UNSIGNED NOT NULL,
  service_number        VARCHAR(20)  NOT NULL,
  exit_type_id          INT UNSIGNED NULL,
  exit_date             DATE         NULL,
  exit_reason           VARCHAR(100) NULL,
  approved_by           VARCHAR(150) NULL,
  comment               VARCHAR(500) NULL,
  death_certificate     TINYINT(1) NOT NULL DEFAULT 0,
  condolence_letter     TINYINT(1) NOT NULL DEFAULT 0,
  dependent_fund_evidence TINYINT(1) NOT NULL DEFAULT 0,
  sworn_affidavit       TINYINT(1) NOT NULL DEFAULT 0,
  status                ENUM('pending','closed','scheduled') NOT NULL DEFAULT 'pending',
  closed_by             INT UNSIGNED NULL,
  closed_at             DATETIME     NULL,
  scheduled_change_id   INT UNSIGNED NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by            INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_discharge_row_proposal_rating (proposal_id, service_number),
  KEY ix_discharge_row_rating_status (service_number, status),
  KEY ix_discharge_row_status (status),
  CONSTRAINT fk_discharge_row_proposal FOREIGN KEY (proposal_id) REFERENCES discharge_proposals (id) ON DELETE CASCADE,
  CONSTRAINT fk_discharge_row_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_discharge_row_exit_type FOREIGN KEY (exit_type_id) REFERENCES ref_exit_type (id),
  CONSTRAINT fk_discharge_row_closed_by FOREIGN KEY (closed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE discharge_reengagements (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  proposal_id     INT UNSIGNED NOT NULL,
  service_number  VARCHAR(20)  NOT NULL,
  reengage_date   DATE         NOT NULL,
  period_months   SMALLINT UNSIGNED NOT NULL,
  until_date      DATE         NOT NULL,
  approved_by     VARCHAR(150) NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by      INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_discharge_reengagement_row (proposal_id, service_number),
  KEY ix_discharge_reengagement_rating (service_number, reengage_date),
  CONSTRAINT fk_discharge_reengagement_proposal FOREIGN KEY (proposal_id) REFERENCES discharge_proposals (id) ON DELETE CASCADE,
  CONSTRAINT fk_discharge_reengagement_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE discharge_uploads (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  file_name      VARCHAR(255) NOT NULL,
  source_row_number INT UNSIGNED NOT NULL,
  service_number VARCHAR(20)  NOT NULL,
  exit_type_id   INT UNSIGNED NULL,
  exit_date      DATE         NULL,
  authority      VARCHAR(150) NULL,
  approved_by    VARCHAR(150) NULL,
  comment        VARCHAR(500) NULL,
  proposal_id    INT UNSIGNED NULL,
  row_id         INT UNSIGNED NULL,
  imported_by    INT UNSIGNED NULL,
  imported_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_discharge_upload_rating (service_number),
  CONSTRAINT fk_discharge_upload_proposal FOREIGN KEY (proposal_id) REFERENCES discharge_proposals (id) ON DELETE SET NULL,
  CONSTRAINT fk_discharge_upload_row FOREIGN KEY (row_id) REFERENCES discharge_rows (id) ON DELETE SET NULL,
  CONSTRAINT fk_discharge_upload_user FOREIGN KEY (imported_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE discharge_uploads;
DROP TABLE discharge_reengagements;
DROP TABLE discharge_rows;
DROP TABLE discharge_proposals;
