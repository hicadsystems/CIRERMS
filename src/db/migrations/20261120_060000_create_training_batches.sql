-- UP
-- Training Drafting (WP6). A training batch is one course in one month of one year (number
-- DOT-YYYY-MM-NN, NN the course id padded to two digits). It is open while ratings are added or
-- removed and attendance is recorded, and closed when its history is confirmed. Confirming adds a
-- Training entry to each attending rating's record. Nothing is deleted.
CREATE TABLE training_batches (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_number   VARCHAR(20)  NOT NULL,
  course_id      INT UNSIGNED NOT NULL,
  year           SMALLINT UNSIGNED NOT NULL,
  month          TINYINT UNSIGNED  NOT NULL,
  status         ENUM('open','closed') NOT NULL DEFAULT 'open',
  institution_id INT UNSIGNED NULL,
  start_date     DATE         NULL,
  end_date       DATE         NULL,
  opened_by      INT UNSIGNED NULL,
  opened_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_by      INT UNSIGNED NULL,
  closed_at      DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by     INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_training_batches_number (batch_number),
  UNIQUE KEY uq_training_batches_period (course_id, year, month),
  KEY ix_training_batches_status (status, year, month),
  CONSTRAINT fk_training_batches_course      FOREIGN KEY (course_id)      REFERENCES ref_training (id),
  CONSTRAINT fk_training_batches_institution FOREIGN KEY (institution_id) REFERENCES ref_institution (id),
  CONSTRAINT fk_training_batches_opened      FOREIGN KEY (opened_by)      REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_training_batches_closed      FOREIGN KEY (closed_by)      REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Training batches: one course, one month, open or closed.';

-- One row per rating in a batch. attended is set in Update Training History; start_date and
-- end_date are the rating's own dates when they differ from the batch's; result is set when the
-- history is confirmed (none for a rating that did not attend).
CREATE TABLE training_batch_ratings (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id       INT UNSIGNED NOT NULL,
  service_number VARCHAR(20)  NOT NULL,
  rate_id        INT UNSIGNED NULL,
  attended       TINYINT(1)   NOT NULL DEFAULT 1,
  start_date     DATE         NULL,
  end_date       DATE         NULL,
  result         ENUM('Distinction','Credit','Pass','Fail') NULL,
  added_by       INT UNSIGNED NULL,
  added_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  training_id    INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_training_batch_ratings (batch_id, service_number),
  KEY ix_training_batch_ratings_sn (service_number),
  CONSTRAINT fk_training_batch_ratings_batch  FOREIGN KEY (batch_id)       REFERENCES training_batches (id) ON DELETE CASCADE,
  CONSTRAINT fk_training_batch_ratings_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_training_batch_ratings_rate   FOREIGN KEY (rate_id)        REFERENCES ref_rate (id),
  CONSTRAINT fk_training_batch_ratings_user   FOREIGN KEY (added_by)       REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_training_batch_ratings_entry  FOREIGN KEY (training_id)    REFERENCES rating_training (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='The ratings of a training batch; training_id is the record entry made when it was confirmed.';

-- DOWN
DROP TABLE training_batch_ratings;
DROP TABLE training_batches;
