# Wave V: the technical handbook and Forgot Password

The owner (26/11/2026), as the real database is about to arrive:
1. "Master has been updated, so there are three foreign documents about technical guide, run book, et al. Combine
   all into separate one word and one pdf."
2. "Remove the demo login box and now put forgot password." Then: "Let it send OTP instead."

The owner's answers (26/11/2026):
- The handbook is built by a script in the house style, and both files are committed.
- Forgot Password e-mails a one-time code (not a link) to the account's e-mail address.

Two packages, one after the other (one session at a time while the weekly limit is at warning). Read
`docs/waves/README.md` first: its rules are binding.

---

## K1 `docs-book`

- **Branch:** `docs-book` · **Needs merged first:** everything on master · **AI session:** Sonnet 5.5, effort
  medium · **Size:** S · **Migration block:** none · **Seed:** none
- **No tests or walkthroughs.** Look at the files yourself.

### Read first
- `docs/README.md`.
- The three sets:
  - `docs/development/` (the technical guide: README, architecture, setup, database, modules, frontend, testing);
  - `docs/runbooks/` (README, deployment, migrations, database recovery, storage and uploads, incident
    troubleshooting);
  - `docs/examples/ratings-flow/` (README and its two scripts).
- `src/shared/printouts/` (`renderPdf`), `src/templates/printouts/` (`printout.css`, the partials, the fonts) and
  `user-guide-book.hbs` with its `.css`, which is the closest model: cover, contents with real page numbers, each
  part from a new page.
- `src/modules/guide/guide.book.js`, for the two-pass page numbers.

### Build
1. **`npm run docs:book`** (`scripts/docs-book/build.js`) reads the Markdown and writes two files:
   - `docs/handbook/CIRERMS-Technical-Handbook.pdf`;
   - `docs/handbook/CIRERMS-Technical-Handbook.docx`.

   It also writes a short `docs/handbook/README.md`: what the files are and how to rebuild them.
2. **One book, three parts, in this order:**
   - Part 1, Technical Guide: `docs/development/`, README first, then the order its README gives;
   - Part 2, Runbooks: `docs/runbooks/`, README first;
   - Part 3, Worked Example: `docs/examples/ratings-flow/README.md`, then its two scripts as code listings.

   `docs/README.md` opens the book as its introduction. A file the sets add later is picked up by the same rules,
   and the script says which files it read.
3. **The PDF**, by `renderPdf` from a new template `src/templates/printouts/docs-book.hbs` (with its own `.css`; the
   shared `printout.css` is untouched), in the house printout style:
   - crest, watermark, fonts, header, and the footer with RESTRICTED and Page X of Y;
   - a cover: crest, NIGERIAN NAVY, CIRERMS, "Technical Handbook", the date and the master commit it was built from;
   - a contents page with real page numbers for each part and each file's headings down to level 2;
   - each part and each file from a new page;
   - Markdown drawn properly: headings, lists, tables (no words broken mid-word, wide tables fitted), code blocks in
     the monospace font with wrapping and never cut at the page edge, notes, links shown as text.

   The script renders through `renderPdf` without starting the web server.
4. **The Word file**, with the same cover, contents (a real Word table of contents field, updated when opened, or
   written out with page references), headings as Word heading styles, tables, code in a monospace style, page
   numbers and the RESTRICTED footer. Use a small pinned devDependency (the `docx` package) and say so in the
   report. No Word templates copied from elsewhere.
5. Keep the Markdown as it is. If a document has a fault the book shows up (a broken table, a link to a missing
   file), list it in the report; do not fix other people's documents in this package.
6. One line in `README.md` and in `docs/README.md` pointing at the handbook and the script.

### Check
- Run `npm run docs:book`.
- Open the PDF and look at every page, rendered to images: the cover, the contents numbers against the pages, code
  blocks and tables not cut off.
- Open the `.docx` (for example convert it with LibreOffice if available, or read its XML) and check the headings,
  tables and code.

Report the page count and both file sizes.

### Report
One `send_message` to the administrator session, then stop.

---

## K2 `forgot-password`

- **Branch:** `forgot-password` · **Needs merged first:** K1 is not needed; everything on master ·
  **AI session:** Sonnet 5.5, effort high · **Size:** M · **Migration block:** `15` (`20261120_15####_`) ·
  **Seed:** `016_forgot_password.sql` (only if needed)
- Security is at stake: follow the rules below exactly.

### Read first
- `README.md`: the sign-in, passwords and accounts parts (one-time passwords, Choose a New Password, the sign-in
  throttle).
- `public/index.html` and `public/js/sections/auth.js` (the sign-in page and its demo accounts box), and
  `src/modules/auth/`.
- `src/shared/password.js`, `public/js/shell/password.js`, `src/shared/audit` and `CONVENTIONS.md`.
- The user guide's Getting Started chapter, `docs/manual/getting-started.md`, which pictures the sign-in page.

### Build
1. **Remove the Demo Accounts box** from the sign-in page and its code in `auth.js`. Nothing on the page names a demo
   account or password any more. The README's demo-account table stays, for developers.
2. **Forgot password?** A link under the password field opens the reset in place on the sign-in card, in the same
   style, in both the day and night sea themes, on desktop and phone. Three steps:
   1. **Official Number.** The person types their Official Number and presses **Send Code**.
   2. **The code.** The server makes a 6-digit one-time code and e-mails it to the account's e-mail address. The
      page then always says the same thing, whether or not the account exists, is active or has an e-mail: "If
      this Official Number has an account with an e-mail address, a code has been sent to it. It is valid for 10
      minutes." It never shows a hint of the address, so nobody can probe which numbers have
      accounts. Underneath it says: "No e-mail on your account? Ask your administrator to
      reset your password."
   3. **New password.** The person types the code, a new password and the new password again (the same rules as
      Change Password, shown as they type), then presses **Reset Password**. On success they return to Sign In
      with a toast: "Your password has been changed. Sign in with your new password."
3. **The rules (server):**
   - **Codes:** a random 6-digit code (`crypto.randomInt`), stored only as a hash (with a server secret, for example
     an HMAC with `JWT_SECRET`) in a new table, `password_reset_codes`, by account. Each code is valid for **10
     minutes** and works **once**. A new request replaces any earlier code for that account.
   - **Wrong code:** at most **5** wrong tries per code, after which the code is dead and a new one is needed.
   - **Throttle:** at most **3** codes per account per hour, and the sign-in throttle's per-client limit on both
     routes. The answer for a throttled request is the same neutral message, never a different one.
   - **Who gets a code:** only an **active** account with an e-mail address. For any other Official Number the server
     sends nothing and answers exactly as for a real one, in about the same time, so the answer gives nothing away.
   - **A successful reset:**
     - sets the password through `src/shared/password.js`;
     - clears a pending "must change password";
     - ends **every** session of that account;
     - deletes the code;
     - records an audit row (UPDATE on users, "password reset by e-mailed code"), with no code or password in it.
   - **More audit rows:** a request and a failed or expired code each write an audit row too, with the Official
     Number and the client, never the code.
   - **The e-mail:** plain words and the house name, signed CIRERMS, Nigerian Navy:
     - the code, large;
     - "valid for 10 minutes";
     - "If you did not ask for this, ignore this e-mail; your password has not changed."

     No link.
   - **The locked screen** is unchanged: unlocking still needs the password. Forgot Password lives only on the
     sign-in page.
4. **Sending e-mail.** Use `nodemailer` (pinned) through settings in `.env`:
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`;
   - `MAIL_FROM`, for example `CIRERMS <no-reply@...>`.

   Add them to `.env.example` with empty values and describe them in README and `docs/runbooks/README.md`'s settings
   table.
   - **With no `SMTP_HOST`** in development, the mail is written to a file under a git-ignored folder (`MAIL_DIR`,
     default `storage/mail/`), so it can be checked without a mail server. The server logs one line saying so.
   - **In production with no `SMTP_HOST`,** the server starts but logs a clear warning, and the page still answers
     neutrally.
   - **Never** log a code or put one in an audit row.
5. **Demo data:** give a few demo accounts an e-mail address on an invented domain (for example
   `@cirerms.example`), so the flow can be tried. Never use a real address, and never the owner's.
6. **The user guide:**
   - Getting Started's Signing In section gains a task, "Forgot your password", with its steps.
   - Retake that chapter's sign-in pictures (`npm run guide:shots -- --chapter getting-started`; the pictures must no
     longer show the demo box), plus one picture of the reset step. Never picture a real code or a typed password.
   - The `docs/development/` and `docs/runbooks/` pages that mention the demo box or the sign-in get one line each.
7. **A walkthrough** is not asked (the owner asked for none in this wave). Instead, check the rules through the API
   with a short script you run and keep out of the repository, and report what it showed.

### Rules for K2 (beyond the README's)
Touch only:
- the sign-in page and `auth.js`;
- `src/modules/auth/` (or a new `src/shared/mail/`);
- the migration, the seed lines, `.env.example`, `package.json`;
- `.gitignore` (the mail folder);
- README, CONVENTIONS, the runbook settings table, and the Getting Started chapter with its pictures.

Never edit `public/js/core/choices.js`.

### Check
On a fresh database:
- The sign-in page at 1440 and 390 px, day and night, with no demo box.
- The whole flow with a demo account that has an e-mail address: the mail in `storage/mail/`, the code, then sign in
  with the new password. Other sessions of that account are signed out.
- The neutral answer for an unknown number, an inactive account and an account with no e-mail.
- A wrong code 5 times, an expired code (set the clock or the row), a used code and the per-hour limit.
- The audit rows.
- No browser errors.

### Report
One `send_message` to the administrator session, then stop.
