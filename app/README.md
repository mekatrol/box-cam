# Box CAM

Box CAM is a browser-based CAM utility for designing finger-jointed boxes and
drawer trays and generating GRBL-compatible NC/G-code files.

The app is a fully
client-side (browser) static application: no server runtime, no backend API, and no hosted
database. Projects and NC files are generated locally in the browser and can be
saved or reopened as files.

## Features

- Configure outside box dimensions, material thickness, stock size, cutter size,
  finger width, holding tabs, feeds, plunge rate, and spindle speed.
- Generate flat layouts for drawer trays or boxes with lids.
- Preview stock sheets, finger joints, relief cuts, holding tabs, and assembled
  box geometry.
- Generate plain GRBL-style NC output in millimetres.
- Simulate generated toolpaths in the browser.
- Save and reopen `.boxcreator.json` project files.
- Download generated `.nc` or `.gcode` files.
- Build and publish as static assets on GitHub Pages or another static host.

## Project Notes

Codex project guidance lives in `.codex/`:

- `.codex/code-architecture-guide.md` defines code structure and styling rules.
- `.codex/verification.md` describes fixture, unit, and browser test coverage.

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Run End-to-End Tests with [Playwright](https://playwright.dev)

```sh
# Install browsers for the first run
npx playwright install

# When testing on CI, must build the project first
npm run build

# Runs the end-to-end tests
npm run test:e2e
# Runs the tests only on Chromium
npm run test:e2e -- --project=chromium
# Runs the tests of a specific file
npm run test:e2e -- tests/example.spec.ts
# Runs the tests in debug mode
npm run test:e2e -- --debug
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

### Format

```sh
npm run format
npm run format:check
```
