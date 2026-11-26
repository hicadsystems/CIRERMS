# Frontend Setup and Maintenance

The CIRERMS browser application is a zero-framework SPA built with HTML5, Tailwind CSS, and vanilla JavaScript ES modules. It does not use React, Vue, Vite, or a bundler.

## Frontend layout

| Area | Location | Responsibility |
|---|---|---|
| Sign-in page | `public/index.html`, `public/js/sections/auth.js` | Login form, *Forgot password?* (the e-mailed-code reset, in place on the card) and the animated sign-in environment. It shows no demo accounts |
| Application shell | `public/app.html` | Rail, top bar, tabs, phone navigation, and page outlet |
| Navigation and routes | `public/js/core/nav.js` | Modules, tabs, pages, screen IDs, and page view mappings |
| Hash router | `public/js/core/router.js` | Browser hash routes and page cleanup |
| API client | `public/js/core/api.js` | JSON, form data, downloads, session errors, and Bearer fallback |
| Access client | `public/js/core/access.js` | UI privilege checks |
| Application entry | `public/js/sections/app-shell.js` | Session setup, shell, routing, lock, and password change |
| Screen modules | `public/js/sections/` | One mount function per application page |
| Shell modules | `public/js/shell/` | Rail, tabs, search, phone UI, lock, and session |
| Reusable UI | `public/js/ui/` | Buttons, cards, dialogs, fields, tables, facts, and other components |
| Tailwind input | `public/css/input.css` | Design tokens and generated CSS source |
| Compiled CSS | `public/css/output.css` | Browser stylesheet committed to the repository |
| Icons | `public/assets/icons.svg` | Generated Lucide icon sprite |
| Icon build source | `scripts/build-icons.js` | Name list for the icon sprite |
| Design reference | `docs/design/README.md`, `docs/design/demo.html` | Approved layouts and visual behaviour |

## How screens are served

There are only two HTML files in `public/`, and that is by design. **A screen is not an HTML file.** It is a JavaScript function that builds its own HTML and draws it into the application shell.

```text
/login  ->  public/index.html     the sign-in page
/app    ->  public/app.html       the shell: rail, header, tabs and an empty #app-main
                |
                |  loads js/sections/app-shell.js, which signs the person in and starts the router
                v
#ratings/current   (the part after "#" is the route)
                |
js/core/router.js  matches the route against PAGES in js/core/nav.js
                |
                |  PAGES entry: { pattern, screen, view: { file, mount } }
                v
js/sections/ratings-list.js   is imported on demand; its exported mount function
                              builds the screen and draws it into #app-main
```

In steps:

1. `src/app.js` serves everything in `public/` as static files. `GET /login` returns `index.html` and `GET /app` returns `app.html`. All data comes from `/api/*`.
2. After sign-in the shell loads, and the router reads the hash (`#notices/board`).
3. The router finds the matching entry in `PAGES` (`public/js/core/nav.js`). If the person lacks the entry's `screen` privilege it shows "You Do Not Have Access to This Page". If no entry matches, it redirects to `#dashboard`.
4. Otherwise it imports `view.file` from `public/js/sections/`, calls the function named by `view.mount` with an empty outlet element, and the screen draws itself.
5. When the person leaves the page, the router calls the cleanup function the mount returned, if any.

So adding a screen means one entry in `nav.js` and one file in `public/js/sections/`. No HTML file, no router change. The full walk-through is in [Creating and Maintaining Modules](modules.md).

## Local setup

The frontend is served by Express from `public/`.

Start the application:

```bash
npm start
```

Open:

```text
http://localhost:3000/
http://localhost:3000/app
```

No frontend dependency installation or bundling step is required for normal runtime. Source changes are loaded directly as browser ES modules.

In development, static files are served with no caching, so a normal reload picks up JavaScript changes (use a hard reload, `Ctrl+Shift+R`, if in doubt). Changing only the part after `#` in the address does **not** reload the page.

With Docker the story is different: the image copies `public/` and `src/` when it is built, and the container does not read your working folder. After a frontend or backend change run `docker compose up --build`.

## Tailwind CSS

Source tokens and theme rules live in `public/css/input.css`. Tailwind class discovery is configured in `tailwind.config.js`.

Rebuild CSS after changing Tailwind classes or theme configuration:

```bash
npm run css:build
```

For continuous rebuilds during frontend development:

```bash
npm run css:watch
```

Commit both source changes and `public/css/output.css`.

Follow [CONVENTIONS.md](../../CONVENTIONS.md): use theme classes and tokens, not raw hex colours or white utility classes.

## Icons

Icons are served from the generated `public/assets/icons.svg` sprite. Only the icons listed in `scripts/build-icons.js` are in it. **An icon that is not in the sprite draws as a blank box and produces no error.**

### Adding an icon

1. Add the Lucide icon name to `ICONS` in `scripts/build-icons.js`.
2. Run:

   ```bash
   npm run icons:build
   ```

3. Commit `public/assets/icons.svg`.

Use the icon helper or sprite in browser code:

```js
import { icon } from '../core/icons.js';

icon('search');
```

Or in static HTML:

```html
<svg class="icon" aria-hidden="true">
  <use href="/assets/icons.svg#search"></use>
</svg>
```

## Build steps

Two files in `public/` are generated and committed. Nothing rebuilds them for you, and neither fails loudly when it is out of date.

| You changed | Run | If you forget |
|---|---|---|
| Used a Tailwind class no other screen uses (or edited `input.css` or `tailwind.config.js`) | `npm run css:build` | The class has no effect; the element looks unstyled |
| Used an icon that is not yet in the sprite | add its name to `ICONS` in `scripts/build-icons.js`, then `npm run icons:build` | A blank box where the icon should be |
| Edited only `.js` files under `public/js/` | nothing | n/a |
| Edited `docs/design/demo-src.html` | `npm run demo:build` | The design demo is out of date |

Tailwind only generates the classes it finds in the files listed in `content` in `tailwind.config.js`, so a class must appear as a whole word in a scanned file. Do not build class names by joining strings (`'bg-' + colour`); write the full class.

Commit the regenerated `public/css/output.css` and `public/assets/icons.svg` with your change. `npm run icons:build` needs the `lucide-static` development dependency, so run `npm install` first if it is missing.

## Navigation and routes

All application routes use hash URLs such as `#ratings/current`.

To add or maintain a screen:

1. Add a module tab or page entry in `public/js/core/nav.js`.
2. Give the page a stable `screen` ID matching the server privilege screen.
3. Map the page to a section file and mount function with `view`.
4. Add the implementation under `public/js/sections/`.
5. Return a cleanup function from the mount function when listeners or timers need disposal.
6. Check both desktop and phone layouts.
7. Check light and dark themes.

The router in `public/js/core/router.js`:

- resolves hash routes
- removes the previous page cleanup
- shows a loading state
- prevents stale mounts from drawing after navigation

The application shell's route activation in `public/js/sections/app-shell.js` redraws navigation, closes dialogs and menus, and closes the search palette when a page changes.

Page files should not manage hash routing directly. Use the shared `navigate()` helper in `public/js/core/router.js`.

## Shared UI components

Reusable components live in `public/js/ui/`. Use existing components before creating a similar dialog, field, table, card, or action row.

Important components include:

- `page-header.js`
- `button.js`
- `card.js`
- `dialog.js`
- `field.js`
- `facts.js`
- `rating-search.js`
- `toast.js`
- `table.js`
- `pill.js`

The component catalogue and signatures are documented in [components.md](../design/components.md).

On a page or dialog:

- use text nodes or DOM nodes for dynamic content, not raw HTML
- use `setFieldErrors()` for API field errors
- use `openDialog()` on desktop and `openDialog()` automatically renders a bottom sheet on a phone
- use a 44 px minimum touch target on phones
- avoid horizontal table scrolling

## API calls

Use `public/js/core/api.js` rather than direct `fetch()` calls:

```js
import { api, downloadFile } from '../core/api.js';   // api.downloadFile is the same function

const result = await api.get('/api/example');
await api.post('/api/example', payload);
await api.put('/api/example/1', payload);
await api.del('/api/example/1');
await api.upload('/api/example/upload', formData);
await downloadFile('/api/example/export');
```

Handle API errors through `ApiClientError`. Its fields include `status`, `code`, `message`, and `fields`.

Do not place authentication tokens in application JavaScript; the normal authentication mechanism is the HttpOnly cookie. The API client supports a session fallback token for embedded/browser restrictions.

## Privileges in the UI

Use `public/js/core/access.js` to hide actions and navigation that the signed-in role may not use:

```js
import { can } from '../core/access.js';

if (can('example.list', 'add')) {
  // add button
}
```

UI checks improve usability but are not authorization. Every server route must independently declare and enforce the matching privilege.

## Responsive and theme rules

The layout breakpoints are:

- phone: 760 px and below
- desktop: 761 px and above
- wide: 1280 px and above

The theme follows the device until the user chooses light or dark mode.

Maintenance checks:

- verify desktop at 1440 px
- verify phone at 390 px
- verify light and dark themes
- ensure tables do not scroll sideways
- ensure labels and values do not break inside words
- ensure dialogs become bottom sheets on phones
- ensure page actions remain reachable
- ensure the session lock and expired-session behaviour still work

## HTML and CSP

Do not add inline `<script>` blocks or `on*` attributes in application HTML. `src/app.js` enables a strict Content Security Policy that allows only self-hosted scripts and styles.

JavaScript event bindings should be registered through DOM APIs or shared component callbacks.

## Design demo

The approved design reference is `docs/design/demo.html`.

Rebuild it from its source:

```bash
npm run demo:build
```

Use [docs/design/README.md](../design/README.md) and [docs/design/components.md](../design/components.md) before inventing a new visual pattern.

## Frontend maintenance checklist

Before completing a frontend change:

1. Add or update the navigation entry and screen ID.
2. Add privilege checks in both the UI and server route.
3. Reuse components and theme tokens.
4. Rebuild CSS if Tailwind inputs changed.
5. Rebuild icons if icon names changed.
6. Test JSON success and refusal responses.
7. Test 401, 403, and 423 session states where relevant.
8. Test desktop and phone layouts.
9. Test light and dark themes.
10. Run the relevant end-to-end walk-through.

## Worked example

[Creating and Maintaining Modules](modules.md) builds a complete screen (the Notice Board) from the database to the browser, with the section file, the `nav.js` entries, the list, the form dialog, validation messages, a delete confirmation and privilege-aware buttons, and a console script that checks the screen.

For real screens to read, start small:

| Screen | File | Shows |
|---|---|---|
| Audit Trail | `public/js/sections/admin-audit.js` | A filtered, paged list |
| Static tables | `public/js/sections/static-table.js` | A reusable add, edit and delete table |
| Manage Roles | `public/js/sections/admin-roles.js` | A form-heavy screen with privileges |

## When something looks wrong

See [Troubleshooting](../runbooks/incident-troubleshooting.md#the-screen-misbehaves). It lists each frontend symptom with its cause: a blank page, "Unable to Load This Page", an empty list, an unstyled element, a blank icon, a page that will not update.
