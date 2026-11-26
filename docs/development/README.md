# Developer Onboarding

This guide is for engineers working on the CIRERMS Node.js/MySQL application.

## Start here

1. Read [Local setup](setup.md) and get the application running.
2. Learn the request and module flow in [Architecture](architecture.md).
3. Follow [Creating and Maintaining Modules](modules.md) end to end once. It builds a small feature from the database to the screen, and is the fastest way to learn how everything fits.
4. Read [Frontend setup and maintenance](frontend.md) to see how screens are served (there are only two HTML files) and when CSS and icons must be rebuilt.
5. Follow [Database and migrations](database.md) for schema work.
6. Use [Testing](testing.md) before submitting or merging work.
7. Follow [CONVENTIONS.md](../../CONVENTIONS.md) for binding project rules.

When something breaks, go to [Troubleshooting](../runbooks/incident-troubleshooting.md). When you maintain a running system, see the [runbooks](../runbooks/README.md).

## Project in one minute

CIRERMS is a browser-based personnel management system with a vanilla JavaScript SPA in `public/` and an Express 4 API in `src/`. MySQL 8 stores application data. The server serves both the browser files and `/api/*` routes.

The application uses:

- Node.js `>=20` (the Docker runtime is Node.js 20)
- Express 4
- CommonJS JavaScript on the server
- Vanilla JavaScript ES modules in the browser
- Tailwind CSS v3 with a precompiled stylesheet
- MySQL 8 or compatible MariaDB
- `mysql2/promise` with parameterised SQL
- JWT authentication in an HttpOnly session cookie
- Role and action privileges
- Handlebars and Chromium for PDF printouts
- Playwright for end-to-end walk-throughs (not an npm dependency)

## Main locations

| Area | Location |
|---|---|
| Express entry point | `src/server.js` |
| Express middleware and static serving | `src/app.js` |
| Configuration | `src/config/index.js` |
| Database pool and transactions | `src/db/index.js` |
| Module loader (finds every `<module>/<module>.module.js` by itself; nothing to edit) | `src/modules/index.js` |
| Feature modules | `src/modules/<module>/` |
| Shared server helpers | `src/shared/` |
| Browser shell and navigation | `public/js/core/`, `public/js/shell/` |
| Browser screens | `public/js/sections/` |
| Reusable browser components | `public/js/ui/` |
| Static assets and compiled CSS | `public/` |
| SQL migrations | `src/db/migrations/` |
| Idempotent seed data | `src/db/seeds/` |
| Printout templates | `src/templates/printouts/` |
| End-to-end tests | `tests/e2e/` |

## Two things that surprise new engineers

- **Screens are not HTML files.** `public/` holds only `index.html` (sign-in) and `app.html` (the shell). Each screen is a JavaScript file in `public/js/sections/` that draws itself, chosen by `public/js/core/nav.js`. See [Frontend](frontend.md#how-screens-are-served).
- **Modules register themselves.** Adding a folder `src/modules/<name>/` with a `<name>.module.js` is enough. The same screen ID must appear in the module's manifest, its route guards, and `nav.js`. See [Creating and Maintaining Modules](modules.md).
