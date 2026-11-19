-- UP
-- The rating search select matches the official number (primary key) and the start of any
-- name part. surname is already the first column of ix_ratings_name; the others get an index
-- so each prefix match is a range scan, not a scan of the table.
ALTER TABLE ratings
  ADD KEY ix_ratings_first_name (first_name),
  ADD KEY ix_ratings_middle_name (middle_name),
  ADD KEY ix_ratings_maiden_name (maiden_name);

-- DOWN
ALTER TABLE ratings
  DROP KEY ix_ratings_first_name,
  DROP KEY ix_ratings_middle_name,
  DROP KEY ix_ratings_maiden_name;
