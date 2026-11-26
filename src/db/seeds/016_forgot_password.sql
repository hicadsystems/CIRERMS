-- Forgot Password (K2): demo accounts with an e-mail address, so the e-mailed code can be tried.
-- Every address is on the invented domain cirerms.example (nothing is delivered to it). Without a mail
-- server, development writes the message to storage/mail/ instead of sending it.
--   HICO001 and B0539 are active; B0562 is inactive (a code is never sent to it); the other demo accounts
--   with no address (for example B0575) show the same answer as an unknown Official Number.
-- Earlier seeds gave some accounts an address on a real domain: those move to the invented one, so a
-- deployment that has a mail server never sends a demo code to a real mailbox.
UPDATE users SET email = REPLACE(email, '@navy.mil.ng', '@cirerms.example') WHERE email LIKE '%@navy.mil.ng';
UPDATE users SET email = 'hico001@cirerms.example' WHERE username = 'HICO001' AND (email IS NULL OR email = '');
UPDATE users SET email = 'b0539@cirerms.example'   WHERE username = 'B0539'   AND (email IS NULL OR email = '');
UPDATE users SET email = 'b0562@cirerms.example'   WHERE username = 'B0562'   AND (email IS NULL OR email = '');
