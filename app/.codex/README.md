# Codex Migration Notes

This directory captures the migration plan for moving the original Python
`box-creator` desktop app into this Vue 3 / TypeScript browser app.

## Source Project

- Source checkout: `/home/dad/repos/cnc-utils/box-creator`
- Current implementation: PySide6 desktop wizard
- Target implementation: fully client-side Vue 3 / TypeScript app built by Vite
- Runtime constraint: no server dependency after build

## Target Shape

The browser app should generate GRBL-style NC files for finger-jointed boxes and
drawer trays. It should preserve the Python app's core behavior while replacing
desktop-only features with browser-native equivalents:

- Project save/load: JSON upload/download, later optionally localStorage or
  IndexedDB for recent work.
- NC output: generated in memory and downloaded as `.nc` or `.gcode`.
- Preview: Canvas 2D or SVG first; WebGL/Three.js only if a richer 3D assembled
  view becomes useful.
- Simulation: parse generated NC text in-browser and animate the cutter path.
- Deployment: static build suitable for GitHub Pages.

## Key Files

- `migration-plan.md`: ordered implementation checklist.
- `source-map.md`: mapping from Python modules to TypeScript modules.
- `verification.md`: regression and acceptance checks for the migration.
