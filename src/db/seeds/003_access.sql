-- Roles and their privileges (WP1). The privilege catalogue itself comes from each module's
-- manifest (src/modules/<module>/<module>.module.js) and is synced before the seed files run;
-- the Administrator role (full_access) is given every privilege by that sync.
-- Rating: View My Details only, as in the old system (docs/legacy/system-admin.md 3.4).
INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id
  FROM roles r
  JOIN privileges p ON p.screen = 'ratings.my-details' AND p.action = 'view'
 WHERE r.name = 'Rating';
