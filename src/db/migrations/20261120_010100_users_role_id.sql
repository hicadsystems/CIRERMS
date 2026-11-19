-- UP
-- users.role (a plain string) becomes users.role_id, a link to roles.
-- Existing values move across: 'admin' to Administrator, 'rating' to Rating, and any other
-- value to a role of that name (created here so no account loses its role).
ALTER TABLE users ADD COLUMN role_id INT UNSIGNED NULL AFTER full_name;

INSERT INTO roles (name, description, full_access)
SELECT DISTINCT u.role, 'Moved from the old users.role value', 0
  FROM users u
 WHERE u.role NOT IN ('admin', 'rating')
   AND NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = u.role);

UPDATE users u
  JOIN roles r ON r.name = CASE u.role WHEN 'admin' THEN 'Administrator' WHEN 'rating' THEN 'Rating' ELSE u.role END
   SET u.role_id = r.id;

ALTER TABLE users
  MODIFY COLUMN role_id INT UNSIGNED NOT NULL,
  ADD KEY idx_users_role (role_id),
  ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  DROP COLUMN role;

-- DOWN
ALTER TABLE users ADD COLUMN role VARCHAR(30) NOT NULL DEFAULT 'admin' AFTER full_name;

UPDATE users u
  JOIN roles r ON r.id = u.role_id
   SET u.role = CASE r.name WHEN 'Administrator' THEN 'admin' WHEN 'Rating' THEN 'rating' ELSE LEFT(r.name, 30) END;

ALTER TABLE users
  DROP FOREIGN KEY fk_users_role,
  DROP KEY idx_users_role,
  DROP COLUMN role_id;
