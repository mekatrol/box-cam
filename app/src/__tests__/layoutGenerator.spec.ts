import { describe, expect, it } from 'vitest';

import { createDefaultBoxSettings, type BoxSettings } from '../domain/boxSettings';
import { type Panel, type Point, panelBounds } from '../domain/geometry';
import { generateLayout } from '../domain/layoutGenerator';

const createSettings = (overrides: Partial<BoxSettings> = {}): BoxSettings => {
  return {
    ...createDefaultBoxSettings(),
    ...overrides
  };
};

const pointsEqual = (first: Point, second: Point): boolean => {
  return first.x === second.x && first.y === second.y;
};

const expectCleanNominalCorner = (panel: Panel, corner: Point): void => {
  const cornerIndex = panel.outline.findIndex((point) => pointsEqual(point, corner));
  expect(cornerIndex).toBeGreaterThanOrEqual(0);

  const previousPoint = panel.outline[cornerIndex - 1] ?? panel.outline[panel.outline.length - 2];
  const nextPoint = panel.outline[cornerIndex + 1] ?? panel.outline[1];

  expect(previousPoint).toBeDefined();
  expect(nextPoint).toBeDefined();
  expect(previousPoint?.x === corner.x || previousPoint?.y === corner.y).toBe(true);
  expect(nextPoint?.x === corner.x || nextPoint?.y === corner.y).toBe(true);
};

const hasHorizontalSegment = (panel: Panel, y: number, startX: number, endX: number): boolean => {
  return panel.outline.some((point, index) => {
    const nextPoint = panel.outline[index + 1];
    if (nextPoint === undefined) {
      return false;
    }

    const segmentStartX = Math.min(point.x, nextPoint.x);
    const segmentEndX = Math.max(point.x, nextPoint.x);
    return point.y === y && nextPoint.y === y && segmentStartX === startX && segmentEndX === endX;
  });
};

const horizontalSegmentsAtY = (panel: Panel, y: number): Array<[number, number]> => {
  const segments: Array<[number, number]> = [];
  for (const [index, point] of panel.outline.entries()) {
    const nextPoint = panel.outline[index + 1];
    if (nextPoint === undefined || point.y !== y || nextPoint.y !== y) {
      continue;
    }

    segments.push([
      Math.min(point.x, nextPoint.x) - panel.origin_x,
      Math.max(point.x, nextPoint.x) - panel.origin_x
    ]);
  }
  return segments;
};

describe('layout generator', () => {
  it('creates the default drawer panels in Python order', () => {
    const panels = generateLayout(createDefaultBoxSettings());

    expect(panels.map((panel) => panel.name)).toEqual(['front', 'back', 'left', 'right', 'bottom']);
    expect(panels).toHaveLength(5);

    for (const panel of panels) {
      const bounds = panelBounds(panel);
      expect(Number.isFinite(bounds.min_x)).toBe(true);
      expect(Number.isFinite(bounds.max_x)).toBe(true);
      expect(Number.isFinite(bounds.min_y)).toBe(true);
      expect(Number.isFinite(bounds.max_y)).toBe(true);
      expect(bounds.max_x).toBeGreaterThan(bounds.min_x);
      expect(bounds.max_y).toBeGreaterThan(bounds.min_y);
      expect(panel.stock_index).toBe(0);
    }
  });

  it('creates the box-with-lid panels in Python order', () => {
    const panels = generateLayout(createSettings({ box_kind: 'box' }));

    expect(panels.map((panel) => panel.name)).toEqual([
      'front',
      'back',
      'left',
      'right',
      'bottom',
      'top'
    ]);
    expect(panels).toHaveLength(6);
  });

  it('preserves finger-joint alternation and relief-point detection', () => {
    const [frontPanel] = generateLayout(
      createSettings({
        size_x: 60.0,
        size_z: 40.0,
        finger_width: 20.0
      })
    );

    expect(frontPanel).toBeDefined();
    expect(frontPanel?.outline.slice(0, 6)).toEqual([
      { x: 1.5875, y: 1.5875 },
      { x: 21.5125, y: 1.5875 },
      { x: 21.5125, y: 7.5875 },
      { x: 41.6625, y: 7.5875 },
      { x: 41.6625, y: 1.5875 },
      { x: 61.5875, y: 1.5875 }
    ]);
    expect(frontPanel?.relief_points.length).toBeGreaterThan(0);
  });

  it('keeps tabbed panel corners as cuttable nominal corners', () => {
    const settings = createSettings({
      size_x: 62.0,
      size_y: 42.0,
      finger_width: 20.0
    });
    const bottomPanel = generateLayout(settings).find((panel) => panel.name === 'bottom');

    expect(bottomPanel).toBeDefined();
    if (bottomPanel === undefined) {
      throw new Error('Expected bottom panel to be generated');
    }

    const corners = [
      { x: bottomPanel.origin_x, y: bottomPanel.origin_y },
      { x: bottomPanel.origin_x + bottomPanel.width, y: bottomPanel.origin_y },
      { x: bottomPanel.origin_x + bottomPanel.width, y: bottomPanel.origin_y + bottomPanel.height },
      { x: bottomPanel.origin_x, y: bottomPanel.origin_y + bottomPanel.height }
    ];

    for (const corner of corners) {
      expectCleanNominalCorner(bottomPanel, corner);
    }

    const topEdgeXPositions = Array.from(
      new Set(
        bottomPanel.outline
          .filter(
            (point) =>
              point.y === bottomPanel.origin_y ||
              point.y === bottomPanel.origin_y - settings.material_thickness
          )
          .map((point) => point.x - bottomPanel.origin_x)
      )
    ).sort((first, second) => first - second);
    const topEdgeFingerWidths = topEdgeXPositions.slice(1).map((position, index) => {
      const previousPosition = topEdgeXPositions[index];
      if (previousPosition === undefined) {
        throw new Error('Expected previous finger boundary');
      }
      return position - previousPosition;
    });

    expect(topEdgeFingerWidths).toHaveLength(3);
    for (const fingerWidth of topEdgeFingerWidths) {
      expect(fingerWidth).toBeCloseTo(bottomPanel.width / 3.0);
    }
  });

  it('uses the same active intervals for mating tab and slot edges', () => {
    const settings = createSettings({
      size_x: 60.0,
      size_y: 42.0,
      size_z: 40.0,
      finger_width: 20.0
    });
    const panels = generateLayout(settings);
    const frontPanel = panels.find((panel) => panel.name === 'front');
    const bottomPanel = panels.find((panel) => panel.name === 'bottom');

    expect(frontPanel).toBeDefined();
    expect(bottomPanel).toBeDefined();
    if (frontPanel === undefined || bottomPanel === undefined) {
      throw new Error('Expected front and bottom panels to be generated');
    }

    const activeIntervalStartX = 20.0;
    const activeIntervalEndX = 40.0;
    const slotIntervalStartX = activeIntervalStartX - settings.fit_clearance_mm * 0.5;
    const slotIntervalEndX = activeIntervalEndX + settings.fit_clearance_mm * 0.5;

    // The front top edge is a receiving slot, so the active middle interval
    // cuts inward from the nominal top edge. The bottom top edge is a tab, so
    // the same middle interval protrudes outward for the rotated mating part.
    expect(
      hasHorizontalSegment(
        frontPanel,
        frontPanel.origin_y + settings.material_thickness,
        frontPanel.origin_x + slotIntervalStartX,
        frontPanel.origin_x + slotIntervalEndX
      )
    ).toBe(true);
    expect(
      hasHorizontalSegment(
        bottomPanel,
        bottomPanel.origin_y - settings.material_thickness,
        bottomPanel.origin_x + activeIntervalStartX,
        bottomPanel.origin_x + activeIntervalEndX
      )
    ).toBe(true);
  });

  it('centers finger intervals so each edge side mirrors the other', () => {
    const settings = createSettings({
      size_x: 101.0,
      size_y: 42.0,
      finger_width: 18.0
    });
    const bottomPanel = generateLayout(settings).find((panel) => panel.name === 'bottom');

    expect(bottomPanel).toBeDefined();
    if (bottomPanel === undefined) {
      throw new Error('Expected bottom panel to be generated');
    }

    const protrudingTopFingerSegments = horizontalSegmentsAtY(
      bottomPanel,
      bottomPanel.origin_y - settings.material_thickness
    );

    expect(protrudingTopFingerSegments).toHaveLength(3);
    const [leftFinger, centerFinger, rightFinger] = protrudingTopFingerSegments;
    if (leftFinger === undefined || centerFinger === undefined || rightFinger === undefined) {
      throw new Error('Expected left, center, and right finger segments');
    }

    expect(leftFinger[0]).toBeCloseTo(bottomPanel.width - rightFinger[1]);
    expect(leftFinger[1]).toBeCloseTo(bottomPanel.width - rightFinger[0]);
    expect(centerFinger[0] + centerFinger[1]).toBeCloseTo(bottomPanel.width);
  });

  it('packs panels onto additional stock sheets when required', () => {
    const panels = generateLayout(
      createSettings({
        stock_width: 190.0,
        stock_height: 120.0
      })
    );

    expect(new Set(panels.map((panel) => panel.stock_index)).size).toBeGreaterThan(1);
    expect(panels.some((panel) => panel.stock_origin_x > 0.0)).toBe(true);
  });

  it('throws a useful error when a panel cannot fit on the stock', () => {
    expect(() =>
      generateLayout(
        createSettings({
          stock_width: 80.0,
          stock_height: 80.0
        })
      )
    ).toThrow('front panel does not fit on 80.000 x 80.000 mm stock');
  });
});
