# Source Map

## Python Source Modules

| Python module | Role | TypeScript target |
| --- | --- | --- |
| `box_creator/box_settings.py` | CAM settings and derived final cut depth | `src/domain/boxSettings.ts` |
| `box_creator/geometry.py` | Core geometry records | `src/domain/geometry.ts` |
| `box_creator/layout_generator.py` | Panel generation, finger joints, relief points, stock packing | `src/domain/layoutGenerator.ts` |
| `box_creator/gcode_generator.py` | GRBL-style NC generation | `src/domain/gcodeGenerator.ts` |
| `box_creator/nc_simulator.py` | NC parser and toolpath timing | `src/domain/ncSimulator.ts` |
| `box_creator/preview_widget.py` | Qt preview rendering | `src/components/PreviewCanvas.vue` plus rendering helpers |
| `box_creator/app.py` | Desktop wizard, file dialogs, config, timers | Vue components, Pinia/composables, browser file APIs |
| `box_creator/app_config.py` | Desktop config shape | localStorage preference shape |
| `box_creator/file_locations.py` | Native recent paths | omit or replace with recent in-browser project metadata |
| `box_creator/ui_save_state.py` | Desktop window placement | omit; browser controls viewport |

## Preserve Exactly At First

- Numeric defaults from `BoxSettings`.
- The default `final_cut_depth` formula: `-(material_thickness + 0.35)`.
- Finger count calculation and odd-count adjustment.
- Relief point inside-corner detection.
- Stock packing order and sheet spacing.
- NC line order, comments, formatting precision, and GRBL commands.
- Simulator interpretation for generated NC.

## Browser-Specific Replacements

- `QFileDialog` becomes `<input type="file">` and Blob download links.
- `QTimer` and `monotonic()` become `requestAnimationFrame()` or
  `performance.now()`.
- `QPainter` preview drawing becomes Canvas 2D or SVG.
- `QStandardPaths` config becomes localStorage or IndexedDB.
- Window size and monitor placement are not migrated.

## Suggested TypeScript Folders

```text
src/
  components/
    PreviewCanvas.vue
    ProjectControls.vue
    SettingsPanel.vue
    SimulationControls.vue
  domain/
    boxSettings.ts
    geometry.ts
    gcodeGenerator.ts
    layoutGenerator.ts
    ncSimulator.ts
  stores/
    projectStore.ts
  utils/
    browserFiles.ts
    format.ts
  __tests__/
    fixtures/
```
