-- UP
-- The drafting cycle (WP7a), and three general parts later packages reuse: the settings table, the
-- scheduled changes (a move that takes effect on a later date) and the batch, approval and close tables
-- (Advancement, WP8, adds its own rows table beside draft_rows). docs/legacy/drafting.md section 15.

-- Settings: one row per value the business may change without a code change (the due rules: drafting,
-- advancement, discharge). Read and changed through src/shared/settings only.
CREATE TABLE settings (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(100) NOT NULL,
  value       VARCHAR(500) NOT NULL,
  description VARCHAR(255) NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by  INT UNSIGNED NULL,
  updated_by  INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_key (setting_key),
  CONSTRAINT fk_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Scheduled changes: a change to a rating that takes effect on a later date (a posting with a future WEF;
-- WP5's discharge with a future exit date). src/shared/scheduled applies the ones due, every hour and at
-- start, each in its own transaction, through the handler registered for its kind.
CREATE TABLE scheduled_changes (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind           VARCHAR(30)  NOT NULL,
  service_number VARCHAR(20)  NOT NULL,
  effective_date DATE         NOT NULL,
  payload        JSON         NOT NULL,
  status         ENUM('scheduled','applied','cancelled') NOT NULL DEFAULT 'scheduled',
  source_table   VARCHAR(64)  NULL,
  source_id      INT UNSIGNED NULL,
  scheduled_by   INT UNSIGNED NULL,
  scheduled_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at     DATETIME     NULL,
  outcome        VARCHAR(255) NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by     INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_scheduled_changes_due (status, effective_date),
  KEY ix_scheduled_changes_rating (service_number, status),
  KEY ix_scheduled_changes_source (source_table, source_id),
  CONSTRAINT fk_scheduled_changes_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_scheduled_changes_user FOREIGN KEY (scheduled_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Manning requirement: what a ship or unit needs, per rate and specialisation. Advisory only.
CREATE TABLE manning_requirements (
  id                INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  ship_id           INT UNSIGNED     NOT NULL,
  rate_id           INT UNSIGNED     NOT NULL,
  specialisation_id INT UNSIGNED     NOT NULL,
  quantity          TINYINT UNSIGNED NOT NULL,
  created_at        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by        INT UNSIGNED     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_manning_requirement (ship_id, rate_id, specialisation_id),
  KEY ix_manning_rate (rate_id),
  KEY ix_manning_specialisation (specialisation_id),
  CONSTRAINT fk_manning_ship FOREIGN KEY (ship_id) REFERENCES ref_ship (id),
  CONSTRAINT fk_manning_rate FOREIGN KEY (rate_id) REFERENCES ref_rate (id),
  CONSTRAINT fk_manning_specialisation FOREIGN KEY (specialisation_id) REFERENCES ref_specialisation (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Batches of every cycle: flow DOD (drafting) here, DOA (advancement, WP8) later. The number is the code
-- and a six-digit counter per code (DOD-SM-ALL-ALL-000006); the filters it was made from (NULL = All).
-- Status: open, approved (every rating has its target and every department approved; worked out again
-- after each change) or closed (final: authority and close date).
CREATE TABLE batches (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  flow              CHAR(3)      NOT NULL,
  batch_number      VARCHAR(48)  NOT NULL,
  batch_code        VARCHAR(40)  NOT NULL,
  sequence          INT UNSIGNED NOT NULL,
  branch_id         INT UNSIGNED NULL,
  specialisation_id INT UNSIGNED NULL,
  rate_id           INT UNSIGNED NULL,
  status            ENUM('open','approved','closed') NOT NULL DEFAULT 'open',
  initiated_by      INT UNSIGNED NULL,
  initiated_at      DATETIME     NOT NULL,
  closed_by         INT UNSIGNED NULL,
  closed_at         DATETIME     NULL,
  close_date        DATE         NULL,
  authority         VARCHAR(100) NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by        INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_batches_number (batch_number),
  UNIQUE KEY uq_batches_code_sequence (batch_code, sequence),
  UNIQUE KEY uq_batches_authority (authority),
  KEY ix_batches_flow_status (flow, status),
  CONSTRAINT fk_batches_branch FOREIGN KEY (branch_id) REFERENCES ref_branch (id),
  CONSTRAINT fk_batches_specialisation FOREIGN KEY (specialisation_id) REFERENCES ref_specialisation (id),
  CONSTRAINT fk_batches_rate FOREIGN KEY (rate_id) REFERENCES ref_rate (id),
  CONSTRAINT fk_batches_initiated_by FOREIGN KEY (initiated_by) REFERENCES users (id),
  CONSTRAINT fk_batches_closed_by FOREIGN KEY (closed_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A department's approval (the department is the specialisation) of its ratings in the open batches of a
-- flow. The rows it covers point to it (draft_rows.approval_id); approving again makes a new one.
CREATE TABLE batch_approvals (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  flow              CHAR(3)      NOT NULL,
  specialisation_id INT UNSIGNED NOT NULL,
  approver_rank     VARCHAR(20)  NOT NULL,
  approver_name     VARCHAR(150) NOT NULL,
  appointment       VARCHAR(150) NOT NULL,
  approved_by       INT UNSIGNED NULL,
  approved_at       DATETIME     NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by        INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_batch_approvals_dept (flow, specialisation_id),
  CONSTRAINT fk_batch_approvals_specialisation FOREIGN KEY (specialisation_id) REFERENCES ref_specialisation (id),
  CONSTRAINT fk_batch_approvals_user FOREIGN KEY (approved_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A rating in a draft batch: where they are (ship, date joined, months there, at the time of the proposal),
-- where they are proposed to go, and what became of it. Status: proposed (batch open), not_recommended
-- (left out, with the reason), awaiting_wef (batch closed), scheduled (a future WEF), reported (moved).
CREATE TABLE draft_rows (
  id                     INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  batch_id               INT UNSIGNED     NOT NULL,
  service_number         VARCHAR(20)      NOT NULL,
  rate_id                INT UNSIGNED     NULL,
  specialisation_id      INT UNSIGNED     NULL,
  current_ship_id        INT UNSIGNED     NULL,
  joined_on              DATE             NULL,
  months_on_ship         SMALLINT UNSIGNED NULL,
  proposed_ship_id       INT UNSIGNED     NULL,
  vice                   VARCHAR(150)     NULL,
  remark                 VARCHAR(250)     NULL,
  request                VARCHAR(30)      NULL,
  not_recommended_reason VARCHAR(250)     NULL,
  not_recommended_by     INT UNSIGNED     NULL,
  not_recommended_at     DATETIME         NULL,
  approval_id            INT UNSIGNED     NULL,
  status                 ENUM('proposed','not_recommended','awaiting_wef','scheduled','reported') NOT NULL DEFAULT 'proposed',
  wef                    DATE             NULL,
  wef_set_by             INT UNSIGNED     NULL,
  wef_set_at             DATETIME         NULL,
  posting_id             INT UNSIGNED     NULL,
  scheduled_change_id    INT UNSIGNED     NULL,
  added_by               INT UNSIGNED     NULL,
  added_at               DATETIME         NOT NULL,
  created_at             DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by             INT UNSIGNED     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_draft_rows_batch_rating (batch_id, service_number),
  KEY ix_draft_rows_rating (service_number, status),
  KEY ix_draft_rows_status (status),
  KEY ix_draft_rows_specialisation (specialisation_id),
  CONSTRAINT fk_draft_rows_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_draft_rows_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_draft_rows_rate FOREIGN KEY (rate_id) REFERENCES ref_rate (id),
  CONSTRAINT fk_draft_rows_specialisation FOREIGN KEY (specialisation_id) REFERENCES ref_specialisation (id),
  CONSTRAINT fk_draft_rows_current_ship FOREIGN KEY (current_ship_id) REFERENCES ref_ship (id),
  CONSTRAINT fk_draft_rows_proposed_ship FOREIGN KEY (proposed_ship_id) REFERENCES ref_ship (id),
  CONSTRAINT fk_draft_rows_approval FOREIGN KEY (approval_id) REFERENCES batch_approvals (id),
  CONSTRAINT fk_draft_rows_posting FOREIGN KEY (posting_id) REFERENCES rating_drafting (id) ON DELETE SET NULL,
  CONSTRAINT fk_draft_rows_scheduled FOREIGN KEY (scheduled_change_id) REFERENCES scheduled_changes (id) ON DELETE SET NULL,
  CONSTRAINT fk_draft_rows_not_recommended_by FOREIGN KEY (not_recommended_by) REFERENCES users (id),
  CONSTRAINT fk_draft_rows_added_by FOREIGN KEY (added_by) REFERENCES users (id),
  CONSTRAINT fk_draft_rows_wef_set_by FOREIGN KEY (wef_set_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE draft_rows;
DROP TABLE batch_approvals;
DROP TABLE batches;
DROP TABLE manning_requirements;
DROP TABLE scheduled_changes;
DROP TABLE settings;
