-- UP
-- Manage Users (WP3): what an account holds beyond a sign-in. E-mail and phone, an optional
-- Specialisation (a drafting officer then sees only that department's batches and approvals;
-- the drafting packages apply it), and the one-time password rule: a new or reset account must
-- choose its own password at the next sign-in (must_change_password) before anything else opens.
-- Nothing is deleted: an account is deactivated (is_active = 0).
ALTER TABLE users
  ADD COLUMN email               VARCHAR(150) NULL AFTER service_number,
  ADD COLUMN phone               VARCHAR(30)  NULL AFTER email,
  ADD COLUMN specialisation_id   INT UNSIGNED NULL AFTER phone,
  ADD COLUMN must_change_password TINYINT(1)  NOT NULL DEFAULT 0 AFTER is_active,
  ADD COLUMN password_changed_at DATETIME     NULL AFTER must_change_password,
  ADD KEY idx_users_specialisation (specialisation_id),
  ADD CONSTRAINT fk_users_specialisation FOREIGN KEY (specialisation_id) REFERENCES ref_specialisation (id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- DOWN
ALTER TABLE users
  DROP FOREIGN KEY fk_users_specialisation,
  DROP KEY idx_users_specialisation,
  DROP COLUMN password_changed_at,
  DROP COLUMN must_change_password,
  DROP COLUMN specialisation_id,
  DROP COLUMN phone,
  DROP COLUMN email;
