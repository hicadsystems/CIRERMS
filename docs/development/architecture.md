# Architecture

## Runtime flow

```text
Browser
  public/index.html or public/app.html
  public/js/core/api.js
           |
           v
Express /api routes
  middleware/auth.js
  middleware/access.js
  module routes
           |
           v
Module service
  validation and business rules
           |
           v
Module repository
  parameterised MySQL queries
           |
           v
MySQL 8
```

## Server entry points

- `src/server.js` verifies database connectivity, synchronises the privilege catalogue, starts HTTP listening, starts scheduled changes, and handles graceful shutdown.
- `src/app.js` applies security middleware, mounts modules, probes `/api/health`, serves static browser assets, and supplies 404/error handlers.
- `src/config/index.js` loads `.env` and exposes a frozen configuration object.

## Module structure

Each feature is a folder in `src/modules/`. The server **finds modules by itself** at start-up: any folder containing `<folder>/<folder>.module.js` is mounted. There is no list to edit, and a manifest that is not named after its folder is silently ignored. The step-by-step build is in [Creating and Maintaining Modules](modules.md).

Each feature module follows module-first organisation:

```text
src/modules/<module>/
  <module>.module.js
  <module>.routes.js
  <module>.service.js
  <module>.repo.js
  additional helper files
```

Layer responsibilities:

| Layer | Responsibility | Must not contain |
|---|---|---|
| Routes | HTTP parsing, privileges, file middleware, response shape | SQL or business decisions |
| Services | Validation, workflow rules, transactions, audit decisions | Direct `req`/`res` handling |
| Repositories | Parameterised SQL and data mapping | Business policy |

Use `asyncHandler` for route promises. Services throw `AppError` types from `src/shared/errors.js`; `src/middleware/error.js` maps them to API responses.

## Database access

Use `src/db/index.js`:

- `db.query(sql, params, conn)` for a parameterised statement
- `db.transaction(callback)` for multiple writes that must commit or roll back together
- `db.ping()` for database readiness

Never build SQL from unvalidated input. Only validated identifiers or sort fields may leave allowlists.

## Authentication and access

The browser sends an HttpOnly cookie or, when supported, a Bearer token. `requireAuth` resolves the session, user, role, privileges, lock state, and password-change state on every request.

Privileges use a `screen:action` key, such as `notices.board:add`. Screen IDs are declared in each module's manifest and must be spelt identically in the route guards and in `public/js/core/nav.js`. Actions are `view`, `add`, `edit`, `delete`, and `approve`. The privilege catalogue is rebuilt from the manifests whenever the server starts; it only ever adds entries, so retired privileges must be deleted by a migration.

A module route must declare a privilege guard unless the module manifest marks it public. Module loading rejects unguarded routes.

## Frontend structure

- `public/app.html` is the application shell.
- `public/js/core/nav.js` is the navigation and screen catalogue.
- `public/js/sections/app-shell.js` selects and mounts screen modules.
- `public/js/core/api.js` is the shared request client.
- `public/js/ui/` contains reusable components.
- `public/js/shell/` contains shell, search, lock, and session UI.

A screen is a JavaScript file, not an HTML page. New screens are registered in the navigation catalogue (`AREAS` for the menu, `PAGES` for routes) and mapped to their privilege screen ID. See [Frontend](frontend.md#how-screens-are-served).

## Shared operations

Cross-cutting helpers live outside feature modules:

- audit trail
- dates
- password policy
- Excel generation
- printout rendering
- upload validation
- scheduled changes
- application settings

## Responses and errors

Every API answers in one envelope:

```json
{ "data": {}, "meta": { "page": 1, "pageSize": 25, "total": 0, "totalPages": 1 } }
{ "error": { "code": "VALIDATION_ERROR", "message": "Check the notice and try again.", "fields": { "title": "Enter a title." } } }
```

`meta` appears on paged lists; `fields` appears on validation errors. The error codes and their statuses are listed in [Creating and Maintaining Modules](modules.md#9-reference). The messages a person sees on screen come from the server, so the service writes them for people.
