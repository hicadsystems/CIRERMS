-- UP
-- Disciplinary Action (WP4). A case is opened against a current rating (pending), then concluded
-- with a decision date, sanction, decision and authority, or cancelled with a reason. Nothing is
-- deleted. The rate and ship are those the rating had when the case was opened. A concluded case is
-- final apart from a correction, which keeps the before and after of each changed field.
CREATE TABLE discipline_cases (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_number    VARCHAR(12)  NOT NULL,
  service_number VARCHAR(20)  NOT NULL,
  rate_id        INT UNSIGNED NULL,
  ship_id        INT UNSIGNED NULL,
  incident_date  DATE         NOT NULL,
  offence_id     INT UNSIGNED NOT NULL,
  what_happened  VARCHAR(250) NOT NULL,
  reported_by    VARCHAR(150) NOT NULL,
  status         ENUM('pending','concluded','cancelled') NOT NULL DEFAULT 'pending',
  decision_date  DATE         NULL,
  sanction_id    INT UNSIGNED NULL,
  decision       VARCHAR(250) NULL,
  authority      VARCHAR(150) NULL,
  cancel_reason  VARCHAR(200) NULL,
  opened_by      INT UNSIGNED NULL,
  opened_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concluded_by   INT UNSIGNED NULL,
  concluded_at   DATETIME     NULL,
  cancelled_by   INT UNSIGNED NULL,
  cancelled_at   DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by     INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_discipline_cases_number (case_number),
  KEY ix_discipline_cases_rating (service_number, status),
  KEY ix_discipline_cases_status (status, incident_date),
  KEY ix_discipline_cases_decided (status, decision_date),
  CONSTRAINT fk_discipline_cases_rating   FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_discipline_cases_rate     FOREIGN KEY (rate_id)      REFERENCES ref_rate (id),
  CONSTRAINT fk_discipline_cases_ship     FOREIGN KEY (ship_id)      REFERENCES ref_ship (id),
  CONSTRAINT fk_discipline_cases_offence  FOREIGN KEY (offence_id)   REFERENCES ref_disciplinary_offence (id),
  CONSTRAINT fk_discipline_cases_sanction FOREIGN KEY (sanction_id)  REFERENCES ref_disciplinary_sanction (id),
  CONSTRAINT fk_discipline_cases_opened   FOREIGN KEY (opened_by)    REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_discipline_cases_concl    FOREIGN KEY (concluded_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_discipline_cases_cancel   FOREIGN KEY (cancelled_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Disciplinary cases: pending, concluded or cancelled.';

-- One row per correction of a concluded case: who, when, why, and [[field, from, to], ...].
CREATE TABLE discipline_case_corrections (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id      INT UNSIGNED NOT NULL,
  corrected_by INT UNSIGNED NULL,
  corrected_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason       VARCHAR(200) NOT NULL,
  changes      JSON         NOT NULL,
  PRIMARY KEY (id),
  KEY ix_discipline_corrections_case (case_id),
  CONSTRAINT fk_discipline_corrections_case FOREIGN KEY (case_id) REFERENCES discipline_cases (id) ON DELETE CASCADE,
  CONSTRAINT fk_discipline_corrections_user FOREIGN KEY (corrected_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Corrections of concluded cases, with the reason.';

-- DOWN
DROP TABLE discipline_case_corrections;
DROP TABLE discipline_cases;
