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
- No tests or walkthroughs, as instructed. Looked at the preview with a small harness (not the full app: Docker and MySQL are not available here): the real `openPdfPreview` module (old from master, new from this branch) served with the repo's PDF.js, opening a Chromium-made A4 PDF with a `#f8fbff` page background, a faint large watermark and small serif text. Compared with the same PDF rasterised by `pdftoppm` (the stand-in for the downloaded PDF opened alone), at deviceScaleFactor 1 and 2, 1280x900, light theme.
- Colour: the canvas pixel is `248,251,255` (`#f8fbff`) in both old and new, and no ancestor of the canvas has opacity, filter or blend mode. In this PDF the background is a painted fill, so the `--paper` paint was hidden behind it; the paper fill could only show through where a PDF paints no background. It is removed anyway.
- Sharpness (mean horizontal edge energy of a text block; reference = the PDF rasterised then resized to the same displayed size): dsf 1: reference 22.5, old 14.3, new 22.4. dsf 2: reference 17.0, old 14.2, new 16.1. So old was clearly soft at both; new matches the reference closely at 1x and is slightly under at 2x.
- Whole page, margins and proportions: the preview shows the full page, uncropped; canvas 1520x2151 for an A4 page shown at 760 CSS px wide (ratio 1.415, same as A4).

## Not verified
- Not looked at: dark theme, phone width, the real printouts from the running app (their own crest and colours), and a browser PDF viewer side by side (the reference was `pdftoppm`, not a viewer). Remaining difference: the preview page sits on the dialog's muted backdrop with a card shadow and rounded corners, and is shown at about 760 CSS px, not the viewer's zoom.

## Files outside the package's own module
- None.

## For the next packages
- `paperColour()` was removed; nothing else used it.
