-- UP
-- The record's fields brought to the live system's: next of kin, spouse, children and postings carry
-- the live columns; a ship's type reads Sea, Land or Training.

-- Next of kin: the address and contact fields; the Relationship (next_of_kin_type_id) stays; Next of Kin Type is Main or Alternate
ALTER TABLE rating_next_of_kin
  ADD COLUMN kin_type      VARCHAR(10)  NULL AFTER mobile_number,
  ADD COLUMN full_address  VARCHAR(250) NULL AFTER kin_type,
  ADD COLUMN home_number   VARCHAR(30)  NULL AFTER full_address,
  ADD COLUMN email_address VARCHAR(150) NULL AFTER home_number,
  ADD COLUMN place_of_work VARCHAR(200) NULL AFTER email_address;

-- the demo's two original relationships were really the two types
UPDATE rating_next_of_kin k JOIN ref_next_of_kin_type t ON t.id = k.next_of_kin_type_id
   SET k.kin_type = IF(t.name = 'Primary', 'Main', 'Alternate')
 WHERE t.name IN ('Primary', 'Secondary');

-- Spouse: the address
ALTER TABLE rating_spouse
  ADD COLUMN street              VARCHAR(150) NULL AFTER email_address,
  ADD COLUMN town                VARCHAR(100) NULL AFTER street,
  ADD COLUMN state_id            INT UNSIGNED NULL AFTER town,
  ADD COLUMN local_government_id INT UNSIGNED NULL AFTER state_id,
  ADD COLUMN po_box              VARCHAR(30)  NULL AFTER local_government_id,
  ADD CONSTRAINT fk_rating_spouse_state FOREIGN KEY (state_id) REFERENCES ref_state (id),
  ADD CONSTRAINT fk_rating_spouse_lga   FOREIGN KEY (local_government_id) REFERENCES ref_local_government (id);

-- Children: the address, then sex, date of birth, school, office address and occupation
ALTER TABLE rating_children
  ADD COLUMN street              VARCHAR(150) NULL AFTER email_address,
  ADD COLUMN town                VARCHAR(100) NULL AFTER street,
  ADD COLUMN state_id            INT UNSIGNED NULL AFTER town,
  ADD COLUMN local_government_id INT UNSIGNED NULL AFTER state_id,
  ADD COLUMN po_box              VARCHAR(30)  NULL AFTER local_government_id,
  ADD COLUMN gender_id           INT UNSIGNED NULL AFTER po_box,
  ADD COLUMN date_of_birth       DATE         NULL AFTER gender_id,
  ADD COLUMN school              VARCHAR(150) NULL AFTER date_of_birth,
  ADD COLUMN office_address      VARCHAR(250) NULL AFTER school,
  ADD COLUMN occupation          VARCHAR(100) NULL AFTER office_address,
  ADD CONSTRAINT fk_rating_children_state  FOREIGN KEY (state_id) REFERENCES ref_state (id),
  ADD CONSTRAINT fk_rating_children_lga    FOREIGN KEY (local_government_id) REFERENCES ref_local_government (id),
  ADD CONSTRAINT fk_rating_children_gender FOREIGN KEY (gender_id) REFERENCES ref_gender (id);

-- Postings: branch, authority (the signal), command, decoration or award, and status (the posting's exit type)
ALTER TABLE rating_drafting
  ADD COLUMN branch_id    INT UNSIGNED NULL AFTER rate_id,
  ADD COLUMN authority    VARCHAR(150) NULL AFTER end_date,
  ADD COLUMN command_id   INT UNSIGNED NULL AFTER authority,
  ADD COLUMN decoration   VARCHAR(150) NULL AFTER command_id,
  ADD COLUMN exit_type_id INT UNSIGNED NULL AFTER decoration,
  ADD CONSTRAINT fk_rating_drafting_branch    FOREIGN KEY (branch_id) REFERENCES ref_branch (id),
  ADD CONSTRAINT fk_rating_drafting_command   FOREIGN KEY (command_id) REFERENCES ref_command (id),
  ADD CONSTRAINT fk_rating_drafting_exit_type FOREIGN KEY (exit_type_id) REFERENCES ref_exit_type (id);

-- Ships: the type is Sea, Land or Training (the live system's own words)
UPDATE ref_ship SET type = 'Sea'  WHERE type = 'Ship';
UPDATE ref_ship SET type = 'Land' WHERE type = 'Base';
ALTER TABLE ref_ship ALTER COLUMN type SET DEFAULT 'Sea';

-- DOWN
ALTER TABLE ref_ship ALTER COLUMN type SET DEFAULT 'Ship';
UPDATE ref_ship SET type = 'Ship' WHERE type = 'Sea';
UPDATE ref_ship SET type = 'Base' WHERE type = 'Land';

ALTER TABLE rating_drafting
  DROP FOREIGN KEY fk_rating_drafting_exit_type,
  DROP FOREIGN KEY fk_rating_drafting_command,
  DROP FOREIGN KEY fk_rating_drafting_branch,
  DROP COLUMN exit_type_id, DROP COLUMN decoration, DROP COLUMN command_id, DROP COLUMN authority, DROP COLUMN branch_id;

ALTER TABLE rating_children
  DROP FOREIGN KEY fk_rating_children_gender,
  DROP FOREIGN KEY fk_rating_children_lga,
  DROP FOREIGN KEY fk_rating_children_state,
  DROP COLUMN occupation, DROP COLUMN office_address, DROP COLUMN school, DROP COLUMN date_of_birth, DROP COLUMN gender_id,
  DROP COLUMN po_box, DROP COLUMN local_government_id, DROP COLUMN state_id, DROP COLUMN town, DROP COLUMN street;

ALTER TABLE rating_spouse
  DROP FOREIGN KEY fk_rating_spouse_lga,
  DROP FOREIGN KEY fk_rating_spouse_state,
  DROP COLUMN po_box, DROP COLUMN local_government_id, DROP COLUMN state_id, DROP COLUMN town, DROP COLUMN street;

ALTER TABLE rating_next_of_kin
  DROP COLUMN place_of_work, DROP COLUMN email_address, DROP COLUMN home_number, DROP COLUMN full_address, DROP COLUMN kin_type;
