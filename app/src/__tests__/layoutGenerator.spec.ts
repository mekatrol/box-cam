import { describe, expect, it } from 'vitest';

import { createDefaultBoxSettings, type BoxSettings } from '../domain/boxSettings';
import { panelBounds } from '../domain/geometry';
import { generateLayout } from '../domain/layoutGenerator';

const createSettings = (overrides: Partial<BoxSettings> = {}): BoxSettings => {
  return {
    ...createDefaultBoxSettings(),
    ...overrides
  };
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
      { x: 21.5875, y: 1.5875 },
      { x: 21.5875, y: 7.5875 },
      { x: 41.5875, y: 7.5875 },
      { x: 41.5875, y: 1.5875 },
      { x: 61.5875, y: 1.5875 }
    ]);
    expect(frontPanel?.relief_points.length).toBeGreaterThan(0);
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
