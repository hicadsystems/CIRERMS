-- Demo ratings, child records, and login accounts for the CIRERMS migration demo.
-- Safe to rerun: uses INSERT IGNORE on keyed tables and WHERE NOT EXISTS on history tables.

-- ============================================================================
-- 1. Demo Ratings (10 Current + 4 Former = 14 total)
-- ============================================================================

-- B0539: Petty Officer Chukwuemeka Okonkwo (linked to demo user B0539 for "View My Details")
INSERT IGNORE INTO ratings (
  service_number, status, rate_id, title_id, surname, first_name, middle_name, maiden_name,
  gender_id, date_of_birth, marital_status_id, married_to_military_personnel,
  religion_id, religion_denomination_id, tribe_id,
  state_id, local_government_id, home_address, mother_base_id, place_of_birth,
  email_address, phone, geo_political_zone_id, driver_license_number, driver_license_expiry_date,
  identification_type_id, identity_number,
  weight_kg, height_m, chest_cm, hair_color_id, eye_color_id, complexion_id,
  blood_group_id, blood_genotype_id, tribal_mark, disability_id, disability_comment,
  branch_id, command_id, staff_branch_id, seniority_date, entry_mode_id,
  date_employed, specialisation_id, hobbies
) VALUES (
  'B0539', 'current',
  (SELECT id FROM ref_rate WHERE name = 'Petty Officer (PO)'),
  (SELECT id FROM ref_title WHERE name = 'PO'),
  'OKONKWO', 'CHUKWUEMEKA', 'IFEANYI', NULL,
  (SELECT id FROM ref_gender WHERE name = 'Male'),
  '1991-04-18',
  (SELECT id FROM ref_marital_status WHERE name = 'Married'),
  'No',
  (SELECT id FROM ref_religion WHERE name = 'Christianity'),
  (SELECT id FROM ref_religion_denomination WHERE name = 'Catholic' LIMIT 1),
  (SELECT id FROM ref_tribe WHERE name = 'Igbo'),
  (SELECT id FROM ref_state WHERE name = 'Anambra'),
  (SELECT id FROM ref_local_government WHERE name = 'Onitsha North' LIMIT 1),
  'Block 14 Flat 3, Navy Town Barracks, Ojo, Lagos',
  (SELECT id FROM ref_mother_base WHERE name = 'NNS BEECROFT (Apapa)'),
  'Onitsha',
  'c.okonkwo@navy.mil.ng', '08034561101',
  (SELECT id FROM ref_geo_political_zone WHERE name = 'South East'),
  'AKW19482AA24', '2028-06-30',
  (SELECT id FROM ref_identification_type WHERE name = 'Naval ID Card'),
  'NN-ID-0539',
  78.50, 1.79, 98.0,
  (SELECT id FROM ref_hair_color WHERE name = 'Black'),
  (SELECT id FROM ref_eye_color WHERE name = 'Dark Brown'),
  (SELECT id FROM ref_complexion WHERE name = 'Chocolate'),
  (SELECT id FROM ref_blood_group WHERE name = 'O+'),
  (SELECT id FROM ref_blood_genotype WHERE name = 'AA'),
  0,
  (SELECT id FROM ref_disability WHERE name = 'None'),
  NULL,
  (SELECT id FROM ref_branch WHERE name = 'Seaman'),
  (SELECT id FROM ref_command WHERE name = 'Western Naval Command'),
  (SELECT id FROM ref_staff_branch WHERE name = 'Operations'),
  '2022-07-01',
  (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'),
  '2012-09-15',
  (SELECT id FROM ref_specialisation WHERE name = 'Navigation'),
  'Swimming, Chess, Maritime History'
);

-- B0541: Chief Petty Officer Abdullahi Musa
INSERT IGNORE INTO ratings (
  service_number, status, rate_id, title_id, surname, first_name, middle_name,
  gender_id, date_of_birth, marital_status_id,
  religion_id, religion_denomination_id, tribe_id,
  state_id, local_government_id, home_address, mother_base_id, place_of_birth,
  email_address, phone, geo_political_zone_id,
  identification_type_id, identity_number,
  weight_kg, height_m, chest_cm, hair_color_id, eye_color_id, complexion_id,
  blood_group_id, blood_genotype_id, tribal_mark, disability_id,
  branch_id, command_id, staff_branch_id, seniority_date, entry_mode_id,
  date_employed, specialisation_id, hobbies
) VALUES (
  'B0541', 'current',
  (SELECT id FROM ref_rate WHERE name = 'Chief Petty Officer (CPO)'),
  (SELECT id FROM ref_title WHERE name = 'CPO'),
  'MUSA', 'ABDULLAHI', 'DANJUMA',
  (SELECT id FROM ref_gender WHERE name = 'Male'),
  '1987-11-09',
  (SELECT id FROM ref_marital_status WHERE name = 'Married'),
  (SELECT id FROM ref_religion WHERE name = 'Islam'),
  (SELECT id FROM ref_religion_denomination WHERE name = 'Sunni' LIMIT 1),
  (SELECT id FROM ref_tribe WHERE name = 'Hausa'),
  (SELECT id FROM ref_state WHERE name = 'Kaduna'),
  (SELECT id FROM ref_local_government WHERE name = 'Zaria' LIMIT 1),
  '22 Ahmadu Bello Quarters, Navy Estate, Apapa, Lagos',
  (SELECT id FROM ref_mother_base WHERE name = 'NNS BEECROFT (Apapa)'),
  'Zaria',
  'a.musa@navy.mil.ng', '08023341902',
  (SELECT id FROM ref_geo_political_zone WHERE name = 'North West'),
  (SELECT id FROM ref_identification_type WHERE name = 'Naval ID Card'),
  'NN-ID-0541',
  82.00, 1.82, 101.5,
  (SELECT id FROM ref_hair_color WHERE name = 'Black'),
  (SELECT id FROM ref_eye_color WHERE name = 'Dark Brown'),
  (SELECT id FROM ref_complexion WHERE name = 'Dark'),
  (SELECT id FROM ref_blood_group WHERE name = 'B+'),
  (SELECT id FROM ref_blood_genotype WHERE name = 'AA'),
  0,
  (SELECT id FROM ref_disability WHERE name = 'None'),
  (SELECT id FROM ref_branch WHERE name = 'Marine Engineering'),
  (SELECT id FROM ref_command WHERE name = 'Western Naval Command'),
  (SELECT id FROM ref_staff_branch WHERE name = 'Fleet Maintenance'),
  '2021-01-15',
  (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'),
  '2009-03-10',
  (SELECT id FROM ref_specialisation WHERE name = 'Marine Propulsion'),
  'Football, Jogging'
);

-- B0559F: Leading Seaman Oluwafunmilayo Adeyemi
INSERT IGNORE INTO ratings (
  service_number, status, rate_id, title_id, surname, first_name, middle_name, maiden_name,
  gender_id, date_of_birth, marital_status_id,
  religion_id, religion_denomination_id, tribe_id,
  state_id, local_government_id, home_address, mother_base_id, place_of_birth,
  email_address, phone, geo_political_zone_id,
  identification_type_id, identity_number,
  weight_kg, height_m, chest_cm, hair_color_id, eye_color_id, complexion_id,
  blood_group_id, blood_genotype_id, tribal_mark, disability_id,
  branch_id, command_id, staff_branch_id, seniority_date, entry_mode_id,
  date_employed, specialisation_id, hobbies
) VALUES (
  'B0559F', 'current',
  (SELECT id FROM ref_rate WHERE name = 'Leading Seaman (LS)'),
  (SELECT id FROM ref_title WHERE name = 'LS'),
  'ADEYEMI', 'OLUWAFUNMILAYO', 'TEMITOPE', 'OGUNBIYI',
  (SELECT id FROM ref_gender WHERE name = 'Female'),
  '1995-02-24',
  (SELECT id FROM ref_marital_status WHERE name = 'Married'),
  (SELECT id FROM ref_religion WHERE name = 'Christianity'),
  (SELECT id FROM ref_religion_denomination WHERE name = 'Pentecostal' LIMIT 1),
  (SELECT id FROM ref_tribe WHERE name = 'Yoruba'),
  (SELECT id FROM ref_state WHERE name = 'Ogun'),
  (SELECT id FROM ref_local_government WHERE name = 'Abeokuta South' LIMIT 1),
  'Flat 8B, Naval Dockyard Quarters, Victoria Island, Lagos',
  (SELECT id FROM ref_mother_base WHERE name = 'NNS BEECROFT (Apapa)'),
  'Abeokuta',
  'f.adeyemi@navy.mil.ng', '08056129934',
  (SELECT id FROM ref_geo_political_zone WHERE name = 'South West'),
  (SELECT id FROM ref_identification_type WHERE name = 'Naval ID Card'),
  'NN-ID-0559F',
  64.00, 1.68, 88.0,
  (SELECT id FROM ref_hair_color WHERE name = 'Black'),
  (SELECT id FROM ref_eye_color WHERE name = 'Brown'),
  (SELECT id FROM ref_complexion WHERE name = 'Fair'),
  (SELECT id FROM ref_blood_group WHERE name = 'A+'),
  (SELECT id FROM ref_blood_genotype WHERE name = 'AS'),
  0,
  (SELECT id FROM ref_disability WHERE name = 'None'),
  (SELECT id FROM ref_branch WHERE name = 'Information Technology'),
  (SELECT id FROM ref_command WHERE name = 'Naval Headquarters'),
  (SELECT id FROM ref_staff_branch WHERE name = 'Personnel (Navpers)'),
  '2023-05-01',
  (SELECT id FROM ref_entry_mode WHERE name = 'Specialist Enlistment'),
  '2017-08-21',
  (SELECT id FROM ref_specialisation WHERE name = 'ICT / Cyber'),
  'Reading, Badminton'
);

-- B0562: Able Seaman Tamunoemi Briggs
INSERT IGNORE INTO ratings (
  service_number, status, rate_id, title_id, surname, first_name, middle_name,
  gender_id, date_of_birth, marital_status_id,
  religion_id, religion_denomination_id, tribe_id,
  state_id, local_government_id, home_address, mother_base_id, place_of_birth,
  email_address, phone, geo_political_zone_id,
  weight_kg, height_m, chest_cm, blood_group_id, blood_genotype_id, tribal_mark, disability_id,
  branch_id, command_id, staff_branch_id, seniority_date, entry_mode_id,
  date_employed, specialisation_id
) VALUES (
  'B0562', 'current',
  (SELECT id FROM ref_rate WHERE name = 'Able Seaman (AB)'),
  (SELECT id FROM ref_title WHERE name = 'AB'),
  'BRIGGS', 'TAMUNOEMI', 'SOTONYE',
  (SELECT id FROM ref_gender WHERE name = 'Male'),
  '1998-07-12',
  (SELECT id FROM ref_marital_status WHERE name = 'Single'),
  (SELECT id FROM ref_religion WHERE name = 'Christianity'),
  (SELECT id FROM ref_religion_denomination WHERE name = 'Anglican' LIMIT 1),
  (SELECT id FROM ref_tribe WHERE name = 'Ijaw'),
  (SELECT id FROM ref_state WHERE name = 'Rivers'),
  (SELECT id FROM ref_local_government WHERE name = 'Port Harcourt' LIMIT 1),
  '12 Borokiri Naval Quarters, Port Harcourt, Rivers',
  (SELECT id FROM ref_mother_base WHERE name = 'NNS PATHFINDER (Port Harcourt)'),
  'Port Harcourt',
  't.briggs@navy.mil.ng', '08069014420',
  (SELECT id FROM ref_geo_political_zone WHERE name = 'South South'),
  74.20, 1.76, 95.0,
  (SELECT id FROM ref_blood_group WHERE name = 'O+'),
  (SELECT id FROM ref_blood_genotype WHERE name = 'AA'),
  0,
  (SELECT id FROM ref_disability WHERE name = 'None'),
  (SELECT id FROM ref_branch WHERE name = 'Seaman'),
  (SELECT id FROM ref_command WHERE name = 'Eastern Naval Command'),
  (SELECT id FROM ref_staff_branch WHERE name = 'Operations'),
  '2024-01-01',
  (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'),
  '2020-10-05',
  (SELECT id FROM ref_specialisation WHERE name = 'Gunnery')
);

-- B0575: Warrant Officer Effiong Bassey
INSERT IGNORE INTO ratings (
  service_number, status, rate_id, title_id, surname, first_name, middle_name,
  gender_id, date_of_birth, marital_status_id,
  religion_id, religion_denomination_id, tribe_id,
  state_id, local_government_id, home_address, mother_base_id, place_of_birth,
  email_address, phone, geo_political_zone_id,
  weight_kg, height_m, chest_cm, blood_group_id, blood_genotype_id, tribal_mark, disability_id,
  branch_id, command_id, staff_branch_id, seniority_date, entry_mode_id,
  date_employed, specialisation_id
) VALUES (
  'B0575', 'current',
  (SELECT id FROM ref_rate WHERE name = 'Warrant Officer (WO)'),
  (SELECT id FROM ref_title WHERE name = 'WO'),
  'BASSEY', 'EFFIONG', 'archibong',
  (SELECT id FROM ref_gender WHERE name = 'Male'),
  '1983-03-30',
  (SELECT id FROM ref_marital_status WHERE name = 'Married'),
  (SELECT id FROM ref_religion WHERE name = 'Christianity'),
  (SELECT id FROM ref_religion_denomination WHERE name = 'Methodist' LIMIT 1),
  (SELECT id FROM ref_tribe WHERE name = 'Efik'),
  (SELECT id FROM ref_state WHERE name = 'Cross River'),
  (SELECT id FROM ref_local_government WHERE name = 'Calabar Municipal' LIMIT 1),
  '5 Akim Barracks Road, Calabar, Cross River',
  (SELECT id FROM ref_mother_base WHERE name = 'NNS VICTORY (Calabar)'),
  'Calabar',
  'e.bassey@navy.mil.ng', '08037882210',
  (SELECT id FROM ref_geo_political_zone WHERE name = 'South South'),
  84.00, 1.80, 103.0,
  (SELECT id FROM ref_blood_group WHERE name = 'A-'),
  (SELECT id FROM ref_blood_genotype WHERE name = 'AA'),
  0,
  (SELECT id FROM ref_disability WHERE name = 'None'),
  (SELECT id FROM ref_branch WHERE name = 'Weapon Engineering'),
  (SELECT id FROM ref_command WHERE name = 'Eastern Naval Command'),
  (SELECT id FROM ref_staff_branch WHERE name = 'Fleet Maintenance'),
  '2020-06-01',
  (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'),
  '2004-05-17',
  (SELECT id FROM ref_specialisation WHERE name = 'Electrical / Weapon Systems')
);

-- B0588: Petty Officer Terver Aondoakaa
INSERT IGNORE INTO ratings (
  service_number, status, rate_id, title_id, surname, first_name, middle_name,
  gender_id, date_of_birth, marital_status_id,
  religion_id, religion_denomination_id, tribe_id,
  state_id, local_government_id, home_address, mother_base_id, place_of_birth,
  email_address, phone, geo_political_zone_id,
  weight_kg, height_m, chest_cm, blood_group_id, blood_genotype_id, tribal_mark, disability_id,
  branch_id, command_id, staff_branch_id, seniority_date, entry_mode_id,
  date_employed, specialisation_id
) VALUES (
  'B0588', 'current',
  (SELECT id FROM ref_rate WHERE name = 'Petty Officer (PO)'),
  (SELECT id FROM ref_title WHERE name = 'PO'),
  'AONDOAKAA', 'TERVER', 'MOSES',
  (SELECT id FROM ref_gender WHERE name = 'Male'),
  '1992-09-04',
  (SELECT id FROM ref_marital_status WHERE name = 'Married'),
  (SELECT id FROM ref_religion WHERE name = 'Christianity'),
  (SELECT id FROM ref_religion_denomination WHERE name = 'Catholic' LIMIT 1),
  (SELECT id FROM ref_tribe WHERE name = 'Tiv'),
  (SELECT id FROM ref_state WHERE name = 'Benue'),
  (SELECT id FROM ref_local_government WHERE name = 'Makurdi' LIMIT 1),
  '9 Barracks Close, Warri Naval Base, Delta',
  (SELECT id FROM ref_mother_base WHERE name = 'NNS DELTA (Warri)'),
  'Makurdi',
  't.aondoakaa@navy.mil.ng', '08091127745',
  (SELECT id FROM ref_geo_political_zone WHERE name = 'North Central'),
  79.00, 1.81, 99.0,
  (SELECT id FROM ref_blood_group WHERE name = 'AB+'),
  (SELECT id FROM ref_blood_genotype WHERE name = 'AA'),
  0,
  (SELECT id FROM ref_disability WHERE name = 'None'),
  (SELECT id FROM ref_branch WHERE name = 'Naval Police'),
  (SELECT id FROM ref_command WHERE name = 'Central Naval Command'),
  (SELECT id FROM ref_staff_branch WHERE name = 'Administration'),
  '2022-11-01',
  (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'),
  '2013-04-22',
  (SELECT id FROM ref_specialisation WHERE name = 'Regulating (Provost)')
);

-- B0601F: Able Seaman Halima Suleiman
INSERT IGNORE INTO ratings (
  service_number, status, rate_id, title_id, surname, first_name, middle_name,
  gender_id, date_of_birth, marital_status_id,
  religion_id, religion_denomination_id, tribe_id,
  state_id, local_government_id, home_address, mother_base_id, place_of_birth,
  email_address, phone, geo_political_zone_id,
  weight_kg, height_m, chest_cm, blood_group_id, blood_genotype_id, tribal_mark, disability_id,
  branch_id, command_id, staff_branch_id, seniority_date, entry_mode_id,
  date_employed, specialisation_id
) VALUES (
  'B0601F', 'current',
  (SELECT id FROM ref_rate WHERE name = 'Able Seaman (AB)'),
  (SELECT id FROM ref_title WHERE name = 'AB'),
  'SULEIMAN', 'HALIMA', 'ZAINAB',
  (SELECT id FROM ref_gender WHERE name = 'Female'),
  '1999-01-16',
  (SELECT id FROM ref_marital_status WHERE name = 'Single'),
  (SELECT id FROM ref_religion WHERE name = 'Islam'),
  (SELECT id FROM ref_religion_denomination WHERE name = 'Sunni' LIMIT 1),
  (SELECT id FROM ref_tribe WHERE name = 'Nupe'),
  (SELECT id FROM ref_state WHERE name = 'Niger'),
  (SELECT id FROM ref_local_government WHERE name = 'Bida' LIMIT 1),
  'Mogadishu Cantonment Annex, Asokoro, Abuja',
  (SELECT id FROM ref_mother_base WHERE name = 'NHQ (Abuja)'),
  'Bida',
  'h.suleiman@navy.mil.ng', '08074458821',
  (SELECT id FROM ref_geo_political_zone WHERE name = 'North Central'),
  61.50, 1.66, 86.0,
  (SELECT id FROM ref_blood_group WHERE name = 'O+'),
  (SELECT id FROM ref_blood_genotype WHERE name = 'AA'),
  0,
  (SELECT id FROM ref_disability WHERE name = 'None'),
  (SELECT id FROM ref_branch WHERE name = 'Medical'),
  (SELECT id FROM ref_command WHERE name = 'Naval Headquarters'),
  (SELECT id FROM ref_staff_branch WHERE name = 'Administration'),
  '2024-03-01',
  (SELECT id FROM ref_entry_mode WHERE name = 'Specialist Enlistment'),
  '2021-06-14',
  (SELECT id FROM ref_specialisation WHERE name = 'Medical Assistant')
);

-- B0614: Leading Seaman Osaze Omoregie
INSERT IGNORE INTO ratings (
  service_number, status, rate_id, title_id, surname, first_name, middle_name,
  gender_id, date_of_birth, marital_status_id,
  religion_id, religion_denomination_id, tribe_id,
  state_id, local_government_id, home_address, mother_base_id, place_of_birth,
  email_address, phone, geo_political_zone_id,
  weight_kg, height_m, chest_cm, blood_group_id, blood_genotype_id, tribal_mark, disability_id,
  branch_id, command_id, staff_branch_id, seniority_date, entry_mode_id,
  date_employed, specialisation_id
) VALUES (
  'B0614', 'current',
  (SELECT id FROM ref_rate WHERE name = 'Leading Seaman (LS)'),
  (SELECT id FROM ref_title WHERE name = 'LS'),
  'OMOREGIE', 'OSAZE', 'NOSAKHARE',
  (SELECT id FROM ref_gender WHERE name = 'Male'),
  '1994-06-21',
  (SELECT id FROM ref_marital_status WHERE name = 'Married'),
  (SELECT id FROM ref_religion WHERE name = 'Christianity'),
  (SELECT id FROM ref_religion_denomination WHERE name = 'Baptist' LIMIT 1),
  (SELECT id FROM ref_tribe WHERE name = 'Edo'),
  (SELECT id FROM ref_state WHERE name = 'Edo'),
  (SELECT id FROM ref_local_government WHERE name = 'Oredo' LIMIT 1),
  '18 Sapele Road Quarters, Benin City, Edo',
  (SELECT id FROM ref_mother_base WHERE name = 'NNS DELTA (Warri)'),
  'Benin City',
  'o.omoregie@navy.mil.ng', '08035519087',
  (SELECT id FROM ref_geo_political_zone WHERE name = 'South South'),
  76.00, 1.77, 96.0,
  (SELECT id FROM ref_blood_group WHERE name = 'B+'),
  (SELECT id FROM ref_blood_genotype WHERE name = 'AS'),
  0,
  (SELECT id FROM ref_disability WHERE name = 'None'),
  (SELECT id FROM ref_branch WHERE name = 'Logistics'),
  (SELECT id FROM ref_command WHERE name = 'Logistics Command'),
  (SELECT id FROM ref_staff_branch WHERE name = 'Logistics'),
  '2023-01-15',
  (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'),
  '2016-11-03',
  (SELECT id FROM ref_specialisation WHERE name = 'Stores & Supply')
);

-- B0627: Ordinary Seaman Babagana Kyari
INSERT IGNORE INTO ratings (
  service_number, status, rate_id, title_id, surname, first_name, middle_name,
  gender_id, date_of_birth, marital_status_id,
  religion_id, religion_denomination_id, tribe_id,
  state_id, local_government_id, home_address, mother_base_id, place_of_birth,
  email_address, phone, geo_political_zone_id,
  weight_kg, height_m, chest_cm, blood_group_id, blood_genotype_id, tribal_mark, disability_id,
  branch_id, command_id, staff_branch_id, seniority_date, entry_mode_id,
  date_employed, specialisation_id
) VALUES (
  'B0627', 'current',
  (SELECT id FROM ref_rate WHERE name = 'Ordinary Seaman (OS)'),
  (SELECT id FROM ref_title WHERE name = 'OS'),
  'KYARI', 'BABAGANA', 'MODU',
  (SELECT id FROM ref_gender WHERE name = 'Male'),
  '2002-08-19',
  (SELECT id FROM ref_marital_status WHERE name = 'Single'),
  (SELECT id FROM ref_religion WHERE name = 'Islam'),
  (SELECT id FROM ref_religion_denomination WHERE name = 'Sunni' LIMIT 1),
  (SELECT id FROM ref_tribe WHERE name = 'Kanuri'),
  (SELECT id FROM ref_state WHERE name = 'Borno'),
  (SELECT id FROM ref_local_government WHERE name = 'Maiduguri' LIMIT 1),
  'Trainee Block C, NNS QUORRA, Apapa, Lagos',
  (SELECT id FROM ref_mother_base WHERE name = 'NNS BEECROFT (Apapa)'),
  'Maiduguri',
  'b.kyari@navy.mil.ng', '08126703319',
  (SELECT id FROM ref_geo_political_zone WHERE name = 'North East'),
  70.00, 1.75, 92.0,
  (SELECT id FROM ref_blood_group WHERE name = 'O-'),
  (SELECT id FROM ref_blood_genotype WHERE name = 'AA'),
  1,
  (SELECT id FROM ref_disability WHERE name = 'None'),
  (SELECT id FROM ref_branch WHERE name = 'Seaman'),
  (SELECT id FROM ref_command WHERE name = 'Naval Training Command'),
  (SELECT id FROM ref_staff_branch WHERE name = 'Training'),
  '2025-02-01',
  (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'),
  '2024-09-02',
  (SELECT id FROM ref_specialisation WHERE name = 'Communications')
);

-- B0640: Master Warrant Officer Kehinde Babatunde
INSERT IGNORE INTO ratings (
  service_number, status, rate_id, title_id, surname, first_name, middle_name,
  gender_id, date_of_birth, marital_status_id,
  religion_id, religion_denomination_id, tribe_id,
  state_id, local_government_id, home_address, mother_base_id, place_of_birth,
  email_address, phone, geo_political_zone_id,
  weight_kg, height_m, chest_cm, blood_group_id, blood_genotype_id, tribal_mark, disability_id,
  branch_id, command_id, staff_branch_id, seniority_date, entry_mode_id,
  date_employed, specialisation_id
) VALUES (
  'B0640', 'current',
  (SELECT id FROM ref_rate WHERE name = 'Master Warrant Officer (MWO)'),
  (SELECT id FROM ref_title WHERE name = 'MWO'),
  'BABATUNDE', 'KEHINDE', 'OLANREWAJU',
  (SELECT id FROM ref_gender WHERE name = 'Male'),
  '1980-12-05',
  (SELECT id FROM ref_marital_status WHERE name = 'Married'),
  (SELECT id FROM ref_religion WHERE name = 'Christianity'),
  (SELECT id FROM ref_religion_denomination WHERE name = 'Anglican' LIMIT 1),
  (SELECT id FROM ref_tribe WHERE name = 'Yoruba'),
  (SELECT id FROM ref_state WHERE name = 'Oyo'),
  (SELECT id FROM ref_local_government WHERE name = 'Ibadan North' LIMIT 1),
  'Senior Rates Mess Quarters, Apapa, Lagos',
  (SELECT id FROM ref_mother_base WHERE name = 'NNS BEECROFT (Apapa)'),
  'Ibadan',
  'k.babatunde@navy.mil.ng', '08023118800',
  (SELECT id FROM ref_geo_political_zone WHERE name = 'South West'),
  85.50, 1.78, 104.0,
  (SELECT id FROM ref_blood_group WHERE name = 'A+'),
  (SELECT id FROM ref_blood_genotype WHERE name = 'AA'),
  1,
  (SELECT id FROM ref_disability WHERE name = 'None'),
  (SELECT id FROM ref_branch WHERE name = 'Seaman'),
  (SELECT id FROM ref_command WHERE name = 'Western Naval Command'),
  (SELECT id FROM ref_staff_branch WHERE name = 'Operations'),
  '2019-07-01',
  (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'),
  '2001-04-09',
  (SELECT id FROM ref_specialisation WHERE name = 'Radar Plotter')
);

-- ============================================================================
-- Former Ratings (status = 'former')
-- ============================================================================

-- B0302: Former Navy Warrant Officer Sunday Ekpoudom (DISCHARGED)
INSERT IGNORE INTO ratings (
  service_number, status, rate_id, title_id, surname, first_name, middle_name,
  gender_id, date_of_birth, marital_status_id,
  religion_id, religion_denomination_id, tribe_id,
  state_id, local_government_id, home_address, mother_base_id, place_of_birth,
  email_address, phone, geo_political_zone_id,
  blood_group_id, blood_genotype_id, tribal_mark, disability_id,
  branch_id, command_id, staff_branch_id, seniority_date, entry_mode_id,
  exit_type_id, exit_date, exit_reason, date_employed, specialisation_id
) VALUES (
  'B0302', 'former',
  (SELECT id FROM ref_rate WHERE name = 'Navy Warrant Officer (NWO)'),
  (SELECT id FROM ref_title WHERE name = 'NWO'),
  'EKPOUDOM', 'SUNDAY', 'UDO',
  (SELECT id FROM ref_gender WHERE name = 'Male'),
  '1969-05-11',
  (SELECT id FROM ref_marital_status WHERE name = 'Married'),
  (SELECT id FROM ref_religion WHERE name = 'Christianity'),
  (SELECT id FROM ref_religion_denomination WHERE name = 'Methodist' LIMIT 1),
  (SELECT id FROM ref_tribe WHERE name = 'Ibibio'),
  (SELECT id FROM ref_state WHERE name = 'Akwa Ibom'),
  (SELECT id FROM ref_local_government WHERE name = 'Ikot Abasi' LIMIT 1),
  '27 Ikot Ekpene Road, Uyo, Akwa Ibom',
  (SELECT id FROM ref_mother_base WHERE name = 'NNS JUBILEE (Ikot Abasi)'),
  'Ikot Abasi',
  'sunday.ekpoudom@example.com', '08034001122',
  (SELECT id FROM ref_geo_political_zone WHERE name = 'South South'),
  (SELECT id FROM ref_blood_group WHERE name = 'O+'),
  (SELECT id FROM ref_blood_genotype WHERE name = 'AA'),
  0,
  (SELECT id FROM ref_disability WHERE name = 'None'),
  (SELECT id FROM ref_branch WHERE name = 'Seaman'),
  (SELECT id FROM ref_command WHERE name = 'Eastern Naval Command'),
  (SELECT id FROM ref_staff_branch WHERE name = 'Operations'),
  '2018-01-01',
  (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'),
  (SELECT id FROM ref_exit_type WHERE name = 'DISCHARGED'),
  '2024-05-31',
  'Statutory completion of 35 years meritorious naval service.',
  '1989-06-01',
  (SELECT id FROM ref_specialisation WHERE name = 'Navigation')
);

-- B0324: Former Master Warrant Officer Ibrahim Garba (RETIRED)
INSERT IGNORE INTO ratings (
  service_number, status, rate_id, title_id, surname, first_name, middle_name,
  gender_id, date_of_birth, marital_status_id,
  religion_id, religion_denomination_id, tribe_id,
  state_id, local_government_id, home_address, mother_base_id, place_of_birth,
  email_address, phone, geo_political_zone_id,
  blood_group_id, blood_genotype_id, tribal_mark, disability_id,
  branch_id, command_id, staff_branch_id, seniority_date, entry_mode_id,
  exit_type_id, exit_date, exit_reason, date_employed, specialisation_id
) VALUES (
  'B0324', 'former',
  (SELECT id FROM ref_rate WHERE name = 'Master Warrant Officer (MWO)'),
  (SELECT id FROM ref_title WHERE name = 'MWO'),
  'GARBA', 'IBRAHIM', 'SANI',
  (SELECT id FROM ref_gender WHERE name = 'Male'),
  '1971-10-20',
  (SELECT id FROM ref_marital_status WHERE name = 'Married'),
  (SELECT id FROM ref_religion WHERE name = 'Islam'),
  (SELECT id FROM ref_religion_denomination WHERE name = 'Sunni' LIMIT 1),
  (SELECT id FROM ref_tribe WHERE name = 'Hausa'),
  (SELECT id FROM ref_state WHERE name = 'Kano'),
  (SELECT id FROM ref_local_government WHERE name = 'Nassarawa' LIMIT 1),
  '41 Tarauni Layout, Kano',
  (SELECT id FROM ref_mother_base WHERE name = 'NNS BEECROFT (Apapa)'),
  'Kano',
  'i.garba@example.com', '08029004411',
  (SELECT id FROM ref_geo_political_zone WHERE name = 'North West'),
  (SELECT id FROM ref_blood_group WHERE name = 'B+'),
  (SELECT id FROM ref_blood_genotype WHERE name = 'AA'),
  0,
  (SELECT id FROM ref_disability WHERE name = 'None'),
  (SELECT id FROM ref_branch WHERE name = 'Logistics'),
  (SELECT id FROM ref_command WHERE name = 'Logistics Command'),
  (SELECT id FROM ref_staff_branch WHERE name = 'Accounts & Budget'),
  '2017-07-01',
  (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'),
  (SELECT id FROM ref_exit_type WHERE name = 'DISCHARGED'),
  '2025-01-15',
  'Honourable discharge upon completion of engagement.',
  '1991-02-14',
  (SELECT id FROM ref_specialisation WHERE name = 'Writer (Admin)')
);

-- B0410: Former Chief Petty Officer Oghenekaro Dafe (VOLUNTARY DISCHARGE)
INSERT IGNORE INTO ratings (
  service_number, status, rate_id, title_id, surname, first_name, middle_name,
  gender_id, date_of_birth, marital_status_id,
  religion_id, religion_denomination_id, tribe_id,
  state_id, local_government_id, home_address, mother_base_id, place_of_birth,
  email_address, phone, geo_political_zone_id,
  blood_group_id, blood_genotype_id, tribal_mark, disability_id,
  branch_id, command_id, staff_branch_id, seniority_date, entry_mode_id,
  exit_type_id, exit_date, exit_reason, date_employed, specialisation_id
) VALUES (
  'B0410', 'former',
  (SELECT id FROM ref_rate WHERE name = 'Chief Petty Officer (CPO)'),
  (SELECT id FROM ref_title WHERE name = 'CPO'),
  'DAFE', 'OGHENEKARO', 'EFE',
  (SELECT id FROM ref_gender WHERE name = 'Male'),
  '1984-02-08',
  (SELECT id FROM ref_marital_status WHERE name = 'Married'),
  (SELECT id FROM ref_religion WHERE name = 'Christianity'),
  (SELECT id FROM ref_religion_denomination WHERE name = 'Pentecostal' LIMIT 1),
  (SELECT id FROM ref_tribe WHERE name = 'Urhobo'),
  (SELECT id FROM ref_state WHERE name = 'Delta'),
  (SELECT id FROM ref_local_government WHERE name = 'Sapele' LIMIT 1),
  '10 Okpe Road, Sapele, Delta',
  (SELECT id FROM ref_mother_base WHERE name = 'NNS DELTA (Warri)'),
  'Sapele',
  'o.dafe@example.com', '08057771234',
  (SELECT id FROM ref_geo_political_zone WHERE name = 'South South'),
  (SELECT id FROM ref_blood_group WHERE name = 'A+'),
  (SELECT id FROM ref_blood_genotype WHERE name = 'AA'),
  0,
  (SELECT id FROM ref_disability WHERE name = 'None'),
  (SELECT id FROM ref_branch WHERE name = 'Marine Engineering'),
  (SELECT id FROM ref_command WHERE name = 'Central Naval Command'),
  (SELECT id FROM ref_staff_branch WHERE name = 'Fleet Maintenance'),
  '2019-03-01',
  (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'),
  (SELECT id FROM ref_exit_type WHERE name = 'VOLUNTARY DISCHARGE'),
  '2025-08-30',
  'Voluntary disengagement after 18 years service.',
  '2007-07-19',
  (SELECT id FROM ref_specialisation WHERE name = 'Hull Maintenance')
);

-- B0455F: Former Petty Officer Ngozi Nwosu (DISCHARGED)
INSERT IGNORE INTO ratings (
  service_number, status, rate_id, title_id, surname, first_name, middle_name,
  gender_id, date_of_birth, marital_status_id,
  religion_id, religion_denomination_id, tribe_id,
  state_id, local_government_id, home_address, mother_base_id, place_of_birth,
  email_address, phone, geo_political_zone_id,
  blood_group_id, blood_genotype_id, tribal_mark, disability_id,
  branch_id, command_id, staff_branch_id, seniority_date, entry_mode_id,
  exit_type_id, exit_date, exit_reason, date_employed, specialisation_id
) VALUES (
  'B0455F', 'former',
  (SELECT id FROM ref_rate WHERE name = 'Petty Officer (PO)'),
  (SELECT id FROM ref_title WHERE name = 'PO'),
  'NWOSU', 'NGOZI', 'CHIAMAKA',
  (SELECT id FROM ref_gender WHERE name = 'Female'),
  '1988-09-14',
  (SELECT id FROM ref_marital_status WHERE name = 'Married'),
  (SELECT id FROM ref_religion WHERE name = 'Christianity'),
  (SELECT id FROM ref_religion_denomination WHERE name = 'Catholic' LIMIT 1),
  (SELECT id FROM ref_tribe WHERE name = 'Igbo'),
  (SELECT id FROM ref_state WHERE name = 'Imo'),
  (SELECT id FROM ref_local_government WHERE name = 'Owerri Municipal' LIMIT 1),
  '6 Ikenegbu Extension, Owerri, Imo',
  (SELECT id FROM ref_mother_base WHERE name = 'NNS PATHFINDER (Port Harcourt)'),
  'Owerri',
  'n.nwosu@example.com', '08061198832',
  (SELECT id FROM ref_geo_political_zone WHERE name = 'South East'),
  (SELECT id FROM ref_blood_group WHERE name = 'O+'),
  (SELECT id FROM ref_blood_genotype WHERE name = 'AS'),
  0,
  (SELECT id FROM ref_disability WHERE name = 'None'),
  (SELECT id FROM ref_branch WHERE name = 'Education'),
  (SELECT id FROM ref_command WHERE name = 'Naval Training Command'),
  (SELECT id FROM ref_staff_branch WHERE name = 'Training'),
  '2020-10-01',
  (SELECT id FROM ref_entry_mode WHERE name = 'Specialist Enlistment'),
  (SELECT id FROM ref_exit_type WHERE name = 'DISCHARGED'),
  '2026-02-28',
  'Discharged on completion of contract engagement.',
  '2011-01-10',
  (SELECT id FROM ref_specialisation WHERE name = 'Catering')
);

-- ============================================================================
-- 2. Drafting History (Current Ship = open row where end_date IS NULL)
-- ============================================================================
INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT 'B0539',
       (SELECT id FROM ref_ship WHERE name = 'NNS QUORRA'),
       (SELECT id FROM ref_rate WHERE name = 'Ordinary Seaman (OS)'),
       '2012-09-15', '2015-08-31', 'Initial seamanship & navigation posting'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_drafting WHERE service_number = 'B0539' AND start_date = '2012-09-15'
);

INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT 'B0539',
       (SELECT id FROM ref_ship WHERE name = 'NNS THUNDER'),
       (SELECT id FROM ref_rate WHERE name = 'Leading Seaman (LS)'),
       '2015-09-01', '2021-12-31', 'Bridge watchkeeping & coastal patrol duties'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_drafting WHERE service_number = 'B0539' AND start_date = '2015-09-01'
);

INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT 'B0539',
       (SELECT id FROM ref_ship WHERE name = 'NNS KADA'),
       (SELECT id FROM ref_rate WHERE name = 'Petty Officer (PO)'),
       '2022-01-01', NULL, 'Quartermaster & senior navigation petty officer'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_drafting WHERE service_number = 'B0539' AND start_date = '2022-01-01'
);

INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT 'B0541',
       (SELECT id FROM ref_ship WHERE name = 'NNS ARADU'),
       (SELECT id FROM ref_rate WHERE name = 'Chief Petty Officer (CPO)'),
       '2021-02-01', NULL, 'Senior Marine Engineering Artificer'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_drafting WHERE service_number = 'B0541' AND start_date = '2021-02-01'
);

INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT 'B0559F',
       (SELECT id FROM ref_ship WHERE name = 'NHQ ABUJA'),
       (SELECT id FROM ref_rate WHERE name = 'Leading Seaman (LS)'),
       '2023-06-01', NULL, 'CIRERMS Records & Navpers Systems Desk'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_drafting WHERE service_number = 'B0559F' AND start_date = '2023-06-01'
);

INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT 'B0562',
       (SELECT id FROM ref_ship WHERE name = 'NNS OKPABANA'),
       (SELECT id FROM ref_rate WHERE name = 'Able Seaman (AB)'),
       '2024-01-15', NULL, 'Forward gunnery division'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_drafting WHERE service_number = 'B0562' AND start_date = '2024-01-15'
);

INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT 'B0575',
       (SELECT id FROM ref_ship WHERE name = 'NNS VICTORY'),
       (SELECT id FROM ref_rate WHERE name = 'Warrant Officer (WO)'),
       '2020-07-01', NULL, 'Base Weapon Electrical Officer Assistant'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_drafting WHERE service_number = 'B0575' AND start_date = '2020-07-01'
);

INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT 'B0588',
       (SELECT id FROM ref_ship WHERE name = 'NNS DELTA'),
       (SELECT id FROM ref_rate WHERE name = 'Petty Officer (PO)'),
       '2022-11-15', NULL, 'Regulating Petty Officer'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_drafting WHERE service_number = 'B0588' AND start_date = '2022-11-15'
);

INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT 'B0601F',
       (SELECT id FROM ref_ship WHERE name = 'NHQ ABUJA'),
       (SELECT id FROM ref_rate WHERE name = 'Able Seaman (AB)'),
       '2024-03-10', NULL, 'Medical Reception Station'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_drafting WHERE service_number = 'B0601F' AND start_date = '2024-03-10'
);

INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT 'B0614',
       (SELECT id FROM ref_ship WHERE name = 'NNS PATHFINDER'),
       (SELECT id FROM ref_rate WHERE name = 'Leading Seaman (LS)'),
       '2023-02-01', NULL, 'Victualling & Fleet Stores'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_drafting WHERE service_number = 'B0614' AND start_date = '2023-02-01'
);

INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT 'B0627',
       (SELECT id FROM ref_ship WHERE name = 'NNS QUORRA'),
       (SELECT id FROM ref_rate WHERE name = 'Ordinary Seaman (OS)'),
       '2024-09-02', NULL, 'Basic Communications Wing'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_drafting WHERE service_number = 'B0627' AND start_date = '2024-09-02'
);

INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT 'B0640',
       (SELECT id FROM ref_ship WHERE name = 'NNS CENTENARY'),
       (SELECT id FROM ref_rate WHERE name = 'Master Warrant Officer (MWO)'),
       '2019-08-01', NULL, 'Coxswain & Operations Master Warrant Officer'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_drafting WHERE service_number = 'B0640' AND start_date = '2019-08-01'
);

-- Closed drafting history for former rating B0302
INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT 'B0302',
       (SELECT id FROM ref_ship WHERE name = 'NNS JUBILEE'),
       (SELECT id FROM ref_rate WHERE name = 'Navy Warrant Officer (NWO)'),
       '2018-02-01', '2024-05-31', 'Final shore billet prior to statutory discharge'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_drafting WHERE service_number = 'B0302' AND start_date = '2018-02-01'
);

-- ============================================================================
-- 3. Rich Dossier Records for B0539 (and B0559F) across all remaining tabs
-- ============================================================================

-- Next of Kin
INSERT INTO rating_next_of_kin (service_number, first_name, last_name, mobile_number, next_of_kin_type_id)
SELECT 'B0539', 'Adaeze', 'Okonkwo', '08036671290',
       (SELECT id FROM ref_next_of_kin_type WHERE name = 'Primary')
WHERE NOT EXISTS (
  SELECT 1 FROM rating_next_of_kin WHERE service_number = 'B0539' AND first_name = 'Adaeze'
);

INSERT INTO rating_next_of_kin (service_number, first_name, last_name, mobile_number, next_of_kin_type_id)
SELECT 'B0539', 'Nnamdi', 'Okonkwo', '08062289011',
       (SELECT id FROM ref_next_of_kin_type WHERE name = 'Secondary')
WHERE NOT EXISTS (
  SELECT 1 FROM rating_next_of_kin WHERE service_number = 'B0539' AND first_name = 'Nnamdi'
);

INSERT INTO rating_next_of_kin (service_number, first_name, last_name, mobile_number, next_of_kin_type_id)
SELECT 'B0559F', 'Babatunde', 'Adeyemi', '08024417890',
       (SELECT id FROM ref_next_of_kin_type WHERE name = 'Primary')
WHERE NOT EXISTS (
  SELECT 1 FROM rating_next_of_kin WHERE service_number = 'B0559F' AND first_name = 'Babatunde'
);

-- Spouse
INSERT INTO rating_spouse (service_number, name, phone_number, email_address)
SELECT 'B0539', 'Adaeze Chioma Okonkwo', '08036671290', 'adaeze.okonkwo@example.com'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_spouse WHERE service_number = 'B0539' AND name = 'Adaeze Chioma Okonkwo'
);

INSERT INTO rating_spouse (service_number, name, phone_number, email_address)
SELECT 'B0559F', 'Babatunde Segun Adeyemi', '08024417890', 'b.adeyemi@example.com'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_spouse WHERE service_number = 'B0559F' AND name = 'Babatunde Segun Adeyemi'
);

-- Children
INSERT INTO rating_children (service_number, name, phone_number, email_address)
SELECT 'B0539', 'Kamsiyochukwu Okonkwo', '08036671290', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM rating_children WHERE service_number = 'B0539' AND name = 'Kamsiyochukwu Okonkwo'
);

INSERT INTO rating_children (service_number, name, phone_number, email_address)
SELECT 'B0539', 'Chizaram Okonkwo', '08036671290', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM rating_children WHERE service_number = 'B0539' AND name = 'Chizaram Okonkwo'
);

-- Advancement
INSERT INTO rating_advancement (service_number, start_date, end_date, rate_id, decoration, authority, gcbno)
SELECT 'B0539', '2014-09-15', '2018-06-30',
       (SELECT id FROM ref_rate WHERE name = 'Able Seaman (AB)'),
       'Good Conduct Stripe I', 'NAVPERS/ADV/2014/118', 'GCB-14088'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_advancement WHERE service_number = 'B0539' AND gcbno = 'GCB-14088'
);

INSERT INTO rating_advancement (service_number, start_date, end_date, rate_id, decoration, authority, gcbno)
SELECT 'B0539', '2018-07-01', '2022-06-30',
       (SELECT id FROM ref_rate WHERE name = 'Leading Seaman (LS)'),
       'Good Conduct Badge II', 'NAVPERS/ADV/2018/204', 'GCB-18204'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_advancement WHERE service_number = 'B0539' AND gcbno = 'GCB-18204'
);

INSERT INTO rating_advancement (service_number, start_date, end_date, rate_id, decoration, authority, gcbno)
SELECT 'B0539', '2022-07-01', NULL,
       (SELECT id FROM ref_rate WHERE name = 'Petty Officer (PO)'),
       'General Service Medal', 'NHQ/CNS/ADV/2022/059', 'GCB-22059'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_advancement WHERE service_number = 'B0539' AND gcbno = 'GCB-22059'
);

-- Training
INSERT INTO rating_training (service_number, institution, qualification, classification, start_date, end_date)
SELECT 'B0539', 'Nigerian Navy Basic Training School (NNBTS) Onne', 'Basic Seamanship Certificate', 'Distinction', '2012-09-15', '2013-03-20'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_training WHERE service_number = 'B0539' AND qualification = 'Basic Seamanship Certificate'
);

INSERT INTO rating_training (service_number, institution, qualification, classification, start_date, end_date)
SELECT 'B0539', 'NNS QUORRA Navigation & Direction School', 'Quartermaster Qualifying Course (QQC)', 'Upper Credit', '2019-02-04', '2019-08-16'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_training WHERE service_number = 'B0539' AND qualification = 'Quartermaster Qualifying Course (QQC)'
);

-- Education
INSERT INTO rating_education (service_number, start_date, end_date, institution, qualification, classification)
SELECT 'B0539', '2003-09-10', '2009-06-30', 'Dennis Memorial Grammar School, Onitsha', 'WASSCE', '6 Credits'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_education WHERE service_number = 'B0539' AND institution = 'Dennis Memorial Grammar School, Onitsha'
);

INSERT INTO rating_education (service_number, start_date, end_date, institution, qualification, classification)
SELECT 'B0539', '2015-10-01', '2017-09-30', 'Maritime Academy of Nigeria, Oron', 'National Diploma (Nautical Science)', 'Upper Credit'
WHERE NOT EXISTS (
  SELECT 1 FROM rating_education WHERE service_number = 'B0539' AND institution = 'Maritime Academy of Nigeria, Oron'
);

-- Language (has UNIQUE(service_number, language_id))
INSERT IGNORE INTO rating_language (service_number, language_id, can_read, can_write, can_speak)
VALUES
  ('B0539', (SELECT id FROM ref_language WHERE name = 'English'), 1, 1, 1),
  ('B0539', (SELECT id FROM ref_language WHERE name = 'Igbo'), 1, 1, 1),
  ('B0539', (SELECT id FROM ref_language WHERE name = 'Nigerian Pidgin'), 1, 0, 1),
  ('B0559F', (SELECT id FROM ref_language WHERE name = 'English'), 1, 1, 1),
  ('B0559F', (SELECT id FROM ref_language WHERE name = 'Yoruba'), 1, 1, 1);

-- ============================================================================
-- 4. System Login Accounts (`users` table — separate from `ratings`)
-- ============================================================================
-- HICO001 / Admin@123  (Administrator; service_number = NULL)
-- B0539   / Rating@123 (Rating-linked account; demonstrates "View My Details")
INSERT IGNORE INTO users (username, password_hash, full_name, role_id, service_number, is_active)
VALUES
  (
    'HICO001',
    '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42',
    'HICO Administrator',
    (SELECT id FROM roles WHERE name = 'Administrator'),
    NULL,
    1
  ),
  (
    'B0539',
    '$2a$10$dx88V0ZKKf48RieJLVEod.MC2YcQ7pzp3QxY85rTWEImDhqQw9dqG',
    'PO Chukwuemeka Okonkwo',
    (SELECT id FROM roles WHERE name = 'Rating'),
    'B0539',
    1
  );
