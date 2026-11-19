-- UP
-- An account's name comes from its rating (every account belongs to one), written as the rest of the
-- app writes a rating's name; nothing reads users.full_name any more, so it no longer has to be given.
ALTER TABLE users MODIFY COLUMN full_name VARCHAR(150) NULL COMMENT 'Unused: an account''s name is its rating''s';

-- DOWN
UPDATE users SET full_name = username WHERE full_name IS NULL;
ALTER TABLE users MODIFY COLUMN full_name VARCHAR(150) NOT NULL;
