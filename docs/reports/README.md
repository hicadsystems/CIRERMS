# Report notes

Every package ends with a report note in this folder, committed last on the package's branch:
`docs/reports/<package>.md` (for example `docs/reports/WP7a.md`). The administrator reads it, then inspects the
branch it names. Keep it short and factual: what is true, what was checked, what was not. Notes exist for D4 and for WP5 to WP13b; the packages before them are recorded in the status table of `docs/PLAN.md` (section 8). Every package is merged, so no note is awaited; what each note left open is gathered in `docs/OPEN-QUESTIONS.md`.

Copy this outline:

```markdown
# <package> report

- Package: <for example WP7a Drafting Cycle>
- Branch: <for example drafting-cycle>
- Last commit: <short hash and message>
- Done by: <your name, or the name of the person it was done for>
- Date: <dd/mm/yyyy>

## Built (against the brief, page by page)
- <page or part>: <what it does now>

## Decisions taken where the brief and the design were silent
- <the question>: <what you chose, and why>

## Checks
- <walkthrough>: <passed> passed, <failed> failed, in <seconds> s (fresh database)
- Screens looked at: <which, at which widths and themes>

## Not verified
- <anything you could not check, and why>

## Files outside the package's own module
- <shared file>: <what changed and why>

## For the next packages
- <what they must know>
```
