# Code And Architecture Guide

This guide defines the expected structure for the box cam Vue 3 / TypeScript app.

## Tooling Rules

- Follow the repository lint, type-check, and format rules before considering
  work complete.
- Use the package scripts as the source of truth:
  - `npm run lint`
  - `npm run format`
  - `npm run format:check`
  - `npm run type-check`
  - `npm run build`
- The production build already runs lint, format check, type-check, and Vite
  build steps. If a change affects behavior, add or update tests before relying
  on the build alone.
- Keep code compatible with the configured ESLint rules, including explicit
  TypeScript function return types where required, single quotes, no `var`, and
  Vue single-file component block order of `template`, `script`, then `style`.

## Module Boundaries

- Keep Vue single-file components small and focused. Split large views into
  feature components, core reusable components, and rendering helpers before a
  component becomes difficult to scan.
- Keep TypeScript modules small and cohesive. Avoid large catch-all files for
  unrelated state, domain logic, browser helpers, or rendering functions.
- Ported CAM behavior belongs in domain modules, not in Vue components.
- Browser integration belongs in browser-facing helpers or composables, not in
  domain modules.
- Components should orchestrate UI state and rendering. They should not own
  layout generation, G-code generation, NC parsing, file serialization, or other
  business rules.

## Recommended Source Layout

```text
src/
  assets/
    css/
    img/
  components/
    core/
    preview/
    project/
    settings/
    simulation/
  composables/
  models/
  router/
  stores/
  utils/
  __tests__/
    fixtures/
```

- The folder names above are preferred for new work. 
- Reusable low-level UI belongs in `src/components/core`.
- Feature-specific Vue components belong in a feature folder such as
  `src/components/settings` or `src/components/preview`.
- Shared Vue behavior belongs in `src/composables`.
- Shared non-Vue helpers belong in `src/utils`.

## Data Models

- Define data models as TypeScript types or interfaces in model files.
- Store models under `src/models` unless a tightly scoped domain model is better
  kept beside the domain module during the initial Python port.
- Related models may share one file when they describe one concept or workflow,
  such as geometry records or simulator records.
- Do not define reusable models inside Vue components, stores, composables,
  generators, or utility modules.
- Keep model names descriptive and stable. 
- Domain and UI code should import model types from model files instead of
  duplicating shape definitions.

## Vue Components

- Prefer composition through smaller components over adding more modes and
  branches to one large component.
- Keep component props and emitted events explicit.
- Use `computed`, `ref`, and composables for view state that belongs to the UI.
- Move repeated component logic into composables under `src/composables`.
- Use stores or a project composable for application state shared across
  unrelated component trees.
- Do not put business rules into component templates or template helper
  expressions.
- Semantic and clean HTML should be used. Don;t use DIVs for general use such as header, footer, aside, main, section, nav, article, details, summary, figure, figure caption, hgroup, address, mark, strong, em, and so forth
- Semantic HTML is intended to descript purposes, not aesthetics and visual styling

## Composables

- Composables are the preferred pattern for shared Vue behavior, especially
  browser features, file downloads/uploads, persistence, resize handling,
  keyboard handling, simulation timing, and theme handling.
- Store composables in `src/composables`.
- Name composables with the `use` prefix, such as `useProjectFiles` or
  `useSimulationClock`.
- Keep composables focused on one concern. If a composable starts returning many
  unrelated values, split it by workflow.
- Composables may depend on browser APIs and Vue reactivity. Domain modules
  should not depend on composables.

## Assets

- Store CSS under `src/assets/css`.
- Store images under `src/assets/img`.
- Import global CSS through the app entry point or a single stylesheet chain.
- Do not scatter image assets beside components unless a build tool or third
  party integration requires it and the reason is documented.

## CSS And Themes

- Keep component-scoped CSS minimal. Use it for component-specific layout only
  when the style is not reusable.
- Keep colors, fonts, spacing, sizes, radiuses, shadows, focus rings, and other
  common styles in shared CSS files.
- Maintain both light and dark themes in `src/assets/css/theme.css`.
- Define colors once as CSS custom properties in `theme.css`.
- Reference colors through `var(...)` in all other CSS. Do not repeat hex,
  `rgb(...)`, or named color values outside theme definitions unless the value
  is a documented one-off such as a transparent overlay.
- Prefer semantic token names over visual names. For example, use
  `--dg-color-surface` instead of naming a token after a specific shade.
- Any new shared style token must be checked in both light and dark themes.

## Comments

- Code must be well commented where behavior is not obvious.
- Domain code must expand manufacturing and machine-control terms near first
  use. For example, explain that NC means numerical control, CAM means
  computer-aided manufacturing, and a G-code command such as `G1` means a
  feed-rate controlled linear move.
- Do not assume future maintainers know G-code command meanings. When comparing
  against commands such as `G0`, `G1`, `G20`, `G21`, `G90`, `G91`, `M0`, `M3`,
  or `M30`, add a nearby comment describing the machine behavior that matters
  to the code.
- Comments in ported domain logic should explain the physical manufacturing
  reason for a rule, not only restate the expression. For example, explain why
  final cut depth goes slightly below material thickness or why a move counts as
  cutting only when the tool is at or below the material surface.
- Add comments for browser behavior that is easy to misuse or forget, such as
  popover positioning, file input reset behavior, Blob download lifetimes,
  canvas coordinate transforms, animation timing, and intrinsic form behavior.
- Comment the why and the contract, not line-by-line restatements of the code.
- Keep comments current when porting Python behavior. If TypeScript behavior
  intentionally differs from the Python app, document the reason near the code
  or fixture that changed.

## Verification Expectations

- Keep existing tests up to date as part of the same change that alters the
  behavior or visible text they cover. Do not leave starter Vue tests or
  Playwright tests asserting obsolete copy while migrating the application.
- Add unit tests for domain logic and data transformations.
- Add component or browser workflow tests when UI behavior changes in a way that
  users can observe.
- Existing unit and end-to-end tests are migration safety checks, not disposable
  scaffold. If a test no longer describes the intended product behavior, update
  it to the new behavior in the same commit and keep the assertion meaningful.
- Keep migration fixtures stable. Treat fixture changes as behavior changes and
  document intentional differences.
- Run the smallest useful verification during development, then run
  `npm run build` before handing off broad or user-facing changes.
