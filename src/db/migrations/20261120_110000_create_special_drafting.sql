-- UP
-- Special Drafting (WP11). A special draft posts one rating outside the batch cycle, on a signal's authority.
-- It moves the rating only when its form is printed (PLAN 9e decisions 1 to 3): the move itself is WP7a's
-- posting move (src/modules/drafting/postings.service.js), never written here. docs/legacy/drafting.md.

-- The printed draft forms: one per print of a posting type's waiting drafts (Special Draft Report, Print and
-- Mark Printed). The number is SDF-YYYY-NNNN, counted per year. A form is final; Reprint changes nothing.
CREATE TABLE special_draft_forms (
  id           INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  form_number  VARCHAR(20)       NOT NULL,
  form_year    SMALLINT UNSIGNED NOT NULL,
  form_seq     INT UNSIGNED      NOT NULL,
  posting_type VARCHAR(20)       NOT NULL,
  draft_count  SMALLINT UNSIGNED NOT NULL,
  printed_by   INT UNSIGNED      NULL,
  printed_at   DATETIME          NOT NULL,
  created_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by   INT UNSIGNED      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_special_draft_forms_number (form_number),
  UNIQUE KEY uq_special_draft_forms_year_seq (form_year, form_seq),
  KEY ix_special_draft_forms_type (posting_type, printed_at),
  CONSTRAINT fk_special_draft_forms_printed_by FOREIGN KEY (printed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A special draft. Status: unprinted (waiting; can be removed), scheduled (printed; the WEF is after today, so
-- the server makes the move on it), moved (printed; the rating has moved: the posting it opened is posting_id),
-- cancelled (printed; the scheduled move could no longer be made, with the reason). A printed draft is final.
-- The rating's rate, ship and date joined it are kept as they were when the draft was proposed, and again as they
-- were when it was printed (the form shows them). posting_type holds the code: Complement, Vice, TY or DW (the
-- meaning of TY and DW is not known yet). source: proposal (Special Draft Proposal) or upload (Upload Draft).
CREATE TABLE special_drafts (
  id                  INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  service_number      VARCHAR(20)       NOT NULL,
  rate_id             INT UNSIGNED      NULL,
  current_ship_id     INT UNSIGNED      NULL,
  joined_on           DATE              NULL,
  months_on_ship      SMALLINT UNSIGNED NULL,
  ship_id             INT UNSIGNED      NOT NULL,
  authority           VARCHAR(150)      NOT NULL,
  wef                 DATE              NOT NULL,
  posting_type        VARCHAR(20)       NOT NULL,
  vice                VARCHAR(150)      NULL,
  remark              VARCHAR(250)      NULL,
  status              ENUM('unprinted','scheduled','moved','cancelled') NOT NULL DEFAULT 'unprinted',
  source              ENUM('proposal','upload') NOT NULL DEFAULT 'proposal',
  file_name           VARCHAR(255)      NULL,
  sheet_row           SMALLINT UNSIGNED NULL,
  form_id             INT UNSIGNED      NULL,
  posting_id          INT UNSIGNED      NULL,
  scheduled_change_id INT UNSIGNED      NULL,
  cancelled_reason    VARCHAR(250)      NULL,
  created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by          INT UNSIGNED      NULL,
  PRIMARY KEY (id),
  KEY ix_special_drafts_rating (service_number, status),
  KEY ix_special_drafts_status_type (status, posting_type),
  KEY ix_special_drafts_form (form_id),
  CONSTRAINT fk_special_drafts_rating FOREIGN KEY (service_number) REFERENCES ratings (service_number) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_special_drafts_rate FOREIGN KEY (rate_id) REFERENCES ref_rate (id),
  CONSTRAINT fk_special_drafts_current_ship FOREIGN KEY (current_ship_id) REFERENCES ref_ship (id),
  CONSTRAINT fk_special_drafts_ship FOREIGN KEY (ship_id) REFERENCES ref_ship (id),
  CONSTRAINT fk_special_drafts_form FOREIGN KEY (form_id) REFERENCES special_draft_forms (id),
  CONSTRAINT fk_special_drafts_posting FOREIGN KEY (posting_id) REFERENCES rating_drafting (id) ON DELETE SET NULL,
  CONSTRAINT fk_special_drafts_scheduled FOREIGN KEY (scheduled_change_id) REFERENCES scheduled_changes (id) ON DELETE SET NULL,
  CONSTRAINT fk_special_drafts_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN
DROP TABLE special_drafts;
DROP TABLE special_draft_forms;
