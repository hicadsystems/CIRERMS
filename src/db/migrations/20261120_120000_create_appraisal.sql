-- UP
-- Naval Character Assessment (WP12): Appraisal Periods, Recommendation and Grading, Report on Appraisal.
-- PLAN 9e decisions 5 to 8; docs/design/README.md, D3 section. The grades are the Appraisal Ratings static table
-- (ref_appraisal_rating): an appraisal holds one Character grade and one Efficiency grade from it.

-- An appraisal period: a name, a start and an end (periods never overlap; names are unique). A period is open
-- when added and closes for good: a closed period is read-only everywhere. There is no delete.
CREATE TABLE appraisal_periods (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(60)  NOT NULL,
  start_date  DATE         NOT NULL,
  end_date    DATE         NOT NULL,
  status      ENUM('open','closed') NOT NULL DEFAULT 'open',
  closed_at   DATETIME     NULL,
  closed_by   INT UNSIGNED NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by  INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_appraisal_periods_name (name),
  KEY ix_appraisal_periods_dates (start_date, end_date),
  KEY ix_appraisal_periods_status (status),
  CONSTRAINT fk_appraisal_periods_closed_by FOREIGN KEY (closed_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_appraisal_periods_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- An appraisal: one rating, one period. rate_id and ship_id are the rating's rate and ship at the time it was
-- initiated (the report and the lists show those, not today's). status: active, or cancelled (with the reason,
-- who and when: nothing is deleted outright). active_slot is 1 while the appraisal is active and NULL once it is
-- cancelled, so the unique key allows one active appraisal per rating per period and any number of cancelled ones
-- (the rating may be appraised again after a cancel). The director's name and date go together or are both empty.
CREATE TABLE appraisals (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  period_id           INT UNSIGNED NOT NULL,
  service_number      VARCHAR(20)  NOT NULL,
  rate_id             INT UNSIGNED NULL,
  ship_id             INT UNSIGNED NULL,
  character_grade_id  INT UNSIGNED NOT NULL,
  efficiency_grade_id INT UNSIGNED NOT NULL,
  remark              VARCHAR(250) NULL,
  co_name             VARCHAR(100) NOT NULL,
  director_name       VARCHAR(100) NULL,
  director_date       DATE         NULL,
  status              ENUM('active','cancelled') NOT NULL DEFAULT 'active',
  active_slot         TINYINT UNSIGNED NULL DEFAULT 1,
  cancelled_reason    VARCHAR(250) NULL,
  cancelled_at        DATETIME     NULL,
  cancelled_by        INT UNSIGNED NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by          INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_appraisals_one_active (period_id, service_number, active_slot),
  KEY ix_appraisals_rating (service_number, status),
  KEY ix_appraisals_period (period_id, status),
  KEY ix_appraisals_created (created_at),
  CONSTRAINT fk_appraisals_period FOREIGN KEY (period_id) REFERENCES appraisal_periods (id),
  CONSTRAINT fk_appraisals_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_appraisals_rate FOREIGN KEY (rate_id) REFERENCES ref_rate (id),
  CONSTRAINT fk_appraisals_ship FOREIGN KEY (ship_id) REFERENCES ref_ship (id),
  CONSTRAINT fk_appraisals_character FOREIGN KEY (character_grade_id) REFERENCES ref_appraisal_rating (id),
  CONSTRAINT fk_appraisals_efficiency FOREIGN KEY (efficiency_grade_id) REFERENCES ref_appraisal_rating (id),
  CONSTRAINT fk_appraisals_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_appraisals_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE appraisals;
DROP TABLE appraisal_periods;
