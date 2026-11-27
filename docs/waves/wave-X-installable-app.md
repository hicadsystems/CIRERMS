# Wave X: CIRERMS as an installable app

The owner (27/11/2026): "Can we build a downloadable SPA for this?" They chose an **installable web app** (a PWA).
Chrome and Edge on desktop and on phones offer to install CIRERMS. It then opens in its own window with the crest as
its icon, from the Start menu, the desktop or the home screen. It starts fast and updates itself with the server.
There is no app store and no installer file. It still talks to the CIRERMS server for everything: no record is kept
on the device.

Read `docs/waves/README.md` first: its rules bind you.

## X1 `installable-app`

- **Branch:** `installable-app` · **Needs merged first:** everything on master · **AI session:** Sonnet 5.5, effort
  medium · **Size:** S · **Migration block:** none · **Seed:** none

### Read first
- `README.md` and `CONVENTIONS.md` (Frontend, the Content Security Policy, the theme tokens).
- `public/index.html` and `public/app.html`, `public/js/core/theme-boot.js` and `theme.js`.
- `src/app.js` (or wherever helmet and static files are set up: headers, caching, the CSP).
- `public/js/shell/session.js` (`accountItems`, the account menu).
- The crest image the app already uses.
- `docs/manual/getting-started.md`.

### Build
1. **The manifest**, `public/manifest.webmanifest`, linked from both pages:
   - name **CIRERMS**, short name **CIRERMS**, a description;
   - `start_url` `/app.html`, `scope` `/`, display `standalone`;
   - icons made from the crest: 192 and 512 px, plus a maskable 512 px with the crest inside the safe zone on the
     brand colour, and an Apple touch icon.

   `theme_color` and `background_color` take the brand and page token values. A manifest cannot read CSS variables,
   so these two colours are the one allowed exception to "no hex in the app": write a comment saying they mirror the
   tokens. Add `<meta name="theme-color">` for light and dark (two metas with `media`), from the tokens too. Generate
   the icons with a small script kept in `scripts/` (sharp or Playwright, whichever is already available; no new heavy
   dependency), and commit the PNGs.
2. **The service worker**, `public/sw.js`, registered from both pages (no inline script: register from an existing
   module):
   - It caches **only the app's own static files** (the two HTML pages, `public/js/**`, the CSS, the icon sprite,
     fonts, images, the manifest), versioned so a new deployment replaces the old cache. The version comes from
     `package.json` or a build stamp the server writes.
   - It **never caches `/api/` answers, PDFs, uploads, documents or photos.** They hold personal data and always
     go to the network.
   - Network first for the HTML pages; cache first for versioned static files.
   - When the network is down, a page request shows `public/offline.html`, in the house style with the crest: "CIRERMS
     needs a connection to the server. Check your network and try again." It has a **Try Again** button, works in
     light and dark, and uses no inline script.
   - **Sign out and the lock screen stay as they are.** Nothing personal is stored, so nothing needs clearing.
3. **Updates.** When a new service worker is waiting, show a toast or a quiet banner: "A new version of CIRERMS is
   ready." with **Reload**. Pressing it activates the new worker and reloads. Never reload by itself while someone
   is typing.
4. **Install CIRERMS.** In the account menu (desktop and phone), just before User Guide, show **Install App** (icon
   `download` or `monitor-down`, from the sprite) only when the browser offers installation (`beforeinstallprompt`),
   and hide it once the app is installed or running standalone. On iPhone and iPad, which have no prompt, the user
   guide explains Share > Add to Home Screen.
5. **The server.**
   - Serve `manifest.webmanifest` with `application/manifest+json`.
   - Serve `sw.js` with `Cache-Control: no-cache` and `Service-Worker-Allowed: /` if needed.
   - Allow `manifest-src 'self'` and `worker-src 'self'` in the CSP.
   - Keep every other header as it is.
   - Installing needs HTTPS, except on localhost. Say so in README and in `docs/runbooks/deployment.md` (one line
     each).
6. **The user guide:**
   - Getting Started gets a section **Installing CIRERMS** with three tasks: on a computer (Chrome or Edge: the
     install icon in the address bar, or Install App in the account menu), on an Android phone, and on an iPhone or
     iPad (Share > Add to Home Screen). It also explains what the update banner means.
   - Add one picture, the account menu with Install App, if the script can show it. Headless Chromium may not fire
     the install prompt. If it cannot, say so and leave the picture out.
   - Run `npm run guide:check`.
7. **Docs:** a short part in `README.md` and `CONVENTIONS.md`: what is cached and what never is, and how the version
   moves.
8. **A small walkthrough**, `tests/e2e/installable-walkthrough.js`, under 5 minutes, checking:
   - the manifest's fields and icons load;
   - the service worker registers and controls the page;
   - an `/api/` request is never answered from the cache (check after a sign-in);
   - with the network cut (Playwright `context.setOffline(true)`), a page load shows the offline page;
   - a new version brings the update banner;
   - no browser errors at 1440 and 390.

   While you are in `tests/e2e/`, also fix the demo walkthrough: it expects every page to open a dialog, and the User
   Guide and Settings pages do not. Make those two pages exceptions, and it passes again.

### Added 27/11/2026 (owner)
The account menu is restyled like the owner's mycity-app account menu, in three groups separated by dividers: (View My Details, Change Password, Lock Screen), (Light Mode or Dark Mode, User Guide, **Download App**), (Sign Out, in the neutral colour). "Download App" is item 4's Install App, renamed. Only the account menu changes; other menus keep their look.

### Check
On a fresh database:
- the installable walkthrough, the demo walkthrough and the access walkthrough;
- the offline page and the update banner, at 1440 light and 390 dark;
- the icons at their sizes.

Run a Lighthouse PWA check if available. Note that the headless browser cannot complete a real install.

### Report
One `send_message` to the administrator session, then stop.
