import { describe, expect, it } from 'vitest';

import {
  createDefaultBoxSettings,
  effectiveReliefDiameter,
  finalCutDepth
} from '../domain/boxSettings';
import defaultDrawerProject from './fixtures/default-drawer.boxcreator.json';

describe('box settings', () => {
  it('matches the Python application defaults', () => {
    expect(createDefaultBoxSettings()).toEqual(defaultDrawerProject.settings);
  });

  it('computes final cut depth from material thickness', () => {
    expect(finalCutDepth(createDefaultBoxSettings())).toBeCloseTo(-6.35);
    expect(finalCutDepth({ material_thickness: 9.5 })).toBeCloseTo(-9.85);
  });

  it('keeps relief cuts at least as large as the cutter diameter', () => {
    expect(effectiveReliefDiameter({ bit_diameter: 3.175, relief_diameter: 1.0 })).toBeCloseTo(
      3.175
    );
    expect(effectiveReliefDiameter({ bit_diameter: 3.175, relief_diameter: 4.0 })).toBeCloseTo(4.0);
    expect(effectiveReliefDiameter({ bit_diameter: 3.175, relief_diameter: 0.0 })).toBe(0.0);
  });
});
