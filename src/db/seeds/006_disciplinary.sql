-- Disciplinary Action (WP4): demo cases for every page (pending, concluded, one corrected, cancelled),
-- the old role "Disciplinary Actions" with every privilege of the module, and a role that may
-- initiate and view but not conclude, cancel or correct (for the walkthrough). Safe to rerun.
-- Demo accounts (password Admin@123, as HICO001): NAVPERS01 (Disciplinary Actions), NAVPERS02 (Disciplinary Initiator).

INSERT IGNORE INTO roles (name, description, full_access) VALUES
  ('Disciplinary Actions', 'The old Disciplinary Actions role: initiate, conclude, cancel and correct cases, and the lists and report', 0),
  ('Disciplinary Initiator', 'May open cases and view the lists and the report; cannot conclude, cancel or correct', 0);

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p ON p.screen LIKE 'disciplinary.%'
 WHERE r.name = 'Disciplinary Actions';

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p
    ON (p.screen = 'disciplinary.initiate' AND p.action = 'add')
    OR (p.screen IN ('disciplinary.pending', 'disciplinary.concluded', 'disciplinary.report') AND p.action = 'view')
 WHERE r.name = 'Disciplinary Initiator';

INSERT IGNORE INTO users (username, password_hash, full_name, role_id, service_number, is_active) VALUES
  ('NAVPERS01', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', 'Personnel Office One', (SELECT id FROM roles WHERE name = 'Disciplinary Actions'), NULL, 1),
  ('NAVPERS02', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', 'Personnel Office Two', (SELECT id FROM roles WHERE name = 'Disciplinary Initiator'), NULL, 1);

INSERT INTO discipline_cases
  (case_number, service_number, rate_id, ship_id, incident_date, offence_id, what_happened, reported_by, status,
   decision_date, sanction_id, decision, authority, cancel_reason, opened_by, opened_at,
   concluded_by, concluded_at, cancelled_by, cancelled_at)
SELECT v.no, v.sn, r.rate_id,
       (SELECT d.ship_id FROM rating_drafting d WHERE d.service_number = r.service_number AND d.end_date IS NULL ORDER BY d.id DESC LIMIT 1),
       v.inc, (SELECT id FROM ref_disciplinary_offence WHERE name = v.off), v.what, v.rep, v.st,
       v.dd, (SELECT id FROM ref_disciplinary_sanction WHERE name = v.sanc), v.dcn, v.auth, v.cancel,
       (SELECT id FROM users WHERE username = v.opener), v.opened,
       IF(v.st = 'concluded', (SELECT id FROM users WHERE username = v.closer), NULL), IF(v.st = 'concluded', v.closed, NULL),
       IF(v.st = 'cancelled', (SELECT id FROM users WHERE username = v.closer), NULL), IF(v.st = 'cancelled', v.closed, NULL)
  FROM (
SELECT 'DC-2023-0001' AS no, 'B0410' AS sn, 'Insubordination' AS off, '2023-02-11' AS inc, '2023-02-12 09:00:00' AS opened, 'Used abusive language to a Petty Officer in front of the watch.' AS what, 'Lt Cdr A. Eze (Divisional Officer)' AS rep, 'concluded' AS st, '2023-02-27' AS dd, 'Reduction in rate' AS sanc, 'Found guilty. Reduced one rate.' AS dcn, 'Flag Officer Commanding Western Naval Command' AS auth, NULL AS cancel, 'NAVPERS01' AS opener, 'HICO001' AS closer, '2023-02-28 10:00:00' AS closed
    UNION ALL SELECT 'DC-2025-0001', 'B0575', 'Loss of service property', '2025-05-06', '2025-05-07 09:00:00', 'Lost a ship-issue radio handset.', 'Lt Cdr I. Danladi (Executive Officer)', 'concluded', '2025-05-30', 'Fine', 'Found guilty. Fined the cost of the handset.', 'Commanding Officer', NULL, 'NAVPERS01', 'HICO001', '2025-05-30 11:00:00'
    UNION ALL SELECT 'DC-2025-0002', 'B0541', 'Drunkenness on duty', '2025-08-02', '2025-08-03 09:00:00', 'Unfit for duty after returning from shore leave.', 'Lt O. Adeyemi (Officer of the Watch)', 'concluded', '2025-08-21', 'Fine', 'Found guilty. Fined seven days pay.', 'Executive Officer', NULL, 'NAVPERS02', 'HICO001', '2025-08-22 10:30:00'
    UNION ALL SELECT 'DC-2025-0003', 'B0640', 'Negligent performance of duty', '2025-11-20', '2025-11-21 09:00:00', 'Failed to secure the magazine after the evening rounds.', 'PO B. Bello (Duty Petty Officer)', 'concluded', '2025-12-08', 'Extra duties', 'Found guilty. Seven days of extra duties.', 'Captain Naval Training Command', NULL, 'NAVPERS01', 'NAVPERS01', '2025-12-09 09:30:00'
    UNION ALL SELECT 'DC-2026-0001', 'B0614', 'Disobedience to standing orders', '2026-03-09', '2026-03-10 09:00:00', 'Left the ship in civilian clothes against the standing order on dress ashore.', 'CPO S. Ogunleye (Coxswain)', 'concluded', '2026-03-24', 'Reprimand', 'Found guilty. Reprimanded.', 'Commanding Officer', NULL, 'NAVPERS01', 'HICO001', '2026-03-25 09:00:00'
    UNION ALL SELECT 'DC-2026-0002', 'B0588', 'Absence without leave', '2026-06-03', '2026-06-04 09:00:00', 'Overstayed leave by three days without a signal.', 'Lt Cdr A. Eze (Divisional Officer)', 'concluded', '2026-06-19', 'Stoppage of leave', 'Found guilty. Leave stopped for 14 days.', 'Executive Officer', NULL, 'NAVPERS02', 'NAVPERS01', '2026-06-19 15:00:00'
    UNION ALL SELECT 'DC-2026-0003', 'B0562', 'Conduct prejudicial to good order', '2026-08-14', '2026-08-15 09:00:00', 'Took part in a quarrel in the mess that disturbed the watch below.', 'Lt Cdr I. Danladi (Executive Officer)', 'concluded', '2026-09-02', 'Reprimand', 'Found guilty. Reprimanded, entered on the service record.', 'Commanding Officer', NULL, 'NAVPERS01', 'HICO001', '2026-09-03 09:00:00'
    UNION ALL SELECT 'DC-2026-0004', 'B0559F', 'Absence without leave', '2026-09-08', '2026-09-09 09:00:00', 'Reported absent at muster; found to be on an approved course.', 'Lt Cdr A. Eze (Divisional Officer)', 'cancelled', NULL, NULL, NULL, NULL, 'The rating was on an approved course; there was no absence.', 'NAVPERS01', 'HICO001', '2026-09-10 08:30:00'
    UNION ALL SELECT 'DC-2026-0005', 'B0601F', 'Loss of service property', '2026-10-19', '2026-10-21 09:00:00', 'Lost a ship-issue night-vision monocular during the shore patrol.', 'PO B. Bello (Duty Petty Officer)', 'pending', NULL, NULL, NULL, NULL, NULL, 'NAVPERS01', NULL, NULL
    UNION ALL SELECT 'DC-2026-0006', 'B0627', 'Absence without leave', '2026-10-27', '2026-10-28 09:00:00', 'Absent from the ship from 0800 on 26/10/2026 until 1730 on 27/10/2026 without leave.', 'Lt Cdr A. Eze (Divisional Officer)', 'pending', NULL, NULL, NULL, NULL, NULL, 'NAVPERS01', NULL, NULL
    UNION ALL SELECT 'DC-2026-0007', 'B0539', 'Negligent performance of duty', '2026-11-02', '2026-11-03 09:00:00', 'Left the engine room switchboard unattended during the evening watch.', 'CPO S. Ogunleye (Coxswain)', 'pending', NULL, NULL, NULL, NULL, NULL, 'NAVPERS02', NULL, NULL
    UNION ALL SELECT 'DC-2026-0008', 'B0541', 'Sleeping on watch', '2026-11-04', '2026-11-05 09:00:00', 'Opened against the wrong rating.', 'Lt O. Adeyemi (Officer of the Watch)', 'cancelled', NULL, NULL, NULL, NULL, 'Opened against the wrong rating; refiled under the correct Official No.', 'NAVPERS01', 'NAVPERS01', '2026-11-06 08:00:00'
    UNION ALL SELECT 'DC-2026-0009', 'B0614', 'Insubordination', '2026-11-09', '2026-11-10 09:00:00', 'Refused a lawful order from the Divisional Officer during Colours.', 'Lt Cdr A. Eze (Divisional Officer)', 'pending', NULL, NULL, NULL, NULL, NULL, 'NAVPERS01', NULL, NULL
    UNION ALL SELECT 'DC-2026-0010', 'B0588', 'Drunkenness on duty', '2026-11-12', '2026-11-13 09:00:00', 'Reported for the forenoon watch under the influence of alcohol.', 'Lt O. Adeyemi (Officer of the Watch)', 'pending', NULL, NULL, NULL, NULL, NULL, 'NAVPERS01', NULL, NULL
    UNION ALL SELECT 'DC-2026-0011', 'B0640', 'Sleeping on watch', '2026-11-14', '2026-11-15 09:00:00', 'Found asleep at the gangway by the Officer of the Watch at 0215.', 'Lt O. Adeyemi (Officer of the Watch)', 'pending', NULL, NULL, NULL, NULL, NULL, 'NAVPERS02', NULL, NULL
  ) v
  JOIN ratings r ON r.service_number = v.sn
 WHERE NOT EXISTS (SELECT 1 FROM discipline_cases c WHERE c.case_number = v.no);

-- one concluded case that was corrected afterwards, with its reason on the record
INSERT INTO discipline_case_corrections (case_id, corrected_by, corrected_at, reason, changes)
SELECT c.id, (SELECT id FROM users WHERE username = 'HICO001'), '2026-09-21 10:00:00',
       'The Commanding Officer awarded a reprimand, not a severe reprimand (signal ref NNS/CO/0912).',
       JSON_ARRAY(
         JSON_ARRAY('Sanction', 'Severe reprimand', 'Reprimand'),
         JSON_ARRAY('Decision', 'Found guilty. Severe reprimand, entered on the service record.', 'Found guilty. Reprimanded, entered on the service record.'))
  FROM discipline_cases c
 WHERE c.case_number = 'DC-2026-0003'
   AND NOT EXISTS (SELECT 1 FROM discipline_case_corrections k WHERE k.case_id = c.id);
