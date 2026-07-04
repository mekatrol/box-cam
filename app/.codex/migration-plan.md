# Migration Plan

## Source Application

- The source application to migrate from is located at /home/dad/repos/cnc-utils/box-creator/box_creator

## 1. Baseline The Source Behavior

- [x] Record representative default outputs from the Python app:
  - [x] default drawer tray project JSON
  - [x] default generated NC
  - [x] box-with-lid generated NC
  - [x] at least one multi-sheet layout generated NC
- [x] Save those fixtures under the Vue app test fixture tree before porting logic.
- Treat fixture differences as intentional only when the reason is documented.

## 2. Port Core Data Types

- [x] Create TypeScript equivalents for:
  - [x] `BoxSettings`
  - [x] `Point`
  - [x] `Segment`
  - [x] `Panel`
  - [x] `ToolPosition`
  - [x] `MotionSegment`
  - [x] `SimulatorProgram`
- [x] Keep field names close to the Python names during the first port to make
  regression comparison easier.
- [x] Add tests for default settings and `finalCutDepth`.

### Chunking Notes

- First migrated chunk: source-generated fixture baselines plus core TypeScript
  data models. Verification target: `npm run test:unit`.
- First chunk verification passed with `npm run test:unit -- --run` and
  `npm run build`.
- Next chunk: port `LayoutGenerator` and add layout-only unit tests before
  starting G-code generation.

## 3. Port Layout Generation

- Port `LayoutGenerator` from Python to TypeScript.
- Preserve:
  - drawer vs box panel selection
  - finger count and odd-count adjustment
  - tab/slot edge alternation
  - relief point detection
  - stock sheet packing and stock origins
- Add unit tests for:
  - default drawer creates five panels
  - box with lid creates six panels
  - stock overflow creates additional sheets
  - impossible stock dimensions throw a useful error

## 4. Port G-Code Generation

- Port `GcodeGenerator` from Python to TypeScript.
- Preserve:
  - GRBL-style preamble and shutdown
  - millimetre units and absolute positioning
  - panel grouping by stock sheet
  - `M0` pause before sheet 2 and later sheets
  - cutter-centre outline offset
  - depth passes
  - holding tab moves
- Add fixture tests that compare generated NC text to Python-generated fixtures.

## 5. Port NC Simulation

- Port the NC parser and motion timing logic.
- Preserve:
  - comment parsing for stock sheet changes
  - `G0` / `G1`
  - `G20` / `G21`
  - `G90` / `G91`
  - feed-rate timing and rapid-rate fallback
  - `positionAtElapsed`
- Add tests with small hand-written NC snippets and generated NC fixtures.

## 6. Build The App State Model

- Create a Pinia store or composable for the active project.
- Store:
  - settings
  - generated panels
  - generated NC text
  - simulation program
  - current preview mode
  - dirty state
- Recompute panels from settings changes and clear simulation output when CAM
  inputs change.

## 7. Replace The Desktop Wizard UI

- Build the primary app as the first screen, not a landing page.
- Use a work-focused layout:
  - left or top controls for Box, Material, Joints, Tabs, Preview, Generate
  - main preview surface
  - compact status/job summary
- Browser replacements:
  - `New`: reset state after dirty confirmation
  - `Open`: file input for `.boxcreator.json`
  - `Save Project`: JSON download
  - `Generate NC`: generate text and load simulator
  - `Save NC`: download generated NC

## 8. Build Preview Rendering

- Start with Canvas 2D or SVG for the current 2D views.
- Recreate:
  - flat cutting layout
  - stock sheets
  - panel outlines
  - relief cuts
  - holding tabs
  - material/cutter preview
  - finger-joint preview
  - generated job summary
  - simulation path overlay
- Add responsive sizing for desktop and mobile without layout overlap.

## 9. Add Browser Persistence

- Use localStorage for simple preferences:
  - last settings snapshot
  - last preview mode
  - simulation speed
- Keep project files portable via explicit JSON download/upload.
- Do not depend on a backend, account, database, or server API.

## 10. Prepare Static Deployment

- Configure Vite base path for GitHub Pages project hosting when the repository
  name is known.
- Add a GitHub Actions workflow that:
  - installs dependencies with `npm ci`
  - runs lint, format check, unit tests, and build
  - deploys `dist/` to GitHub Pages
- Keep the published app as static HTML, CSS, and JavaScript only.

## 11. Final Acceptance

- Generated NC fixture tests pass.
- Unit tests cover layout, G-code, project JSON, and simulation parsing.
- Playwright verifies the main workflow:
  - edit dimensions
  - generate NC
  - preview simulation
  - download project JSON
  - download NC
- `npm run build` succeeds.
- The app runs from a static file host with no server runtime.
