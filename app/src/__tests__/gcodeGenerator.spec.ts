import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDefaultBoxSettings, type BoxSettings } from '../domain/boxSettings';
import { generateGcode } from '../domain/gcodeGenerator';
import { generateLayout } from '../domain/layoutGenerator';

const fixtureText = (name: string): string => {
  return readFileSync(join(process.cwd(), 'src', '__tests__', 'fixtures', name), 'utf-8');
};

const createSettings = (overrides: Partial<BoxSettings> = {}): BoxSettings => {
  return {
    ...createDefaultBoxSettings(),
    ...overrides
  };
};

describe('gcode generator', () => {
  it('matches the default drawer fixture', () => {
    const settings = createDefaultBoxSettings();

    expect(generateGcode(generateLayout(settings), settings)).toBe(
      fixtureText('default-drawer.nc')
    );
  });

  it('matches the box-with-lid fixture', () => {
    const settings = createSettings({ job_name: 'finger-box-with-lid', box_kind: 'box' });

    expect(generateGcode(generateLayout(settings), settings)).toBe(fixtureText('box-with-lid.nc'));
  });

  it('matches the multi-sheet fixture and includes sheet pauses', () => {
    const settings = createSettings({
      job_name: 'finger-box-multi-sheet',
      stock_width: 210.0,
      stock_height: 130.0
    });
    const generated = generateGcode(generateLayout(settings), settings);

    expect(generated).toBe(fixtureText('multi-sheet.nc'));
    expect(generated).toContain('M0 (load stock sheet 2)');
  });

  it('can omit holding tabs', () => {
    const settings = createSettings({ include_tabs: false });
    const generated = generateGcode(generateLayout(settings), settings);

    expect(generated).toContain('G21\nG90\nG94');
    expect(generated).not.toContain('G1 Z-1.500 F180\nG1 X8.921 Y0.000\nG1 Z-3.000 F180');
  });
});
