# Copy/Paste Ratings Flow Example

This example tests the existing Ratings module from the API to the browser. It does not create, edit, upload, or delete rating data.

## Files

| File | Purpose | Run it with |
|---|---|---|
| `ratings-api-smoke.js` | Test health, login, list, dossier, documents, and batch template API contracts | Node.js |
| `ratings-browser-smoke.js` | Test rendered Ratings routes and their same-origin API requests | Browser DevTools console |

These are diagnostic examples. The production implementation remains in the source files listed below.

## Prepare the app

Start the app and database with demo data:

```powershell
docker compose up -d --build
```

Or, when running Node/MySQL locally:

```powershell
npm run migrate:up
npm run seed
npm start
```

Check:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Expected:

```json
{
  "data": {
    "status": "ok",
    "database": "connected"
  }
}
```

## Test backend APIs

Set credentials in the current PowerShell session and run the script:

```powershell
$env:CIRERMS_TEST_USERNAME = "HICO001"
$env:CIRERMS_TEST_PASSWORD = "Admin@123"
node docs/examples/ratings-flow/ratings-api-smoke.js
```

The script signs in and reads the list, one record, its documents, and the batch-upload template. It prints a PASS line for each contract and never prints the session token or password.

Expected output resembles:

```text
PASS health: HTTP 200
PASS login: HTTP 200
PASS current ratings list: HTTP 200, 25 max rows
PASS rating dossier <service number>: HTTP 200
PASS documents for <service number>: HTTP 200
PASS batch template: HTTP 200, xlsx bytes received
Ratings API smoke test passed.
```

## Test browser screens

1. Sign in as an administrator in `http://localhost:3000`.
2. Open the application page at `/app`.
3. Open browser Developer Tools → Console.
4. Open `ratings-browser-smoke.js` in an editor, copy its entire contents, and paste into the console.
5. Press Enter. The script changes the current hash through Ratings pages and restores it when complete.

It checks Current Ratings, Former Ratings, a real rating record, Batch Upload, and Documents without saving data.

## Source files to read alongside the example

| Concern | Existing source file |
|---|---|
| API mount and screen privileges | `src/modules/ratings/ratings.module.js` |
| Authentication, guards, and HTTP contracts | `src/modules/ratings/ratings.routes.js` |
| Validation and business rules | `src/modules/ratings/ratings.service.js` |
| SQL | `src/modules/ratings/ratings.repo.js` |
| Screen and privilege catalogue | `public/js/core/nav.js` |
| Current/Former list | `public/js/sections/ratings-list.js` |
| Rating record | `public/js/sections/rating-record.js` |
| Batch upload | `public/js/sections/ratings-upload.js` |
| Documents | `public/js/sections/ratings-documents.js` |

## Follow the backend-to-frontend path

```text
src/modules/ratings/ratings.module.js
     | declares /api/ratings and screen privileges
     v
src/modules/ratings/ratings.routes.js
     | validates auth/privileges; calls service
     v
src/modules/ratings/ratings.service.js
     | validates query and business rules
     v
src/modules/ratings/ratings.repo.js
     | parameterised SQL
     v
MySQL
     |
     v
public/js/core/nav.js
     | matches URL hash, screen ID, and mount function
     v
public/js/sections/ratings-list.js (or another page module)
     | uses public/js/core/api.js and shared UI
     v
Browser DOM
```

## Troubleshooting

| Result | Check |
|---|---|
| Health is not 200 | `docker compose ps`, DB logs, and `DB_*` settings |
| Login is 401 | Demo seed data and username/password; do not repeat guesses rapidly |
| List is 403 | The test account's role must have `ratings.list:view` |
| Dossier is 403 | The test account's role must have `ratings.edit:view` |
| Documents is 403 | The test account's role must have `ratings.documents:view` |
| Batch template is 403 | The test account's role must have `ratings.upload:view` |
| Browser page is blank | Browser console, route in `nav.js`, section import/mount |
| Browser screen renders but API fails | Network panel, route guard, server log, migration status |

Use the administrator demo account for this full smoke test. Do not copy demo credentials into a production environment.
