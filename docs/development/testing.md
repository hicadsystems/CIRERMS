# Testing

## Available test type

CIRERMS currently uses Playwright end-to-end walk-through scripts in `tests/e2e/`. They are not npm dependencies; the scripts assume Playwright is installed in the machine environment.

## Standard test setup

Start from a disposable database:

```bash
npm run migrate:fresh
npm run seed
npm start
```

Run a walk-through:

```bash
NODE_PATH=$(npm root -g) node tests/e2e/<walkthrough>.js
```

Some tests start their own server or expect particular environment variables. Read the header of the selected test before running it.

## Testing a module you built

Test in this order, so a failure tells you which layer is wrong:

1. **The API alone.** Run a small Node script that signs in and exercises every route: success, validation refusal (422), not found (404), no session (401) and, for a limited role, 403. [Creating and Maintaining Modules](modules.md#4-check-the-backend) gives a complete one for the Notice Board that you can copy and adapt. It needs only Node 20, and works on Windows, macOS and Linux.
2. **The audit trail.** Confirm each write left an `INSERT`, `UPDATE` or `DELETE` row for the right table and record.
3. **The screen.** Open it, and use the checklist and the console script in [Check the screen](modules.md#6-check-the-screen).
4. **Each role.** Sign in as a role with full, partial and no access, and confirm buttons and refusals match.

Write test data to a disposable database and have the script clean up what it creates. A script that writes should refuse to run against anything but a local address.

## Minimum validation

For every change, run the smallest relevant check:

- migration status
- relevant module migration/seed
- relevant walk-through
- desktop and phone layout checks
- light and dark theme checks
- success and refusal cases
- privilege checks
- audit trail checks

For broad application changes, run:

```bash
NODE_PATH=$(npm root -g) node tests/e2e/demo-walkthrough.js
```

## Test database safety

Several walk-throughs mutate demo data or add throw-away users and roles. Always use a fresh disposable database unless the test documents safe reuse.

Do not run migration-fresh or destructive walk-through setup against production.
