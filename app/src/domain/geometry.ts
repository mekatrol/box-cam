export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  start: Point;
  end: Point;
}

export interface Panel {
  name: string;
  width: number;
  height: number;
  // Panel origins are stored in the global layout coordinate system. Stock
  // origins record which physical sheet the panel belongs to when a job needs
  // more than one stock sheet.
  origin_x: number;
  origin_y: number;
  outline: Point[];
  // Relief points mark inside corners where a round cutter cannot create a
  // square internal corner without an extra clearance cut.
  relief_points: Point[];
  stock_index: number;
  stock_origin_x: number;
  stock_origin_y: number;
}

export interface PanelBounds {
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
}

export const panelBounds = (panel: Pick<Panel, 'outline'>): PanelBounds => {
  if (panel.outline.length === 0) {
    throw new Error('Cannot compute bounds for a panel with an empty outline');
  }

  // Bounds come from the generated outline rather than nominal width/height
  // because finger joints and relief cuts can extend outside the simple panel
  // rectangle used by the settings form.
  const xs = panel.outline.map((point) => point.x);
  const ys = panel.outline.map((point) => point.y);

  return {
    min_x: Math.min(...xs),
    max_x: Math.max(...xs),
    min_y: Math.min(...ys),
    max_y: Math.max(...ys)
  };
};
