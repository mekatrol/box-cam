import { effectiveReliefDiameter, type BoxSettings } from './boxSettings';
import {
  createFingerJointPlan,
  type FingerJointPlan,
  type FingerJointSpacing,
  isJointFeatureInterval,
  type PanelEdgeName
} from './fingerJointPlan';
import type { Panel, Point } from './geometry';
import { panelBounds } from './geometry';

enum EdgeMode {
  Slot,
  Tab
}

type PanelEdgeModes = [EdgeMode, EdgeMode, EdgeMode, EdgeMode];
type PanelEdgeSpacings = [
  FingerJointSpacing,
  FingerJointSpacing,
  FingerJointSpacing,
  FingerJointSpacing
];

const createPoint = (x: number, y: number): Point => {
  return { x, y };
};

const pointsEqual = (first: Point, second: Point): boolean => {
  return first.x === second.x && first.y === second.y;
};

export const generateLayout = (settings: BoxSettings): Panel[] => {
  const xSize = settings.size_x;
  const ySize = settings.size_y;
  const zSize = settings.size_z;
  const fingerJointPlan = createFingerJointPlan(settings);
  // Each panel edge is described clockwise as top, right, bottom, left. Matching
  // box edges must use opposite geometry: a tabbed edge protrudes by material
  // thickness, while the mating slot edge cuts inward by the same amount.
  const panels = [
    createPanel(
      'front',
      xSize,
      zSize,
      [EdgeMode.Slot, EdgeMode.Tab, EdgeMode.Tab, EdgeMode.Slot],
      edgeSpacings(fingerJointPlan, 'x', 'z', 'x', 'z'),
      settings
    ),
    createPanel(
      'back',
      xSize,
      zSize,
      [EdgeMode.Slot, EdgeMode.Tab, EdgeMode.Tab, EdgeMode.Slot],
      edgeSpacings(fingerJointPlan, 'x', 'z', 'x', 'z'),
      settings
    ),
    createPanel(
      'left',
      ySize,
      zSize,
      [EdgeMode.Tab, EdgeMode.Slot, EdgeMode.Slot, EdgeMode.Tab],
      edgeSpacings(fingerJointPlan, 'y', 'z', 'y', 'z'),
      settings
    ),
    createPanel(
      'right',
      ySize,
      zSize,
      [EdgeMode.Tab, EdgeMode.Slot, EdgeMode.Slot, EdgeMode.Tab],
      edgeSpacings(fingerJointPlan, 'y', 'z', 'y', 'z'),
      settings
    )
  ];

  if (settings.box_kind === 'box') {
    panels.push(
      createPanel(
        'bottom',
        xSize,
        ySize,
        [EdgeMode.Tab, EdgeMode.Tab, EdgeMode.Tab, EdgeMode.Tab],
        edgeSpacings(fingerJointPlan, 'x', 'y', 'x', 'y'),
        settings
      ),
      createPanel(
        'top',
        xSize,
        ySize,
        [EdgeMode.Slot, EdgeMode.Slot, EdgeMode.Slot, EdgeMode.Slot],
        edgeSpacings(fingerJointPlan, 'x', 'y', 'x', 'y'),
        settings
      )
    );
  } else {
    panels.push(
      createPanel(
        'bottom',
        xSize,
        ySize,
        [EdgeMode.Tab, EdgeMode.Tab, EdgeMode.Tab, EdgeMode.Tab],
        edgeSpacings(fingerJointPlan, 'x', 'y', 'x', 'y'),
        settings
      )
    );
  }

  placePanelsOnStock(panels, settings);
  return panels;
};

const placePanelsOnStock = (panels: Panel[], settings: BoxSettings): void => {
  const stockWidth = settings.stock_width;
  const stockHeight = settings.stock_height;
  const sheetGap = settings.layout_gap * 2.0;
  const margin = Math.max(settings.bit_diameter, effectiveReliefDiameter(settings)) * 0.5;
  let cursorX = margin;
  let cursorY = margin;
  let rowHeight = 0.0;
  let stockIndex = 0;
  let stockOriginX = 0.0;
  const stockOriginY = 0.0;

  for (const panel of panels) {
    // Panel bounds include protruding fingers, so packing uses the actual cut
    // outline rather than nominal width and height. The margin keeps the cutter
    // radius and relief drill diameter away from the physical stock edge.
    const bounds = panelBounds(panel);
    const panelWidth = bounds.max_x - bounds.min_x;
    const panelHeight = bounds.max_y - bounds.min_y;

    if (panelWidth + margin * 2.0 > stockWidth || panelHeight + margin * 2.0 > stockHeight) {
      throw new Error(
        `${panel.name} panel does not fit on ${stockWidth.toFixed(3)} x ${stockHeight.toFixed(
          3
        )} mm stock`
      );
    }

    if (cursorX > margin && cursorX + panelWidth + margin > stockWidth) {
      // Start a new row when the next panel would cross the right-hand stock
      // margin. Row height is based on the tallest outline in the current row.
      cursorX = margin;
      cursorY += rowHeight + settings.layout_gap;
      rowHeight = 0.0;
    }

    if (cursorY > margin && cursorY + panelHeight + margin > stockHeight) {
      // Additional stock sheets are laid out to the right in one continuous
      // coordinate space. G-code generation later emits pauses per sheet.
      stockIndex += 1;
      stockOriginX += stockWidth + sheetGap;
      cursorX = margin;
      cursorY = margin;
      rowHeight = 0.0;
    }

    movePanel(panel, cursorX - bounds.min_x, cursorY - bounds.min_y);
    assignStock(panel, stockIndex, stockOriginX, stockOriginY);
    cursorX += panelWidth + settings.layout_gap;
    rowHeight = Math.max(rowHeight, panelHeight);
  }
};

const createPanel = (
  name: string,
  width: number,
  height: number,
  edgeModes: PanelEdgeModes,
  edgeSpacing: PanelEdgeSpacings,
  settings: BoxSettings
): Panel => {
  const [top, right, bottom, left] = edgeModes;
  const [topSpacing, rightSpacing, bottomSpacing, leftSpacing] = edgeSpacing;
  // The outline is generated clockwise from the nominal top-left corner. Each
  // edge helper returns its starting point, so every appended edge drops that
  // duplicate start point to avoid zero-length segments in the cutter path.
  const outline = [createPoint(0.0, 0.0)];
  outline.push(...horizontalEdge(0.0, 0.0, width, 'top', top, topSpacing, settings).slice(1));
  outline.push(
    ...verticalEdge(width, 0.0, height, 'right', right, rightSpacing, settings).slice(1)
  );
  outline.push(
    ...horizontalEdge(width, height, -width, 'bottom', bottom, bottomSpacing, settings).slice(1)
  );
  outline.push(...verticalEdge(0.0, height, -height, 'left', left, leftSpacing, settings).slice(1));

  const firstPoint = outline[0];
  const lastPoint = outline[outline.length - 1];
  if (firstPoint === undefined || lastPoint === undefined) {
    throw new Error(`Cannot create ${name} panel with an empty outline`);
  }
  if (!pointsEqual(lastPoint, firstPoint)) {
    // Explicitly close the polygon. Downstream relief detection, drawing, and
    // cutter-offset code all expect the first and last outline points to match.
    outline.push(firstPoint);
  }

  const panel: Panel = {
    name,
    width,
    height,
    origin_x: 0.0,
    origin_y: 0.0,
    outline,
    relief_points: [],
    stock_index: 0,
    stock_origin_x: 0.0,
    stock_origin_y: 0.0
  };
  panel.relief_points = reliefPoints(panel, settings);
  return panel;
};

const horizontalEdge = (
  startX: number,
  y: number,
  length: number,
  edgeName: PanelEdgeName,
  mode: EdgeMode,
  spacing: FingerJointSpacing,
  settings: BoxSettings
): Point[] => {
  const sign = length >= 0.0 ? 1.0 : -1.0;
  // Horizontal top fingers protrude upward on the drawing, which is negative Y
  // in the layout coordinate system. Bottom fingers protrude downward.
  const normal = edgeName === 'top' ? -1.0 : 1.0;
  return fingerEdge(startX, y, length, sign, 0.0, 0.0, normal, mode, spacing, settings);
};

const verticalEdge = (
  x: number,
  startY: number,
  length: number,
  edgeName: PanelEdgeName,
  mode: EdgeMode,
  spacing: FingerJointSpacing,
  settings: BoxSettings
): Point[] => {
  const sign = length >= 0.0 ? 1.0 : -1.0;
  // Vertical right fingers protrude toward positive X. Left fingers protrude
  // toward negative X so the outside of the panel remains outside the box.
  const normal = edgeName === 'right' ? 1.0 : -1.0;
  return fingerEdge(x, startY, length, 0.0, sign, normal, 0.0, mode, spacing, settings);
};

const fingerEdge = (
  startX: number,
  startY: number,
  length: number,
  directionX: number,
  directionY: number,
  normalX: number,
  normalY: number,
  mode: EdgeMode,
  spacing: FingerJointSpacing,
  settings: BoxSettings
): Point[] => {
  const run = Math.abs(length);
  const fingerCount = spacing.fingerIntervalCount;
  const pitch = spacing.resolvedFingerPitchMm;
  const depth = settings.material_thickness;
  const halfSlotClearance = Math.max(settings.fit_clearance_mm, 0.0) * 0.5;
  const points = [createPoint(startX, startY)];

  for (let index = 0; index < fingerCount; index += 1) {
    // The spacing phase is defined against the physical box edge. Tab and slot
    // edges use the same active intervals; the edge mode turns those intervals
    // into either protruding fingers or receiving recesses after rotation.
    const hasJointFeature = isJointFeatureInterval(index, spacing.jointFeaturePhase);
    const [alongA, alongB] = intervalBounds(
      index,
      fingerCount,
      pitch,
      run,
      mode,
      spacing,
      halfSlotClearance,
      hasJointFeature
    );
    const offset = hasJointFeature ? (mode === EdgeMode.Tab ? depth : -depth) : 0.0;
    const pointA = createPoint(
      startX + directionX * alongA + normalX * offset,
      startY + directionY * alongA + normalY * offset
    );
    const pointB = createPoint(
      startX + directionX * alongB + normalX * offset,
      startY + directionY * alongB + normalY * offset
    );
    const lastPoint = points[points.length - 1];
    if (lastPoint === undefined || !pointsEqual(lastPoint, pointA)) {
      points.push(pointA);
    }
    points.push(pointB);
  }

  const endPoint = createPoint(startX + directionX * run, startY + directionY * run);
  const lastPoint = points[points.length - 1];
  if (lastPoint === undefined || !pointsEqual(lastPoint, endPoint)) {
    points.push(endPoint);
  }
  return points;
};

const intervalBounds = (
  index: number,
  fingerCount: number,
  pitch: number,
  run: number,
  mode: EdgeMode,
  spacing: FingerJointSpacing,
  halfSlotClearance: number,
  hasJointFeature: boolean
): [number, number] => {
  const [centeredAlongA, centeredAlongB] = centeredIntervalBounds(index, fingerCount, pitch, run);
  let alongA = centeredAlongA;
  let alongB = centeredAlongB;
  if (mode !== EdgeMode.Slot || halfSlotClearance <= 0.0) {
    return [alongA, alongB];
  }

  if (hasJointFeature) {
    alongA = Math.max(0.0, alongA - halfSlotClearance);
    alongB = Math.min(run, alongB + halfSlotClearance);
  } else {
    const previousIsSlot =
      index > 0 && isJointFeatureInterval(index - 1, spacing.jointFeaturePhase);
    const nextIsSlot =
      index < fingerCount - 1 && isJointFeatureInterval(index + 1, spacing.jointFeaturePhase);
    if (previousIsSlot) {
      alongA = Math.min(run, alongA + halfSlotClearance);
    }
    if (nextIsSlot) {
      alongB = Math.max(0.0, alongB - halfSlotClearance);
    }
  }

  return alongA <= alongB ? [alongA, alongB] : [(alongA + alongB) * 0.5, (alongA + alongB) * 0.5];
};

const centeredIntervalBounds = (
  index: number,
  fingerCount: number,
  pitch: number,
  run: number
): [number, number] => {
  const edgeCenter = run * 0.5;
  const centerIntervalIndex = (fingerCount - 1) * 0.5;
  const start = edgeCenter + (index - centerIntervalIndex - 0.5) * pitch;
  const end = edgeCenter + (index - centerIntervalIndex + 0.5) * pitch;
  return [clampToEdge(start, run), clampToEdge(end, run)];
};

const clampToEdge = (position: number, run: number): number => {
  const tolerance = 0.000000001;
  if (Math.abs(position) < tolerance) {
    return 0.0;
  }
  if (Math.abs(position - run) < tolerance) {
    return run;
  }
  return position;
};

const edgeSpacings = (
  fingerJointPlan: FingerJointPlan,
  topAxis: keyof FingerJointPlan,
  rightAxis: keyof FingerJointPlan,
  bottomAxis: keyof FingerJointPlan,
  leftAxis: keyof FingerJointPlan
): PanelEdgeSpacings => {
  return [
    fingerJointPlan[topAxis].spacing,
    fingerJointPlan[rightAxis].spacing,
    fingerJointPlan[bottomAxis].spacing,
    fingerJointPlan[leftAxis].spacing
  ];
};

const reliefPoints = (panel: Panel, settings: BoxSettings): Point[] => {
  if (effectiveReliefDiameter(settings) <= 0.0) {
    return [];
  }

  const tolerance = 0.001;
  const firstPoint = panel.outline[0];
  const lastPoint = panel.outline[panel.outline.length - 1];
  const outline =
    firstPoint !== undefined && lastPoint !== undefined && pointsEqual(lastPoint, firstPoint)
      ? panel.outline.slice(0, -1)
      : panel.outline;

  if (outline.length < 3) {
    return [];
  }

  const orientation = signedArea(outline);
  if (Math.abs(orientation) < tolerance) {
    return [];
  }

  const points: Point[] = [];
  for (const [index, point] of outline.entries()) {
    const previousPoint = outline[index - 1] ?? outline[outline.length - 1];
    const nextPoint = outline[(index + 1) % outline.length];
    if (previousPoint === undefined || nextPoint === undefined) {
      throw new Error('Cannot inspect relief corner without adjacent outline points');
    }

    const turn = turnCross(previousPoint, point, nextPoint);
    // Relief cuts are added only at inside corners, where a round cutter would
    // otherwise leave material that prevents finger joints from seating fully.
    const isInsideCorner = orientation > 0.0 ? turn < -tolerance : turn > tolerance;
    if (isInsideCorner && !points.some((existingPoint) => pointsEqual(existingPoint, point))) {
      points.push(point);
    }
  }
  return points;
};

const signedArea = (outline: Point[]): number => {
  let area = 0.0;
  for (const [index, start] of outline.entries()) {
    const end = outline[(index + 1) % outline.length];
    if (end === undefined) {
      throw new Error('Cannot compute signed area without a closed outline');
    }
    area += start.x * end.y - end.x * start.y;
  }
  return area * 0.5;
};

const turnCross = (previousPoint: Point, point: Point, nextPoint: Point): number => {
  const incomingX = point.x - previousPoint.x;
  const incomingY = point.y - previousPoint.y;
  const outgoingX = nextPoint.x - point.x;
  const outgoingY = nextPoint.y - point.y;
  return incomingX * outgoingY - incomingY * outgoingX;
};

const movePanel = (panel: Panel, offsetX: number, offsetY: number): void => {
  panel.outline = panel.outline.map((point) => createPoint(point.x + offsetX, point.y + offsetY));
  panel.relief_points = panel.relief_points.map((point) =>
    createPoint(point.x + offsetX, point.y + offsetY)
  );
  panel.origin_x += offsetX;
  panel.origin_y += offsetY;
};

const assignStock = (
  panel: Panel,
  stockIndex: number,
  stockOriginX: number,
  stockOriginY: number
): void => {
  movePanel(panel, stockOriginX, stockOriginY);
  panel.stock_index = stockIndex;
  panel.stock_origin_x = stockOriginX;
  panel.stock_origin_y = stockOriginY;
};
