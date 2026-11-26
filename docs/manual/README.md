# Writing the User Guide

The User Guide is read inside CIRERMS (account menu, **User Guide**; `Ctrl+H` on a desktop) and downloaded as a PDF book. Its
source is this folder: one Markdown file for each chapter and its pictures. The server reads the files, cuts them to what the
signed-in person's privileges allow, and sends only that to the page, the panel, the search, the pictures and the book. This
page is for whoever writes a chapter, a person or a program.

| What | Where |
|---|---|
| A chapter | `docs/manual/<chapter>.md` (the file name is the chapter's slug). `README.md` is this page and is not a chapter; a file with no front matter is not in the guide yet |
| Its pictures | `docs/manual/img/<chapter>/<picture>.<device>.<theme>.png`, four for each picture (`desktop` and `phone`, `light` and `dark`), and `shots.json` (hashes, for `--stale`) |
| The reader's cut, search, book | `src/modules/guide/` (`guide.format.js` is the parser) |
| The picture script | `scripts/guide/shoot.js` (`npm run guide:shots`), `npm run guide:check` finds mistakes |

Run `npm run guide:check` after every edit: it reads the chapters with the parser the server uses and names each mistake by file
and line. The server logs the same mistakes when it reads the chapters, and in development reads them again when a file changes.

## A chapter

~~~md
---
title: Disciplinary Action
summary: Open a case, conclude it, cancel it, correct it, and print the report.
order: 80
module: disciplinary
---

An introduction, if the chapter needs one.

## Pending Cases {#disciplinary-pending-cases screen=disciplinary.pending}

What the page is for, in a sentence or two.

![The Pending Cases list](shot:disciplinary-pending-list)

### Conclude a case {#disciplinary-conclude needs="disciplinary.pending approve"}

1. Open [Pending Cases](#disciplinary/pending).
2. Press a row. The case opens.
3. {needs="disciplinary.pending delete"} Press **Cancel Case** to stop the case instead.
4. Press **Conclude**.

> **Tip:** The sanction is chosen from the list the Static Tables hold.

```shot disciplinary-pending-list
open: #disciplinary/pending
as: discipline
marks:
  1: row 1 | A case: press it to open
```
~~~

- **Front matter** (`---` lines): `title` and `summary` are required; `order` puts the chapter in the contents (Getting Started is 0,
  the others follow the sidebar's order); `module` is the module's key in `public/js/core/nav.js`.
- **Sections** are `## Title {#slug screen=<screen id>}`: one for each page of the app. `screen` is the screen id from `nav.js`
  (`ratings.list`, `admin.users`). A section goes only to someone who may open that screen. A section about no one screen has no `screen`.
- **Tasks** are `### Title {#slug needs="<screen> <action>"}`: one job, its steps. A task, a section, a paragraph, a note, a list item, a table
  row or a step can start with `{needs="..."}` (or carry `needs` in its heading) and then goes only to someone who holds **every** privilege it
  names, separated by commas. A privilege is a screen id and one action: `view`, `add`, `edit`, `delete` or `approve`
  (the catalogue is in each module's `*.module.js`, shown in Manage Roles). The Administrator holds them all.
- **Slugs** are two or more lower-case words joined by hyphens, begin with the chapter's name, and are unique in the whole guide. A section's or
  task's slug is its address: `#guide/<slug>`, and with `?step=3` that step.
- **Steps** are a numbered list, one action each. Steps a reader does not receive are not counted: the others are numbered again.
- **Bold is a name as it reads on screen** (**Conclude**, **Username or Official Number**), never emphasis. Keys are `code` (`Ctrl`, `K`).
- **Links**: `[Pending Cases](#disciplinary/pending)` opens a screen (the words are the screen's name; to a screen the reader may not open
  it becomes plain words, and one pressed in a step leaves a **Back to Guide** chip that returns to the same step);
  `[Conclude a case](#disciplinary-conclude)` goes to another part of the guide; `https://...` opens a page outside.
- **Notes**: `> **Tip:** ...`, `> **Important:** ...` or a plain `> ...`.
- **Tables** are pipe tables, for a form's fields (Field, What to enter, Needed). The first cell of a row can start with `{needs="..."}`.
- **Pictures**: `![What it shows](shot:<id>)` on a line of its own or on a step. Its spec is a fenced block, ` ```shot <id> `, anywhere in the same file.

## The picture spec

| Key | What it says |
|---|---|
| `open` | `#ratings/current` (an app route), or `/` (a page, signed out, with `as: guest`) |
| `as` | The demo account: `admin`, `rating`, `records`, `navigation`, `clerk`, `auditor`, `tables`, `discipline`, `initiator`, `discharge`, `drafting`, `drafting-marine`, `approver`, `advancement`, `advancement-approver`, `advancement-gunnery`, `training`, `training-viewer`, `special`, `special-officer`, `appraisal`, `appraisal-officer`, `report` or `guest` (one table, at the top of `shoot.js`, from README's demo credentials) |
| `device` | `both` (the default), `desktop` or `phone` |
| `do` | Steps taken before the picture, one on each line under it: `click`, `fill`, `select`, `press`, `wait`, `scroll`. `phone ` or `desktop ` before a step runs it on that device only (`phone click: button "More"`) |
| `marks` | Numbered marks drawn over their targets, one on each line: `1: button "Save" \| Saves the case`. The legend under the picture lists them |
| `crop` | `page` (the default: the page without the empty space under it), `viewport`, `modal` (the open dialog, sheet or menu, without the empty space under its content), or a CSS selector written as it is (`crop: #lock-card`, not `css`; `crop: #app-main` is the page without the sidebar and bars). Every mark and its number is always inside the picture, and never covers the words or icon of what it marks |
| `height` | Keeps only the top of the crop, in CSS pixels (`height: 470`), so a long page does not bring in what lies below |
| `session` | `own`: the picture signs in on its own (it locks, ends or changes the session) |
| `sources` | More files the picture depends on, one on each line, beside the section file its address opens (and the files it imports from `public/js/sections` and `public/js/shell`) |

A target is `button "Name"`, `link "Name"`, `tab "Name"`, `menuitem "Name"`, `label "Field"`, `text "Words"`, `heading "Title"`,
`searchbox`, `row 1`, `role <role> "Name"` or `css <selector>`. Names must be exact. A `select:` step names the field and the option as a person
reads them: `select: label "Rate" = Leading Seaman`. A target is looked for in the open dialog first, then on the whole page.

### Taking the pictures

The app must be running on a fresh seeded database (`npm run migrate:fresh`, `npm run seed`, `npm start`), and Playwright must be the machine's
own (`NODE_PATH=$(npm root -g)` when it is installed globally); the script installs nothing.

```
npm run guide:shots                         every picture
npm run guide:shots -- --chapter <slug>     one chapter's
npm run guide:shots -- --shot <id>          one picture
npm run guide:shots -- --stale              the pictures whose spec or screen changed, or that are missing
                          --jobs 4          pictures at the same time (default 4)      --url http://localhost:3000
```

Each picture is taken as its demo account at 1440 x 900 (desktop) and 390 x 844 (phone), in light and in dark, at device scale 2, on a fixed
clock, with toasts, tooltips and focus rings hidden. Its steps run once for each device, then the theme is switched in place for the dark capture.
Each account signs in once, through the API. The script prints each picture's time and the run's.

Rules for a picture:

- **Demo data only.** Never a password field with text in it, a one-time password, or an e-mail address of a real person.
- **Cropped to what the step shows.** A dialog's picture is of the dialog (`crop: modal`).
- **Marks only where they help**, three or four at most, numbered in the order a person reads the picture.
- A change to a screen changes its pictures and its chapter: retake with `--stale` and correct the words.
- The book uses the desktop light pictures. A picture taken only for the phone is shown narrow in the book.
- Readers with fewer privileges than the picture's account see fewer items than the picture does. Say so in the text where it matters.

## Writing for the reader

- Write for Navy staff who have never used CIRERMS. Say where to go, what to press and what they will see.
- One action in a step. Name the button and where it is ("at the top right").
- Say what each message means and what to do about it, using the message's own words in bold.
- Plain words, short sentences, no dashes, dates as dd/mm/yyyy, screens named as they read.
