# WP13b report

- Package: WP13b Sharp PDF preview
- Branch: preview-sharp
- Last commit: see `git log` (preview code commit, then this report)
- Done by: AI session for swizfcodes
- Date: 19/11/2026

## Built (against the brief, page by page)
- PDF preview (`public/js/ui/pdf-preview.js`): pages are drawn at a backing resolution of 2x to 3x their display size (never below 2x, 3x on dense screens, capped at 16 million pixels per page) and shown at their whole-pixel CSS width, so the browser scales them down, never up. Pages are drawn again when the dialog's width changes. The PDF now paints its own background (white only where it has none); the `--paper` fill is gone. Print renders at 3x, also without the paper fill.

## Cause found
- Resolution: the canvas was drawn at its display size times min(2, devicePixelRatio), so on a 1x monitor it was drawn at exactly display size, with no supersampling.
- Colour: `background: paperColour()` replaced the PDF's own `#f8fbff` page and watermark backdrop with the app's `--paper`, so the page looked washed out and off-colour. No opacity, filter, blend mode or dark-mode style touches the canvas or dialog stage (checked in the preview and dialog code and CSS).

## Decisions taken where the brief and the design were silent
- Backing ratio is clamp(devicePixelRatio, 2, 3), reduced only to stay inside the pixel budget.

## Checks
- No tests or walkthroughs, as instructed. Syntax checked only. I did not run the app or take before and after screenshots.

## Not verified
- Visual before and after at deviceScaleFactor 1 and 2, light and dark, phone: not looked at.

## Files outside the package's own module
- None.

## For the next packages
- `paperColour()` was removed; nothing else used it.
