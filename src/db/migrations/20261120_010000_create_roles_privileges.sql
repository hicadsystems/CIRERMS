-- UP
-- Roles and privileges (WP1). A privilege is one action on one screen: the screen id from
-- public/js/core/nav.js (module.screen) and view, add, edit, delete or approve. The catalogue
-- is filled from each module's manifest (src/modules/<module>/<module>.module.js) whenever the
-- seeds run or the server starts; a role holds privileges through role_privileges.
-- A role with full_access is given every privilege in the catalogue, new ones included.
CREATE TABLE roles (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(60)  NOT NULL,
  description  VARCHAR(255) NULL,
  full_access  TINYINT(1)   NOT NULL DEFAULT 0,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by   INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Named bundles of privileges; a user has one role.';

CREATE TABLE privileges (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  screen       VARCHAR(60)  NOT NULL,
  action       ENUM('view','add','edit','delete','approve') NOT NULL,
  module_label VARCHAR(80)  NOT NULL,
  screen_label VARCHAR(120) NOT NULL,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_privileges_screen_action (screen, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='One action on one screen (screen id from nav.js).';

CREATE TABLE role_privileges (
  role_id      INT UNSIGNED NOT NULL,
  privilege_id INT UNSIGNED NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by   INT UNSIGNED NULL,
  PRIMARY KEY (role_id, privilege_id),
  KEY idx_role_privileges_privilege (privilege_id),
  CONSTRAINT fk_role_privileges_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_role_privileges_privilege FOREIGN KEY (privilege_id) REFERENCES privileges (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='The privileges each role holds.';

-- The two roles of the old system the app relies on (system-admin.md 3.4): the administrator
-- (every privilege) and the rating (View My Details only).
INSERT INTO roles (name, description, full_access) VALUES
  ('Administrator', 'Full access to every module and screen', 1),
  ('Rating', 'A rating signing in to see their own service record (View My Details)', 0);

-- DOWN
DROP TABLE role_privileges;
DROP TABLE privileges;
DROP TABLE roles;
