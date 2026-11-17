-- Lookup values. Placeholders until the real dropdown lists are supplied.
-- Insert-only-missing: every table has a UNIQUE key, so INSERT IGNORE is safe to rerun.

-- ============================================================================
-- Core lookup values
-- ============================================================================
INSERT IGNORE INTO ref_gender (name, sort_order) VALUES ('Male', 1), ('Female', 2);

INSERT IGNORE INTO ref_marital_status (name, sort_order) VALUES
  ('Single', 1), ('Married', 2), ('Divorced', 3), ('Widowed', 4);

INSERT IGNORE INTO ref_religion (name, sort_order) VALUES
  ('Christianity', 1), ('Islam', 2), ('Other', 3);

INSERT IGNORE INTO ref_next_of_kin_type (name, sort_order) VALUES ('Primary', 1), ('Secondary', 2);

INSERT IGNORE INTO ref_exit_type (name, sort_order) VALUES
  ('DISCHARGED', 1),
  ('RETIRED', 2),
  ('VOLUNTARY DISCHARGE', 3),
  ('MEDICAL DISCHARGE', 4),
  ('DISMISSED', 5),
  ('DECEASED', 6);

INSERT IGNORE INTO ref_geo_political_zone (name, sort_order) VALUES
  ('North Central', 1), ('North East', 2), ('North West', 3),
  ('South East', 4), ('South South', 5), ('South West', 6);

INSERT IGNORE INTO ref_blood_group (name, sort_order) VALUES
  ('A+', 1), ('A-', 2), ('B+', 3), ('B-', 4), ('AB+', 5), ('AB-', 6), ('O+', 7), ('O-', 8);

INSERT IGNORE INTO ref_blood_genotype (name, sort_order) VALUES
  ('AA', 1), ('AS', 2), ('SS', 3), ('AC', 4), ('SC', 5);

INSERT IGNORE INTO ref_document_category (code, name, sort_order) VALUES
  ('DRAFTING',     'Drafting', 1),
  ('CERTIFICATE',  'Certificate', 2),
  ('REQUEST_FORM', 'Request Forms', 3),
  ('EMOLUMENT',    'Emolument / Re-engage Forms', 4),
  ('GEN_FORM',     'General Forms', 5),
  ('OTHER',        'Other', 6);

-- ============================================================================
-- Placeholder naval & demographic lookups (replace when official lists arrive)
-- ============================================================================
INSERT IGNORE INTO ref_rate (name, sort_order) VALUES
  ('Ordinary Seaman (OS)', 1),
  ('Able Seaman (AB)', 2),
  ('Leading Seaman (LS)', 3),
  ('Petty Officer (PO)', 4),
  ('Chief Petty Officer (CPO)', 5),
  ('Warrant Officer (WO)', 6),
  ('Master Warrant Officer (MWO)', 7),
  ('Navy Warrant Officer (NWO)', 8);

INSERT IGNORE INTO ref_title (name, sort_order) VALUES
  ('OS', 1), ('AB', 2), ('LS', 3), ('PO', 4),
  ('CPO', 5), ('WO', 6), ('MWO', 7), ('NWO', 8),
  ('Mr', 9), ('Mrs', 10), ('Miss', 11);

INSERT IGNORE INTO ref_religion_denomination (religion_id, name, sort_order)
SELECT id, 'Catholic', 1 FROM ref_religion WHERE name = 'Christianity'
UNION ALL SELECT id, 'Anglican', 2 FROM ref_religion WHERE name = 'Christianity'
UNION ALL SELECT id, 'Pentecostal', 3 FROM ref_religion WHERE name = 'Christianity'
UNION ALL SELECT id, 'Methodist', 4 FROM ref_religion WHERE name = 'Christianity'
UNION ALL SELECT id, 'Baptist', 5 FROM ref_religion WHERE name = 'Christianity'
UNION ALL SELECT id, 'ECWA', 6 FROM ref_religion WHERE name = 'Christianity'
UNION ALL SELECT id, 'Sunni', 1 FROM ref_religion WHERE name = 'Islam'
UNION ALL SELECT id, 'Ahmadiyya', 2 FROM ref_religion WHERE name = 'Islam'
UNION ALL SELECT id, 'Tijaniyya', 3 FROM ref_religion WHERE name = 'Islam'
UNION ALL SELECT id, 'Non-Denominational', 1 FROM ref_religion WHERE name = 'Other'
UNION ALL SELECT id, 'Traditional', 2 FROM ref_religion WHERE name = 'Other';

INSERT IGNORE INTO ref_tribe (name, sort_order) VALUES
  ('Edo', 1), ('Efik', 2), ('Fulani', 3), ('Hausa', 4),
  ('Ibibio', 5), ('Idoma', 6), ('Igala', 7), ('Igbo', 8),
  ('Ijaw', 9), ('Itsekiri', 10), ('Kanuri', 11), ('Nupe', 12),
  ('Tiv', 13), ('Urhobo', 14), ('Yoruba', 15), ('Other', 99);

INSERT IGNORE INTO ref_ship (name, sort_order) VALUES
  ('NNS ARADU', 1),
  ('NNS THUNDER', 2),
  ('NNS OKPABANA', 3),
  ('NNS CENTENARY', 4),
  ('NNS UNITY', 5),
  ('NNS PROSPERITY', 6),
  ('NNS KADA', 7),
  ('NNS BEECROFT', 8),
  ('NNS PATHFINDER', 9),
  ('NNS VICTORY', 10),
  ('NNS DELTA', 11),
  ('NNS JUBILEE', 12),
  ('NNS QUORRA', 13),
  ('NAVTRAC EBUTE-ERO', 14),
  ('NHQ ABUJA', 15);

INSERT IGNORE INTO ref_language (name, sort_order) VALUES
  ('English', 1), ('Hausa', 2), ('Igbo', 3), ('Yoruba', 4),
  ('French', 5), ('Arabic', 6), ('Nigerian Pidgin', 7),
  ('Efik', 8), ('Ijaw', 9), ('Kanuri', 10), ('Tiv', 11);

INSERT IGNORE INTO ref_mother_base (name, sort_order) VALUES
  ('NNS BEECROFT (Apapa)', 1),
  ('NNS PATHFINDER (Port Harcourt)', 2),
  ('NNS VICTORY (Calabar)', 3),
  ('NNS DELTA (Warri)', 4),
  ('NNS JUBILEE (Ikot Abasi)', 5),
  ('NNS LUGARD (Lokoja)', 6),
  ('NHQ (Abuja)', 7);

INSERT IGNORE INTO ref_identification_type (name, sort_order) VALUES
  ('Naval ID Card', 1),
  ('National ID (NIN)', 2),
  ('International Passport', 3),
  ('Driver License', 4),
  ('Voter Card', 5);

INSERT IGNORE INTO ref_hair_color (name, sort_order) VALUES
  ('Black', 1), ('Dark Brown', 2), ('Brown', 3), ('Grey', 4), ('Bald', 5);

INSERT IGNORE INTO ref_eye_color (name, sort_order) VALUES
  ('Dark Brown', 1), ('Brown', 2), ('Black', 3), ('Hazel', 4);

INSERT IGNORE INTO ref_complexion (name, sort_order) VALUES
  ('Dark', 1), ('Chocolate', 2), ('Fair', 3), ('Light', 4);

INSERT IGNORE INTO ref_disability (name, sort_order) VALUES
  ('None', 1),
  ('Visual Impairment', 2),
  ('Hearing Impairment', 3),
  ('Mobility Impairment', 4),
  ('Other', 5);

INSERT IGNORE INTO ref_branch (name, sort_order) VALUES
  ('Seaman', 1),
  ('Marine Engineering', 2),
  ('Weapon Engineering', 3),
  ('Logistics', 4),
  ('Medical', 5),
  ('Information Technology', 6),
  ('Education', 7),
  ('Naval Police', 8),
  ('Music', 9),
  ('Physical Training', 10);

INSERT IGNORE INTO ref_command (name, sort_order) VALUES
  ('Western Naval Command', 1),
  ('Eastern Naval Command', 2),
  ('Central Naval Command', 3),
  ('Naval Training Command', 4),
  ('Logistics Command', 5),
  ('Naval Doctrine Command', 6),
  ('Naval Headquarters', 7);

INSERT IGNORE INTO ref_staff_branch (name, sort_order) VALUES
  ('Personnel (Navpers)', 1),
  ('Operations', 2),
  ('Administration', 3),
  ('Logistics', 4),
  ('Training', 5),
  ('Accounts & Budget', 6),
  ('Fleet Maintenance', 7);

INSERT IGNORE INTO ref_entry_mode (name, sort_order) VALUES
  ('Regular Recruitment', 1),
  ('Specialist Enlistment', 2),
  ('Direct Intake', 3),
  ('Sportsmen Enlistment', 4);

INSERT IGNORE INTO ref_specialisation (name, sort_order) VALUES
  ('Gunnery', 1),
  ('Navigation', 2),
  ('Communications', 3),
  ('Radar Plotter', 4),
  ('Marine Propulsion', 5),
  ('Electrical / Weapon Systems', 6),
  ('Hull Maintenance', 7),
  ('Stores & Supply', 8),
  ('Catering', 9),
  ('Writer (Admin)', 10),
  ('Medical Assistant', 11),
  ('Regulating (Provost)', 12),
  ('ICT / Cyber', 13),
  ('Hydrography', 14),
  ('Clearance Diver', 15);

INSERT IGNORE INTO ref_state (name, sort_order) VALUES
  ('Abia', 1), ('Adamawa', 2), ('Akwa Ibom', 3), ('Anambra', 4),
  ('Bauchi', 5), ('Bayelsa', 6), ('Benue', 7), ('Borno', 8),
  ('Cross River', 9), ('Delta', 10), ('Ebonyi', 11), ('Edo', 12),
  ('Ekiti', 13), ('Enugu', 14), ('FCT - Abuja', 15), ('Gombe', 16),
  ('Imo', 17), ('Jigawa', 18), ('Kaduna', 19), ('Kano', 20),
  ('Katsina', 21), ('Kebbi', 22), ('Kogi', 23), ('Kwara', 24),
  ('Lagos', 25), ('Nasarawa', 26), ('Niger', 27), ('Ogun', 28),
  ('Ondo', 29), ('Osun', 30), ('Oyo', 31), ('Plateau', 32),
  ('Rivers', 33), ('Sokoto', 34), ('Taraba', 35), ('Yobe', 36),
  ('Zamfara', 37);

-- Representative LGAs for every state (placeholder subset until full 774 LGA list is loaded)
INSERT IGNORE INTO ref_local_government (state_id, name, sort_order)
SELECT id, 'Umuahia North', 1 FROM ref_state WHERE name = 'Abia'
UNION ALL SELECT id, 'Aba South', 2 FROM ref_state WHERE name = 'Abia'
UNION ALL SELECT id, 'Yola North', 1 FROM ref_state WHERE name = 'Adamawa'
UNION ALL SELECT id, 'Mubi North', 2 FROM ref_state WHERE name = 'Adamawa'
UNION ALL SELECT id, 'Uyo', 1 FROM ref_state WHERE name = 'Akwa Ibom'
UNION ALL SELECT id, 'Ikot Abasi', 2 FROM ref_state WHERE name = 'Akwa Ibom'
UNION ALL SELECT id, 'Eket', 3 FROM ref_state WHERE name = 'Akwa Ibom'
UNION ALL SELECT id, 'Awka South', 1 FROM ref_state WHERE name = 'Anambra'
UNION ALL SELECT id, 'Onitsha North', 2 FROM ref_state WHERE name = 'Anambra'
UNION ALL SELECT id, 'Nnewi North', 3 FROM ref_state WHERE name = 'Anambra'
UNION ALL SELECT id, 'Bauchi', 1 FROM ref_state WHERE name = 'Bauchi'
UNION ALL SELECT id, 'Katagum', 2 FROM ref_state WHERE name = 'Bauchi'
UNION ALL SELECT id, 'Yenagoa', 1 FROM ref_state WHERE name = 'Bayelsa'
UNION ALL SELECT id, 'Brass', 2 FROM ref_state WHERE name = 'Bayelsa'
UNION ALL SELECT id, 'Southern Ijaw', 3 FROM ref_state WHERE name = 'Bayelsa'
UNION ALL SELECT id, 'Makurdi', 1 FROM ref_state WHERE name = 'Benue'
UNION ALL SELECT id, 'Otukpo', 2 FROM ref_state WHERE name = 'Benue'
UNION ALL SELECT id, 'Gboko', 3 FROM ref_state WHERE name = 'Benue'
UNION ALL SELECT id, 'Maiduguri', 1 FROM ref_state WHERE name = 'Borno'
UNION ALL SELECT id, 'Biu', 2 FROM ref_state WHERE name = 'Borno'
UNION ALL SELECT id, 'Calabar Municipal', 1 FROM ref_state WHERE name = 'Cross River'
UNION ALL SELECT id, 'Calabar South', 2 FROM ref_state WHERE name = 'Cross River'
UNION ALL SELECT id, 'Ogoja', 3 FROM ref_state WHERE name = 'Cross River'
UNION ALL SELECT id, 'Warri South', 1 FROM ref_state WHERE name = 'Delta'
UNION ALL SELECT id, 'Oshimili South', 2 FROM ref_state WHERE name = 'Delta'
UNION ALL SELECT id, 'Sapele', 3 FROM ref_state WHERE name = 'Delta'
UNION ALL SELECT id, 'Abakaliki', 1 FROM ref_state WHERE name = 'Ebonyi'
UNION ALL SELECT id, 'Afikpo North', 2 FROM ref_state WHERE name = 'Ebonyi'
UNION ALL SELECT id, 'Oredo', 1 FROM ref_state WHERE name = 'Edo'
UNION ALL SELECT id, 'Etsako West', 2 FROM ref_state WHERE name = 'Edo'
UNION ALL SELECT id, 'Ado Ekiti', 1 FROM ref_state WHERE name = 'Ekiti'
UNION ALL SELECT id, 'Ikere', 2 FROM ref_state WHERE name = 'Ekiti'
UNION ALL SELECT id, 'Enugu North', 1 FROM ref_state WHERE name = 'Enugu'
UNION ALL SELECT id, 'Nsukka', 2 FROM ref_state WHERE name = 'Enugu'
UNION ALL SELECT id, 'Abuja Municipal (AMAC)', 1 FROM ref_state WHERE name = 'FCT - Abuja'
UNION ALL SELECT id, 'Bwari', 2 FROM ref_state WHERE name = 'FCT - Abuja'
UNION ALL SELECT id, 'Gwagwalada', 3 FROM ref_state WHERE name = 'FCT - Abuja'
UNION ALL SELECT id, 'Gombe', 1 FROM ref_state WHERE name = 'Gombe'
UNION ALL SELECT id, 'Akko', 2 FROM ref_state WHERE name = 'Gombe'
UNION ALL SELECT id, 'Owerri Municipal', 1 FROM ref_state WHERE name = 'Imo'
UNION ALL SELECT id, 'Orlu', 2 FROM ref_state WHERE name = 'Imo'
UNION ALL SELECT id, 'Dutse', 1 FROM ref_state WHERE name = 'Jigawa'
UNION ALL SELECT id, 'Hadejia', 2 FROM ref_state WHERE name = 'Jigawa'
UNION ALL SELECT id, 'Kaduna North', 1 FROM ref_state WHERE name = 'Kaduna'
UNION ALL SELECT id, 'Zaria', 2 FROM ref_state WHERE name = 'Kaduna'
UNION ALL SELECT id, 'Chikun', 3 FROM ref_state WHERE name = 'Kaduna'
UNION ALL SELECT id, 'Kano Municipal', 1 FROM ref_state WHERE name = 'Kano'
UNION ALL SELECT id, 'Nassarawa', 2 FROM ref_state WHERE name = 'Kano'
UNION ALL SELECT id, 'Gwale', 3 FROM ref_state WHERE name = 'Kano'
UNION ALL SELECT id, 'Katsina', 1 FROM ref_state WHERE name = 'Katsina'
UNION ALL SELECT id, 'Daura', 2 FROM ref_state WHERE name = 'Katsina'
UNION ALL SELECT id, 'Birnin Kebbi', 1 FROM ref_state WHERE name = 'Kebbi'
UNION ALL SELECT id, 'Argungu', 2 FROM ref_state WHERE name = 'Kebbi'
UNION ALL SELECT id, 'Lokoja', 1 FROM ref_state WHERE name = 'Kogi'
UNION ALL SELECT id, 'Idah', 2 FROM ref_state WHERE name = 'Kogi'
UNION ALL SELECT id, 'Okene', 3 FROM ref_state WHERE name = 'Kogi'
UNION ALL SELECT id, 'Ilorin West', 1 FROM ref_state WHERE name = 'Kwara'
UNION ALL SELECT id, 'Offa', 2 FROM ref_state WHERE name = 'Kwara'
UNION ALL SELECT id, 'Apapa', 1 FROM ref_state WHERE name = 'Lagos'
UNION ALL SELECT id, 'Ikeja', 2 FROM ref_state WHERE name = 'Lagos'
UNION ALL SELECT id, 'Ojo', 3 FROM ref_state WHERE name = 'Lagos'
UNION ALL SELECT id, 'Eti-Osa', 4 FROM ref_state WHERE name = 'Lagos'
UNION ALL SELECT id, 'Surulere', 5 FROM ref_state WHERE name = 'Lagos'
UNION ALL SELECT id, 'Lafia', 1 FROM ref_state WHERE name = 'Nasarawa'
UNION ALL SELECT id, 'Keffi', 2 FROM ref_state WHERE name = 'Nasarawa'
UNION ALL SELECT id, 'Chanchaga (Minna)', 1 FROM ref_state WHERE name = 'Niger'
UNION ALL SELECT id, 'Bida', 2 FROM ref_state WHERE name = 'Niger'
UNION ALL SELECT id, 'Abeokuta South', 1 FROM ref_state WHERE name = 'Ogun'
UNION ALL SELECT id, 'Ijebu Ode', 2 FROM ref_state WHERE name = 'Ogun'
UNION ALL SELECT id, 'Akure South', 1 FROM ref_state WHERE name = 'Ondo'
UNION ALL SELECT id, 'Ilaje', 2 FROM ref_state WHERE name = 'Ondo'
UNION ALL SELECT id, 'Osogbo', 1 FROM ref_state WHERE name = 'Osun'
UNION ALL SELECT id, 'Ife Central', 2 FROM ref_state WHERE name = 'Osun'
UNION ALL SELECT id, 'Ibadan North', 1 FROM ref_state WHERE name = 'Oyo'
UNION ALL SELECT id, 'Ogbomosho North', 2 FROM ref_state WHERE name = 'Oyo'
UNION ALL SELECT id, 'Jos North', 1 FROM ref_state WHERE name = 'Plateau'
UNION ALL SELECT id, 'Jos South', 2 FROM ref_state WHERE name = 'Plateau'
UNION ALL SELECT id, 'Port Harcourt', 1 FROM ref_state WHERE name = 'Rivers'
UNION ALL SELECT id, 'Obio/Akpor', 2 FROM ref_state WHERE name = 'Rivers'
UNION ALL SELECT id, 'Bonny', 3 FROM ref_state WHERE name = 'Rivers'
UNION ALL SELECT id, 'Sokoto North', 1 FROM ref_state WHERE name = 'Sokoto'
UNION ALL SELECT id, 'Wamakko', 2 FROM ref_state WHERE name = 'Sokoto'
UNION ALL SELECT id, 'Jalingo', 1 FROM ref_state WHERE name = 'Taraba'
UNION ALL SELECT id, 'Wukari', 2 FROM ref_state WHERE name = 'Taraba'
UNION ALL SELECT id, 'Damaturu', 1 FROM ref_state WHERE name = 'Yobe'
UNION ALL SELECT id, 'Potiskum', 2 FROM ref_state WHERE name = 'Yobe'
UNION ALL SELECT id, 'Gusau', 1 FROM ref_state WHERE name = 'Zamfara'
UNION ALL SELECT id, 'Kaura Namoda', 2 FROM ref_state WHERE name = 'Zamfara';
