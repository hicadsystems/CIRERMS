-- UP
-- Every account belongs to a rating, the Hicad administrator's included (owner's rule, 19/11/2026).
-- An account that has none yet gets a rating of its own user name first (surname and first name from
-- its full name, to be corrected on the record), then the link becomes required. The link was
-- ON DELETE SET NULL; it becomes RESTRICT, so a rating that has an account cannot be deleted.
INSERT IGNORE INTO ratings (service_number, status, surname, first_name)
SELECT u.username, 'current', UPPER(SUBSTRING_INDEX(TRIM(u.full_name), ' ', -1)), UPPER(SUBSTRING_INDEX(TRIM(u.full_name), ' ', 1))
  FROM users u
 WHERE u.service_number IS NULL;

UPDATE users SET service_number = username WHERE service_number IS NULL;

ALTER TABLE users DROP FOREIGN KEY fk_users_rating;
ALTER TABLE users MODIFY COLUMN service_number VARCHAR(20) NOT NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_rating FOREIGN KEY (service_number)
  REFERENCES ratings (service_number) ON DELETE RESTRICT ON UPDATE CASCADE;

-- DOWN
ALTER TABLE users DROP FOREIGN KEY fk_users_rating;
ALTER TABLE users MODIFY COLUMN service_number VARCHAR(20) NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_rating FOREIGN KEY (service_number)
  REFERENCES ratings (service_number) ON DELETE SET NULL ON UPDATE CASCADE;
