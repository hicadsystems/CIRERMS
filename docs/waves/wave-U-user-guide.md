# Wave U: the User Guide

> **G1 and G2 done and merged (26/11/2026); G3 added at the owner's request the same day.** It stays here as the record of how it was briefed; `docs/PLAN.md` section 8 says what was built.

The owner (26/11/2026): a user guide inside the app, made the way the `praxisjbs/mycity-app` application makes
theirs. It is reached from a **User Guide** item in the account menu, just before Sign Out. On a desktop, **Ctrl+H**
opens it in a mini panel from the right. The User Guide page also has a **Download** that gives the same guide as a
**PDF book**. The owner: "No need for testing or walkthrough, just ensure the screenshots are well captured and
everything is done as required."

Two packages, one after the other: **G1** builds the guide's machinery and its first chapter, and **G2** writes
every other chapter with its screenshots. G2 starts only once G1 is merged.

Read `docs/waves/README.md` first. Its rules and report note are binding. Its section 3 (checks) is replaced
here: the owner asked for **no tests and no walkthroughs** for this wave, so none are written or run. You still run
the app and look at every screen and every page of the PDF yourself.

## The owner's decisions for the guide (26/11/2026)

1. **Each reader receives only their part.** The guide, the Ctrl+H panel, the search and the PDF book are cut, on
   the server, to the reader's own privileges. A section about a screen goes only to someone who may open that
   screen. A task or step that needs an action goes only to someone who holds it. A Records Clerk never reads Manage
   Roles. The Administrator receives everything.
2. **Every picture is taken four times**: desktop light, desktop dark, phone light and phone dark. The page and the
   panel show the one for the reader's device and theme, and switch when the theme switches. The PDF book uses the
   desktop light pictures only. The script takes all four, and fast.
3. **Two packages, Sonnet 5.5**: G1 at high effort, then G2 at medium.
4. **No tests or walkthroughs.** The session and the administrator check by running the app and looking.

## How mycity-app does it (study it before you start)

The reference is public and is read only. Clone it outside the CIRERMS working copy:
`git clone --depth 1 https://github.com/praxisjbs/mycity-app /home/user/ref/mycity-app`. Read these files:

- `docs/manual/README.md`: how a chapter is written (front matter, sections, tasks, steps, bold names, links, notes,
  pictures and their `shot` specs).
- `docs/guides/user-guide.md`, sections 1 to 6.7: the design (what a reader receives, the pictures, the way back
  to a step, the gate). Leave out what CIRERMS does not take: the Quick Start, the meaning search, the written answers,
  voice, the public Help, the Procedures and the CI gate.
- `scripts/guide/shoot.js` and `scripts/guide/lib.js`: the screenshot script. Note how it signs in, fixes the
  clock, hides toasts and notices, does a spec's steps, draws the numbered marks, crops to a dialog, and keeps
  hashes in `shots.json`.
- `packages/contract/guide.js`: the chapter parser and the reader's cut (`filterChapter`).
- `packages/ui/src/documents/GuideBody.tsx` and `app/src/features/knowledge/UserGuide.tsx`: how a chapter is
  drawn.
- `docs/manual/people.md` and one picture in `docs/manual/img/people/`: a finished chapter.
- `docs/manual/performance-guide/build.js`: their printed guide (HTML to A4 by Chromium). CIRERMS makes its book
  with its own `renderPdf` instead.

Take its approach and its chapter format. Write it in CIRERMS's own way: vanilla JS, the `public/js/ui/` kit,
tokens, the module pattern, `renderPdf` and the printout style. Copy no code or text from it verbatim. Write
everything in our own words and our own house style.

---

## G1 `user-guide`

- **Branch:** `user-guide` · **Needs merged first:** everything on `master` (the Settings page included, if
  merged) · **AI session:** Sonnet 5.5, effort high · **Size:** M · **Migration block:** none (the guide is files)
  · **Seed:** none

### Read first
- `docs/PLAN.md` sections 3 and 8. `CONVENTIONS.md` in full, above all Frontend, the component kit and "To add a
  printout".
- `README.md`: the demo accounts and their roles.
- The shell: `public/js/shell/session.js` (`accountItems`, the account menu), `public/js/shell/phone.js` (the phone
  menu), `public/js/sections/app-shell.js` (how Ctrl+K is claimed), `public/js/shell/search-palette.js`,
  `public/js/core/nav.js` (`PAGES`, screens) and `public/js/core/access.js` (`can`).
- The printouts: `src/shared/printouts/` (`renderPdf`), `src/templates/printouts/` (`printout.css`, the partials,
  the fonts) and `public/js/ui/pdf-preview.js` (`openPdfPreview`).
- mycity-app, as listed above.

### Build
1. **The chapters.** One Markdown file per chapter in `docs/manual/` and the pictures in
   `docs/manual/img/<chapter>/`, as mycity-app keeps them. Write `docs/manual/README.md` in our words. It explains
   how to write a chapter and take its pictures, for G2 and later writers. The format follows mycity-app's:
   - front matter: `title`, `summary`, `order` and `module`;
   - `## Section {#slug screen=<nav screen key>}`;
   - `### Task {#slug needs="<screen> <action>"}`;
   - numbered steps, a step that may start with `{needs="..."}`;
   - **bold** is a name as it reads on screen, and never emphasis;
   - links to screens (`[Pending Cases](#disciplinary/pending)`) and to other sections;
   - notes (`> **Tip:**`, `> **Important:**`);
   - pipe tables for a form's fields;
   - pictures as `![What it shows](shot:<id>)` with a fenced `shot <id>` spec in the same file.

   A `needs` names a screen and an action from the privilege catalogue (`ratings.current add`), and several are
   separated by commas.
2. **The reader's cut, on the server.** Add a small `guide` module (`src/modules/guide/`) that parses the chapters
   and cuts them to the signed-in person's privileges, as in decision 1:
   - steps renumbered after the cut;
   - a link to a screen the reader may not open becomes plain text;
   - a chapter with nothing left is not listed.

   Its routes are open to every signed-in, unlocked person, as Change Password's routes are, and each one is
   guarded the way the server requires:
   - the contents;
   - one chapter;
   - the search: words only, at least 2 characters, 25 results, each opening the section at its step;
   - the pictures, each refused unless a part the reader receives shows it;
   - the PDF book.

   Parse the chapters once at start, and again when a file changes in development. Add a Markdown dependency only
   if it is small and pinned, and say so in your report.
3. **User Guide in the account menu**, just before Sign Out, with a Lucide icon from the sprite (for example
   `book-open`). It is in the desktop account menu (the user panel at the bottom of the sidebar) and in the phone's
   same menu. It opens the User Guide page (`#guide`, and `#guide/<section>` for one section). Add the page to
   Ctrl+K's search too.
4. **The User Guide page.**
   - The contents: the reader's chapters and their sections. On a desktop they sit beside the text. On a phone
     they sit above it, as a picker, never sideways scrolling.
   - The search box over the guide.
   - The chapter text in the house type scale, with notes, field tables, numbered steps, and pictures that open
     larger when pressed.
   - The marks' legend under each picture.
   - A step's link to a screen opens it and leaves a **Back to Guide** chip that returns to the same step, as
     mycity-app does.
   - **Download PDF** at the top right.
   - Both themes. Each picture follows the reader's device and theme (decision 2), and changes with the theme
     without reloading the page.
5. **Ctrl+H on a desktop.** It opens the guide in a mini panel that slides in from the right, over any page:
   - about 440 px wide;
   - at the section for the page in view, or at the contents when there is none;
   - with the same search, and **Open in Page** to the full page;
   - closed with Esc, its close button or Ctrl+H again;
   - focus kept inside it while open, and given back when it closes.

   Claim the key with `preventDefault` as Ctrl+K does, and never while the session is locked. It does not open on
   a phone (no keyboard): the menu item serves there. Check it in Chromium. Edge uses the same engine, but say in
   your report that it was not tried on Edge itself.
6. **The screenshot script**, `npm run guide:shots` (`scripts/guide/shoot.js`), on the app running locally with
   the demo seed:
   - `-- --chapter <slug>`, `-- --shot <id>` and `-- --stale`;
   - signs in as the spec's demo account (`as: admin`, `records`, `clerk`, `drafting`, `approver`, `discharge`,
     `rating` and so on: map them to README's demo accounts in one table at the top of the script);
   - **four captures per picture**: desktop 1440 × 900 and phone 390 × 844, each in light and in dark,
     **device scale 2**;
   - a fixed clock;
   - the session lock and any toast, tooltip or focus ring hidden;
   - fonts loaded and the page settled before each picture;
   - the spec's steps (`click`, `fill`, `select`, `press`, `wait`, `scroll`, and `phone `/`desktop ` before a
     step for one device);
   - the **numbered marks** drawn over their targets in the app's brand colour, with a legend;
   - **cropped** to what the step shows: `crop: modal` (the open dialog or sheet), `crop: <selector>`, or the page
     without the empty space below it;
   - saves `<shot>.desktop.light.png`, `.desktop.dark.png`, `.phone.light.png` and `.phone.dark.png` and their
     hashes in `shots.json`, so a picture whose spec or screen changed can be found and retaken.

   **Very fast** (the owner, 26/11/2026). Build it for speed from the start:
   - one browser for the whole run;
   - each demo account signs in once, through the API, and its session is reused by every picture;
   - the desktop and phone runs of a picture go in parallel, with a few pictures at a time (a `--jobs` option,
     4 by default);
   - a spec's steps run **once per device**: take the light capture, switch the theme in place (as the app's own
     theme switch does, with no reload and no transitions), wait for the next frame, then take the dark capture
     with the same crop and marks;
   - no fixed sleeps, only waits for what the next step needs;
   - `--stale` retakes only what changed.

   Print the run's time and each picture's. Getting Started's pictures should take well under a minute, and report
   the time in your report.

   **No personal data in a picture**: demo data only, never a password field with text in it, never a one-time
   password dialog, never an e-mail address of a real person. Keep each file as small as a sharp picture allows,
   and report the folder's total size.
7. **The PDF book**, rendered by `renderPdf` from a new template, `src/templates/printouts/user-guide-book.hbs`,
   with the house printout style: crest, watermark, fonts, header and the footer with RESTRICTED and Page X of Y.
   - A **cover**: the crest, CIRERMS, "User Guide", the date, and who it was made for (their name and role, since
     it is their cut).
   - A **table of contents** with the real page number of every chapter and section. Render once, read where each
     heading landed (`pdfjs-dist` is already a dependency), then render again with the numbers.
   - Each chapter from a new page.
   - The desktop light pictures, sharp, never cut across a page break, with their legends.
   - Steps and notes as on the page.

   The pictures go into the HTML as data URIs, so nothing is fetched while rendering. Download PDF on the page
   opens it in `openPdfPreview` (which has Download), never in a new tab.
8. **One chapter, Getting Started** (`docs/manual/getting-started.md`), as the worked example, with its pictures
   taken by the script:
   - signing in;
   - the layout (sidebar, module tabs, the phone's bottom bar and More);
   - Ctrl+K search;
   - the account menu (My Details, Change Password, Lock Screen, Dark Mode, User Guide, Sign Out);
   - the lock screen;
   - the PDF preview (Download, Print);
   - the guide itself (the page, the search, Ctrl+H, Download PDF).

   Write it for Navy staff who have never used CIRERMS: say where to go, what to press and what they will see. Use
   plain words, short sentences, one action per step, dates dd/mm/yyyy, and screens named as they read.
9. **Docs:** `README.md` and `CONVENTIONS.md` get a short User Guide part: where the chapters live, how to take
   the pictures, and that a change to a screen should retake its pictures and correct its chapter.

### Rules for G1 (beyond the README's)
- Never change how the tab strips work (the owner, 23/11/2026). Never edit `public/js/core/choices.js`.
- Tokens only, light and dark, desktop and phone, the fluid type scale, no inline scripts or `on*=` handlers.
  Rebuild the CSS (`npm run css:build`) when you add classes.
- Touch only the guide's own files, plus these lines in shared files: `session.js` and `phone.js` (the menu item),
  `app-shell.js` (Ctrl+H), `nav.js` and the search palette (the page), `package.json` (the script and any
  dependency), README and CONVENTIONS (their User Guide parts).

### Check (no tests or walkthroughs)
Run the app on a fresh database (`npm run migrate:fresh`, `npm run seed`, `npm start`) and look yourself:
- the menu item on desktop and phone;
- Ctrl+H on three different pages, Esc and the close button;
- the page at 1440 and 390 px in both themes, with no browser errors and nothing scrolling sideways;
- the cut, signed in as HICO001 (everything) and as B0541 (Records Clerk: no System Administration);
- every picture of Getting Started, looked at one by one;
- the PDF book page by page, as HICO001 and as B0541.

### Report
Commit, push, then **one** report by `send_message` to the administrator session (its id is in your brief and in
`docs/PLAN.md` section 7). The report gives:
- the branch and last commit;
- what was built against items 1 to 9;
- what you looked at;
- the size of the pictures folder;
- anything not verified;
- what G2 must know (the spec keys, the demo account names, any screen that is hard to picture).

Then stop. No report note file is needed for an AI session.

---

## G2 `user-guide-content`

- **Branch:** `user-guide-content` · **Needs merged first:** G1 · **AI session:** Sonnet 5.5, effort medium ·
  **Size:** L · **Migration block:** none · **Seed:** none (if a page has nothing to show for a picture, say so in
  the report; do not change the demo data)

### Read first
- `docs/manual/README.md` (G1's) and `docs/manual/getting-started.md`, the worked example.
- `README.md` (each module's part: what every page does) and `docs/legacy/` only where the README leaves a rule
  unclear.
- The app itself: run it and use every page before you write about it.

### What G1 left (26/11/2026, merged)
- The format, spec keys (`open`, `as`, `device`, `do`, `marks`, `crop`, `height`, `session`, `sources`), targets
  and the `as` account names are in `docs/manual/README.md` and at the top of `scripts/guide/shoot.js`. A section's
  `screen=` is a nav screen id (`ratings.list`), not a route. Slugs have two or more words and are unique across the
  guide.
- **Run `npm run guide:check` after every edit**, and `npm run guide:shots -- --chapter <slug>` per chapter
  (`--stale` retakes only what changed). Run the script with `NODE_PATH=$(npm root -g)`.
- **Marks need free space.** The script places each number in the nearest free spot and stops with "mark N has no
  free place for its number" rather than cover anything. Use two to four marks a picture. On a crowded phone screen,
  mark fewer or smaller targets, or split the picture.
- **Crop to the step.** Use `crop: modal` for a dialog or sheet, a selector for one panel, and `crop: #app-main`
  with `height:` for the top of a page without the sidebar. Show the sidebar only where the step is about it. Keep
  the pictures folder small. Getting Started's 11 pictures take 6 MB.
- The `select:` step drives the dropdown component, but G1 never tried it on a real form. Try it first, and report
  if it fails rather than editing `choices.js`.
- Not to be pictured: one-time password dialogs, the forced Choose a New Password box, a password typed into a
  field, and toasts (they are hidden).

### Write
One chapter per module, in the sidebar's order, each with its sections (one per page), its tasks step by step and
its pictures taken by `npm run guide:shots`:
- Dashboard;
- Ratings Management (Current, Former, New Rating, the record and its tabs, Batch Upload, Documents, My Details);
- Drafting (its nine pages);
- Special Drafting (three);
- Training Drafting (five);
- Advancement Processing (seven);
- Naval Character Assessment (three);
- Disciplinary Action (four);
- Discharge Administration (five);
- Static Tables (the engine once, then what is special in each table);
- Reports (six);
- System Administration (Manage Users, Manage Roles, Manage Password, Audit Trail, Settings).

Every task carries the `needs` of the action it uses, so each reader receives only what they may do. Explain each
message a person can meet in its own words (in bold) and what to do about it. Explain each workflow from start to
end (for example a draft batch: due list, batch, review, approval, close, WEF) as one task across the pages,
linking each page. Pictures follow G1's rules: demo data, sharp, cropped to the step, the four captures (desktop and phone,
light and dark), no personal data.

### Check (no tests or walkthroughs)
- `npm run guide:shots` takes every picture without a failure.
- Look at every picture yourself.
- Read the page as HICO001, B0541 (Records Clerk) and B0705 (Drafting), and check each receives only their part.
- Download the PDF book as HICO001 and look at it page by page: the contents' page numbers right, no picture cut
  across a page, nothing overflowing.

### Report
As G1's: one `send_message` to the administrator session, then stop. Include:
- the chapters and the count of sections, tasks and pictures;
- the PDF's page count as HICO001;
- anything the app does that seemed wrong while you wrote about it (report it; do not fix app code in this
  package).

---

## G3 `guide-book-options`

The owner (26/11/2026): "The download manual prompts options. 1. Desktop and light mode 2. Desktop and dark mode
3. Mobile and light mode 4. Mobile and dark mode. So no recapture since all shots are on repo, just build the manual
and insert the right set of images." This replaces the earlier rule that the book uses the desktop light pictures
only.

- **Branch:** `guide-book-options` · **Needs merged first:** G2 · **AI session:** Sonnet 5.5, effort medium ·
  **Size:** S · **Migration block:** none · **Seed:** none

### Do
1. **The choice.** **Download PDF** on the User Guide page opens a small dialog (a bottom sheet on a phone, from the
   kit in `public/js/ui/`) offering four options:
   - **Desktop, Light Mode**
   - **Desktop, Dark Mode**
   - **Mobile, Light Mode**
   - **Mobile, Dark Mode**

   The option matching the reader's current device and theme is chosen at first. A **Make PDF** button opens the
   book in `openPdfPreview`, as today. Cancel closes the dialog.
2. **The book.** `GET /api/guide/book?device=desktop|phone&theme=light|dark` (default desktop and light; anything
   else is refused with 400). `src/modules/guide/guide.book.js` inserts the pictures of that set,
   `<shot>.<device>.<theme>.png`. A picture taken for one device only falls back to the other device's capture, in
   the chosen theme.
   - Phone pictures are drawn at their natural size (width in pixels divided by 2), centred, never enlarged.
   - The cover names the set ("Desktop · Light Mode").
   - The page stays the house printout style, light paper, in every option: only the pictures change.
   - The PDF's file name names the set too (`CIRERMS-User-Guide-desktop-dark.pdf`).
   - Contents page numbers stay right for each set: the two-pass render already handles it.
3. **No recapture.** Every capture is in `docs/manual/img/`. Do not run `guide:shots` and do not change any picture
   or chapter.
4. **Docs.** One line each in `README.md` (the User Guide part) and `docs/manual/README.md`.

### Check (no tests or walkthroughs)
On a fresh database, as HICO001:
- Make all four books.
- Note each one's page count and size.
- Look at a few pages of each, with pictures of the right device and theme and the contents numbers right.

Look at the dialog at 1440 px and 390 px, in light and dark. Make one book as B0541, to see the cut still holds.

### Report
One `send_message` to the administrator session, then stop.
