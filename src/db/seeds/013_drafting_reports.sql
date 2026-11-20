-- Drafting reports (WP7b): Batch/Signal Content, Rate DOD History and Draft Report are read-only pages.
-- The old system gave them to the System Administration role only; here both drafting roles may read them
-- (the Administrator has every privilege already). Reports never write, so view is the only action.
INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id
  FROM roles r
  JOIN privileges p ON (p.screen, p.action) IN (('drafting.batches', 'view'), ('drafting.history', 'view'), ('drafting.report', 'view'))
 WHERE r.name IN ('Drafting', 'Drafting Approver');
