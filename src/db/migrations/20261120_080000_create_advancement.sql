-- UP
-- Advancement Processing (WP8). The batches, the per-department approvals and the close are WP7a's
-- (batches and batch_approvals, flow DOA); this adds the advancement's own rows table beside draft_rows,
-- and the record of each workbook row imported by Upload Advanced Rates. docs/legacy/advancement.md.

-- A rating in an advancement batch: their rate when proposed and since when, the months in it, the next
-- rate (one rate at a time, PLAN 9a decision 2), and what became of it. Status: proposed (batch open),
-- not_recommended (left out, with the reason; back on the due list next time), awaiting_board (batch
-- closed), scheduled (a board date after today: the rate changes on it), advanced (the new rate applied:
-- the rating's rate and its Advancement tab line, rating_advancement).
CREATE TABLE advancement_rows (
  id                     INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  batch_id               INT UNSIGNED      NOT NULL,
  service_number         VARCHAR(20)       NOT NULL,
  rate_id                INT UNSIGNED      NULL,
  specialisation_id      INT UNSIGNED      NULL,
  rate_since             DATE              NULL,
  months_in_rate         SMALLINT UNSIGNED NULL,
  new_rate_id            INT UNSIGNED      NULL,
  remark                 VARCHAR(250)      NULL,
  not_recommended_reason VARCHAR(250)      NULL,
  not_recommended_by     INT UNSIGNED      NULL,
  not_recommended_at     DATETIME          NULL,
  approval_id            INT UNSIGNED      NULL,
  status                 ENUM('proposed','not_recommended','awaiting_board','scheduled','advanced') NOT NULL DEFAULT 'proposed',
  board_date             DATE              NULL,
  board_set_by           INT UNSIGNED      NULL,
  board_set_at           DATETIME          NULL,
  advancement_id         INT UNSIGNED      NULL,
  scheduled_change_id    INT UNSIGNED      NULL,
  added_by               INT UNSIGNED      NULL,
  added_at               DATETIME          NOT NULL,
  created_at             DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by             INT UNSIGNED      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_advancement_rows_batch_rating (batch_id, service_number),
  KEY ix_advancement_rows_rating (service_number, status),
  KEY ix_advancement_rows_status (status),
  KEY ix_advancement_rows_specialisation (specialisation_id),
  CONSTRAINT fk_advancement_rows_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_advancement_rows_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_advancement_rows_rate FOREIGN KEY (rate_id) REFERENCES ref_rate (id),
  CONSTRAINT fk_advancement_rows_new_rate FOREIGN KEY (new_rate_id) REFERENCES ref_rate (id),
  CONSTRAINT fk_advancement_rows_specialisation FOREIGN KEY (specialisation_id) REFERENCES ref_specialisation (id),
  CONSTRAINT fk_advancement_rows_approval FOREIGN KEY (approval_id) REFERENCES batch_approvals (id),
  CONSTRAINT fk_advancement_rows_advancement FOREIGN KEY (advancement_id) REFERENCES rating_advancement (id) ON DELETE SET NULL,
  CONSTRAINT fk_advancement_rows_scheduled FOREIGN KEY (scheduled_change_id) REFERENCES scheduled_changes (id) ON DELETE SET NULL,
  CONSTRAINT fk_advancement_rows_not_recommended_by FOREIGN KEY (not_recommended_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_advancement_rows_board_set_by FOREIGN KEY (board_set_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_advancement_rows_added_by FOREIGN KEY (added_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Upload Advanced Rates: one row per workbook row imported (the old tbl_advancementUpload), with the
-- remark the Advancement tab has no column for, and the line it added.
CREATE TABLE advancement_uploads (
  id             INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  service_number VARCHAR(20)       NOT NULL,
  old_rate_id    INT UNSIGNED      NOT NULL,
  new_rate_id    INT UNSIGNED      NOT NULL,
  effective_date DATE              NOT NULL,
  authority      VARCHAR(150)      NULL,
  decoration     VARCHAR(150)      NULL,
  remark         VARCHAR(250)      NULL,
  file_name      VARCHAR(255)      NULL,
  sheet_row      SMALLINT UNSIGNED NULL,
  advancement_id INT UNSIGNED      NULL,
  uploaded_by    INT UNSIGNED      NULL,
  uploaded_at    DATETIME          NOT NULL,
  created_at     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by     INT UNSIGNED      NULL,
  PRIMARY KEY (id),
  KEY ix_advancement_uploads_rating (service_number, effective_date),
  CONSTRAINT fk_advancement_uploads_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_advancement_uploads_old_rate FOREIGN KEY (old_rate_id) REFERENCES ref_rate (id),
  CONSTRAINT fk_advancement_uploads_new_rate FOREIGN KEY (new_rate_id) REFERENCES ref_rate (id),
  CONSTRAINT fk_advancement_uploads_advancement FOREIGN KEY (advancement_id) REFERENCES rating_advancement (id) ON DELETE SET NULL,
  CONSTRAINT fk_advancement_uploads_user FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE advancement_uploads;
DROP TABLE advancement_rows;
