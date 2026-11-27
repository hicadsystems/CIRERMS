-- Record fields (W1): the new fields of the rating's next of kin, spouse, children and postings, for the demo ratings.
-- Every value is invented: addresses, e-mails on cirerms.example and phone numbers in the 080 range.

-- The status a posting starts with (the Static Tables' Exit Type, kept as the rating's current)
INSERT IGNORE INTO ref_exit_type (name, code, keeps_current, sort_order) VALUES ('Active', 'AC', 1, 99);

-- ---------------------------------------------------------------------------
-- Next of kin: every next of kin has a Relationship, an address, an e-mail and a type (Main or Alternate)
-- ---------------------------------------------------------------------------
UPDATE rating_next_of_kin
   SET next_of_kin_type_id = (SELECT id FROM ref_next_of_kin_type WHERE name = 'Spouse'),
       kin_type = 'Main',
       full_address = '14 Obiageli Close, Independence Layout, Enugu',
       home_number = '08038814420', email_address = 'adaeze.okonkwo@cirerms.example', place_of_work = 'Enugu State Ministry of Education',
       mobile_number = COALESCE(mobile_number, '08036671290')
 WHERE service_number = 'B0539' AND first_name = 'Adaeze';

UPDATE rating_next_of_kin
   SET next_of_kin_type_id = (SELECT id FROM ref_next_of_kin_type WHERE name = 'Brother'),
       kin_type = 'Alternate',
       full_address = '3 Ugwu Street, Trans-Ekulu, Enugu',
       home_number = NULL, email_address = 'nnamdi.okonkwo@cirerms.example', place_of_work = 'Okonkwo and Sons Hardware, Ogbete Market'
 WHERE service_number = 'B0539' AND first_name = 'Nnamdi';

UPDATE rating_next_of_kin
   SET next_of_kin_type_id = (SELECT id FROM ref_next_of_kin_type WHERE name = 'Spouse'),
       kin_type = 'Main',
       full_address = '27 Ajose Adeogun Street, Victoria Island, Lagos',
       home_number = '08071120034', email_address = 'babatunde.adeyemi@cirerms.example', place_of_work = 'Lagos State Water Corporation'
 WHERE service_number = 'B0559F' AND first_name = 'Babatunde';

-- any other next of kin the demo holds still takes a Relationship, an address and an e-mail
UPDATE rating_next_of_kin
   SET next_of_kin_type_id = COALESCE((SELECT id FROM ref_next_of_kin_type WHERE name = 'Father'), next_of_kin_type_id),
       kin_type = COALESCE(kin_type, 'Main'),
       full_address = COALESCE(full_address, CONCAT('Plot ', id + 10, ', Naval Road, Abuja')),
       email_address = COALESCE(email_address, CONCAT('nok', id, '@cirerms.example')),
       mobile_number = COALESCE(mobile_number, CONCAT('0803000', LPAD(id, 4, '0')))
 WHERE next_of_kin_type_id IS NULL OR next_of_kin_type_id IN (SELECT id FROM ref_next_of_kin_type WHERE name IN ('Primary', 'Secondary'))
    OR full_address IS NULL OR email_address IS NULL OR mobile_number IS NULL;

-- ---------------------------------------------------------------------------
-- Spouse
-- ---------------------------------------------------------------------------
UPDATE rating_spouse
   SET street = '14 Obiageli Close', town = 'Independence Layout',
       state_id = (SELECT id FROM ref_state WHERE name = 'Enugu'),
       local_government_id = (SELECT l.id FROM ref_local_government l JOIN ref_state s ON s.id = l.state_id WHERE s.name = 'Enugu' AND l.name = 'Enugu North' LIMIT 1),
       po_box = 'PMB 1021'
 WHERE service_number = 'B0539' AND name = 'Adaeze Chioma Okonkwo';

UPDATE rating_spouse
   SET street = '27 Ajose Adeogun Street', town = 'Victoria Island',
       state_id = (SELECT id FROM ref_state WHERE name = 'Lagos'),
       local_government_id = (SELECT l.id FROM ref_local_government l JOIN ref_state s ON s.id = l.state_id WHERE s.name = 'Lagos' AND l.name = 'Eti-Osa' LIMIT 1),
       po_box = NULL
 WHERE service_number = 'B0559F' AND name = 'Babatunde Segun Adeyemi';

-- ---------------------------------------------------------------------------
-- Children: the address, then sex, date of birth, school, office address and occupation
-- ---------------------------------------------------------------------------
UPDATE rating_children
   SET street = '14 Obiageli Close', town = 'Independence Layout',
       state_id = (SELECT id FROM ref_state WHERE name = 'Enugu'),
       local_government_id = (SELECT l.id FROM ref_local_government l JOIN ref_state s ON s.id = l.state_id WHERE s.name = 'Enugu' AND l.name = 'Enugu North' LIMIT 1),
       po_box = NULL,
       gender_id = (SELECT id FROM ref_gender WHERE name = 'Female'), date_of_birth = '2015-03-22',
       school = 'Premier Nursery and Primary School, Enugu', office_address = NULL, occupation = 'Pupil'
 WHERE service_number = 'B0539' AND name = 'Kamsiyochukwu Okonkwo';

UPDATE rating_children
   SET street = '14 Obiageli Close', town = 'Independence Layout',
       state_id = (SELECT id FROM ref_state WHERE name = 'Enugu'),
       local_government_id = (SELECT l.id FROM ref_local_government l JOIN ref_state s ON s.id = l.state_id WHERE s.name = 'Enugu' AND l.name = 'Enugu North' LIMIT 1),
       po_box = NULL, email_address = 'chizaram.okonkwo@cirerms.example',
       gender_id = (SELECT id FROM ref_gender WHERE name = 'Male'), date_of_birth = '2008-11-05',
       school = 'Government College, Enugu', office_address = NULL, occupation = 'Student'
 WHERE service_number = 'B0539' AND name = 'Chizaram Okonkwo';

-- ---------------------------------------------------------------------------
-- Postings: the Command of the ship, the Branch of the rating, the Active status and an authority (the signal)
-- ---------------------------------------------------------------------------
UPDATE rating_drafting d JOIN ratings r ON r.service_number = d.service_number
   SET d.branch_id = r.branch_id
 WHERE d.branch_id IS NULL;

UPDATE rating_drafting d JOIN ref_ship s ON s.id = d.ship_id
   SET d.command_id = s.command_id
 WHERE d.command_id IS NULL;

UPDATE rating_drafting
   SET exit_type_id = (SELECT id FROM ref_exit_type WHERE name = 'Active')
 WHERE exit_type_id IS NULL;

-- a posting the Drafting module made says so in its remark: that is its authority
UPDATE rating_drafting
   SET authority = LEFT(SUBSTRING_INDEX(SUBSTRING(remarks, 14), ' · ', 1), 150)
 WHERE authority IS NULL AND remarks LIKE 'Drafted under %';

UPDATE rating_drafting
   SET authority = CONCAT('NHQ/NP/DOD/', 200 + id, '/', COALESCE(YEAR(start_date), YEAR(CURDATE())))
 WHERE authority IS NULL;

UPDATE rating_drafting SET decoration = 'Chief of Naval Staff Commendation' WHERE service_number = 'B0539' AND start_date = '2015-09-01' AND decoration IS NULL;
UPDATE rating_drafting SET decoration = 'Operation Pulo Shield Medal' WHERE service_number = 'B0541' AND start_date = '2021-02-01' AND decoration IS NULL;
UPDATE rating_drafting SET decoration = 'Best Rating of the Year' WHERE service_number = 'B0575' AND start_date = '2020-07-01' AND decoration IS NULL;
