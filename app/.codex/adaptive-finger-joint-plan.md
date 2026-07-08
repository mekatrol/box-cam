# Adaptive Finger Joint Plan

This plan tracks the move from per-edge fixed target finger sizing to a
box-level adaptive layout that keeps mating edges symmetric, odd-counted, and
CNC-cuttable.

## Goals

- Use a target finger size as a preference, not a fixed pitch.
- Resolve every box edge to an odd integer interval count.
- Share the resolved pitch across every pair of mating edges.
- Preserve opposite tab/slot phases so panels interlock after rotation.
- Keep bottom and lid edges orientation-safe for all four walls.
- Apply CNC allowances explicitly: cutter relief and fit clearance.
- Keep the implementation in small, testable increments.

## Current Baseline

- `src/domain/layoutGenerator.ts` already computes an odd finger count for each
  generated edge and derives the exact pitch from the nominal edge length.
- The current calculation is local to one edge. It does not yet expose a
  box-level edge plan that proves intersecting or mating panel edges use the
  same resolved pitch and phase.
- Relief points are currently detected from inside outline corners, but the plan
  does not yet distinguish dog-bone versus T-bone strategy or relate relief size
  directly to cutter diameter.
- Fit clearance is not represented as a first-class box setting.

## Chunk 1: Edge Plan Model

Status: pending

Create a small domain model for resolved joint layout before generating panel
outlines.

- Add descriptive types for logical box edges, panel edge references, phase, and
  resolved finger spacing.
- Keep names physical and explicit, for example `resolvedFingerPitchMm`,
  `startsWithFinger`, and `matingPanelEdges`.
- Define one source of truth for odd-count selection:
  - divide nominal edge length by target finger width;
  - round to the nearest integer;
  - force the result to an odd integer;
  - clamp to the minimum practical odd count, currently `3`;
  - derive exact pitch from nominal edge length divided by that count.
- Unit-test short, exact, and uneven lengths so the odd-count rule is locked
  before outline generation changes.

## Chunk 2: Shared Spacing Across Mating Edges

Status: pending

Build a box-level resolver that maps each physical joint run to all panel edges
that must share pitch.

- Group edges by real box dimension:
  - X-length edges use `size_x`;
  - Y-length edges use `size_y`;
  - Z-height edges use `size_z`.
- Ensure mating edges use the same resolved interval count and pitch rather than
  each panel recomputing independently.
- Make the bottom panel edges share their spacing with the lower edges of all
  four wall panels.
- For box-with-lid mode, make lid edges follow the same orientation contract as
  the bottom while preserving the intended tab/slot direction.
- Add tests that compare extracted boundary positions for each mating pair,
  including variable `size_x`, `size_y`, and `size_z` values.

## Chunk 3: Rotation And Phase Contract

Status: pending

Make the interlock phase explicit instead of relying on local edge order.

- Define whether each resolved edge starts with material or starts with a recess.
- Invert the phase for mating panel edges, so a protruding finger always meets a
  receiving gap.
- Document the rotation rule near the resolver: a flat drawing edge may run in
  the opposite direction from the assembled box edge, so phase must be assigned
  against the physical box edge, not just the outline point order.
- Add tests for all four corners to prove the first and last intervals mate
  correctly after rotation.

## Chunk 4: CNC Relief Strategy

Status: pending

Turn relief handling into an explicit CNC contract.

- Decide whether the app generates dog-bone, T-bone, or selectable reliefs.
- Size relief cuts from cutter geometry:
  - minimum radius is `bit_diameter / 2`;
  - `relief_diameter` may remain as an override if it is larger;
  - reject or warn on relief smaller than the cutter radius when it would not
    clear an inside corner.
- Keep relief points on true inside corners only, because outside corners do not
  block assembly.
- Add tests for relief count and placement on tab and slot edges.
- Update preview rendering if the chosen relief style needs more than point
  markers.

## Chunk 5: Kerf And Fit Clearance

Status: pending

Add fit clearance as a first-class setting before changing generated NC.

- Add a setting such as `fit_clearance_mm`, defaulting conservatively around
  `0.15`.
- Apply clearance to slot/recess dimensions in the geometry stage, not by
  mutating G-code after the outline exists.
- Keep cutter kerf and fit clearance conceptually separate:
  - cutter compensation describes where the tool center travels;
  - fit clearance describes the final assembled joint looseness.
- Unit-test that tabs and matching slots differ by the configured clearance
  while their nominal boundary positions remain aligned.
- Update project JSON fixtures only when the behavior change is intentional and
  documented.

## Chunk 6: UI, Fixtures, And Acceptance

Status: pending

Expose the behavior without making the CAM controls ambiguous.

- Rename the visible `Finger width (mm)` label if needed to show it is a target
  width, not an exact fixed width.
- Add a clearance input only when the geometry and tests are ready.
- Keep existing browser tests current if visible labels, first-screen workflow,
  or generated preview behavior changes.
- Regenerate NC fixtures in the same change that intentionally changes output.
- Run narrow verification first, then the full build:
  - focused layout unit tests;
  - `npm run test:unit -- --run`;
  - `npm run build`.

## Open Decisions

- Whether odd rounding should prefer the nearest odd count, always round up to
  keep fingers no wider than target, or enforce min/max finger pitch limits.
- Whether the relief style should be dog-bone, T-bone, or user-selectable.
- Whether clearance should widen only receiving slots or split the allowance
  between tabs and slots.
- Whether very small panels should allow one finger interval or continue to
  reject/clamp at three intervals.
