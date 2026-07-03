# Verification Plan

## Unit Tests

- `boxSettings`
  - default values match the Python app
  - final cut depth changes with material thickness
- `layoutGenerator`
  - default drawer panel count and panel names
  - box-with-lid panel count and panel names
  - panel bounds are finite and non-empty
  - stock packing creates extra sheets when required
  - impossible panel dimensions throw
- `gcodeGenerator`
  - default output matches fixture
  - multi-sheet output includes `M0`
  - tabs can be disabled
  - all numeric output uses stable millimetre precision
- `ncSimulator`
  - parses generated NC without throwing
  - computes total duration above zero
  - maps stock sheet comments back to stock origins
  - supports metric/inch and absolute/relative snippets

## Fixture Strategy

- Generate fixtures from the Python source before changing behavior.
- Keep fixture names descriptive:
  - `default-drawer.nc`
  - `default-drawer.boxcreator.json`
  - `box-with-lid.nc`
  - `multi-sheet.nc`
- Prefer exact string comparison for generated NC during the first migration.
- If TypeScript output intentionally diverges, document the reason next to the
  fixture update.

## Browser Workflow Tests

Use Playwright to check:

- App loads at desktop and mobile viewport sizes.
- Editing a dimension updates the preview/status.
- Generate NC enables simulation controls.
- Simulation run/pause/restart buttons work.
- Project JSON upload restores settings.
- NC download produces non-empty text containing `G21`, `G90`, `M3`, and `M30`.

## Manual Acceptance Checks

- The app works with network disabled after the static assets are loaded.
- The app does not call a backend API.
- All generated files are produced locally in the browser.
- The main preview remains legible on common laptop and phone widths.
- `npm run build` succeeds before publishing.
