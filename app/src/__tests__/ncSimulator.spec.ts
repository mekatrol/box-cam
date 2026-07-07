import { describe, expect, it } from 'vitest';

import { createDefaultBoxSettings } from '../domain/boxSettings';
import { generateGcode } from '../domain/gcodeGenerator';
import { generateLayout } from '../domain/layoutGenerator';
import { isCuttingMove, parseNcProgram, positionAtElapsed } from '../domain/ncSimulator';

describe('NC simulator', () => {
  it('parses generated NC with positive duration', () => {
    const settings = createDefaultBoxSettings();
    const panels = generateLayout(settings);
    const origins = new Map(
      panels.map((panel) => [
        panel.stock_index,
        [panel.stock_origin_x, panel.stock_origin_y] as [number, number]
      ])
    );
    const program = parseNcProgram(generateGcode(panels, settings), origins);

    expect(program.segments.length).toBeGreaterThan(0);
    expect(program.total_seconds).toBeGreaterThan(0);
    expect(program.segments.some(isCuttingMove)).toBe(true);
  });

  it('maps stock sheet comments back to layout origins', () => {
    const program = parseNcProgram(
      '(stock sheet 2)\nG21\nG90\nG0 X10 Y20\n',
      new Map([[1, [210, 0]]])
    );

    expect(program.segments).toHaveLength(1);
    expect(program.segments[0]?.stock_index).toBe(1);
    expect(program.segments[0]?.end).toEqual({ x: 220, y: 20, z: 0 });
  });

  it('supports inch and relative coordinate snippets', () => {
    const program = parseNcProgram('G20\nG91\nG1 X1.0 F60\nG1 Y0.5\n');

    expect(program.segments).toHaveLength(2);
    expect(program.segments[0]?.end.x).toBeCloseTo(25.4);
    expect(program.segments[1]?.end).toEqual({ x: 25.4, y: 12.7, z: 0 });
    expect(program.segments[0]?.feed_rate).toBeCloseTo(1524);
  });

  it('returns interpolated position at elapsed time', () => {
    const program = parseNcProgram('G21\nG90\nG1 X10 F60\nG1 X20\n');
    const halfway = positionAtElapsed(program.segments, 5.0);
    const afterEnd = positionAtElapsed(program.segments, 999.0);

    expect(halfway.segment_index).toBe(0);
    expect(halfway.segment_ratio).toBeCloseTo(0.5);
    expect(halfway.position).toEqual({ x: 5, y: 0, z: 0 });
    expect(afterEnd.segment_index).toBe(1);
    expect(afterEnd.segment_ratio).toBe(1);
    expect(afterEnd.position).toEqual({ x: 20, y: 0, z: 0 });
  });
});
