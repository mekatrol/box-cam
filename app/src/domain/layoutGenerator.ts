import type { BoxSettings } from './boxSettings';
import type { Panel, Point } from './geometry';
import { panelBounds } from './geometry';

type EdgeMode = 'slot' | 'tab';
type EdgeName = 'top' | 'right' | 'bottom' | 'left';

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
  const panels = [
    createPanel('front', xSize, zSize, ['slot', 'tab', 'tab', 'slot'], settings),
    createPanel('back', xSize, zSize, ['slot', 'tab', 'tab', 'slot'], settings),
    createPanel('left', ySize, zSize, ['tab', 'slot', 'slot', 'tab'], settings),
    createPanel('right', ySize, zSize, ['tab', 'slot', 'slot', 'tab'], settings)
  ];

  if (settings.box_kind === 'box') {
    panels.push(
      createPanel('bottom', xSize, ySize, ['tab', 'tab', 'tab', 'tab'], settings),
      createPanel('top', xSize, ySize, ['slot', 'slot', 'slot', 'slot'], settings)
    );
  } else {
    panels.push(createPanel('bottom', xSize, ySize, ['tab', 'tab', 'tab', 'tab'], settings));
  }

  placePanelsOnStock(panels, settings);
  return panels;
};

const placePanelsOnStock = (panels: Panel[], settings: BoxSettings): void => {
  const stockWidth = settings.stock_width;
  const stockHeight = settings.stock_height;
  const sheetGap = settings.layout_gap * 2.0;
  const margin = Math.max(settings.bit_diameter, settings.relief_diameter) * 0.5;
  let cursorX = margin;
  let cursorY = margin;
  let rowHeight = 0.0;
  let stockIndex = 0;
  let stockOriginX = 0.0;
  const stockOriginY = 0.0;

  for (const panel of panels) {
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
      cursorX = margin;
      cursorY += rowHeight + settings.layout_gap;
      rowHeight = 0.0;
    }

    if (cursorY > margin && cursorY + panelHeight + margin > stockHeight) {
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
  edgeModes: [EdgeMode, EdgeMode, EdgeMode, EdgeMode],
  settings: BoxSettings
): Panel => {
  const [top, right, bottom, left] = edgeModes;
  const outline = [createPoint(0.0, 0.0)];
  outline.push(...horizontalEdge(0.0, 0.0, width, 'top', top, settings).slice(1));
  outline.push(...verticalEdge(width, 0.0, height, 'right', right, settings).slice(1));
  outline.push(...horizontalEdge(width, height, -width, 'bottom', bottom, settings).slice(1));
  outline.push(...verticalEdge(0.0, height, -height, 'left', left, settings).slice(1));

  const firstPoint = outline[0];
  const lastPoint = outline[outline.length - 1];
  if (firstPoint === undefined || lastPoint === undefined) {
    throw new Error(`Cannot create ${name} panel with an empty outline`);
  }
  if (!pointsEqual(lastPoint, firstPoint)) {
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
  edgeName: EdgeName,
  mode: EdgeMode,
  settings: BoxSettings
): Point[] => {
  const sign = length >= 0.0 ? 1.0 : -1.0;
  const normal = edgeName === 'top' ? -1.0 : 1.0;
  return fingerEdge(startX, y, length, sign, 0.0, 0.0, normal, mode, settings);
};

const verticalEdge = (
  x: number,
  startY: number,
  length: number,
  edgeName: EdgeName,
  mode: EdgeMode,
  settings: BoxSettings
): Point[] => {
  const sign = length >= 0.0 ? 1.0 : -1.0;
  const normal = edgeName === 'right' ? 1.0 : -1.0;
  return fingerEdge(x, startY, length, 0.0, sign, normal, 0.0, mode, settings);
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
  settings: BoxSettings
): Point[] => {
  const run = Math.abs(length);
  let fingerCount = Math.max(3, Math.ceil(run / Math.max(settings.finger_width, 1.0)));
  if (fingerCount % 2 === 0) {
    fingerCount += 1;
  }
  const pitch = run / fingerCount;
  const depth = settings.material_thickness;
  const points = [createPoint(startX, startY)];

  for (let index = 0; index < fingerCount; index += 1) {
    const alongA = index * pitch;
    const alongB = (index + 1) * pitch;
    const isRaised = index % 2 === 0;
    let offset = (mode === 'tab' && isRaised) || (mode === 'slot' && !isRaised) ? depth : 0.0;
    offset *= mode === 'tab' ? 1.0 : -1.0;
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

const reliefPoints = (panel: Panel, settings: BoxSettings): Point[] => {
  if (settings.relief_diameter <= 0.0) {
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
