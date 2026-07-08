# Codex Project Notes

This directory captures project-specific implementation, architecture, and
verification notes for the Box CAM Vue 3 / TypeScript browser app.

## Application

- Implementation: fully client-side Vue 3 / TypeScript app built by Vite
- Runtime constraint: no server dependency after build

## Current Shape

The browser app generates GRBL-style NC files for finger-jointed boxes and
drawer trays. Project data, previews, simulation, and NC output are handled in
the browser:

- Project save/load: JSON upload/download.
- NC output: generated in memory and downloaded as `.nc` or `.gcode`.
- Preview: browser-rendered stock sheets, panel outlines, joints, relief cuts,
  holding tabs, and assembled geometry.
- Simulation: parse generated NC text in-browser and animate the cutter path.
- Deployment: static build suitable for GitHub Pages.

## Key Files

- `code-architecture-guide.md`: code structure, model, CSS, theme, and comment
  rules for ongoing work.
- `adaptive-finger-joint-plan.md`: implementation plan for shared adaptive
  odd-count finger spacing, rotation phase, reliefs, and fit clearance.
- `verification.md`: regression and acceptance checks for the app.
