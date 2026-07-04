import { describe, expect, it } from 'vitest';

import { createDefaultBoxSettings, finalCutDepth } from '../domain/boxSettings';
import defaultDrawerProject from './fixtures/default-drawer.boxcreator.json';

describe('box settings', () => {
  it('matches the Python application defaults', () => {
    expect(createDefaultBoxSettings()).toEqual(defaultDrawerProject.settings);
  });

  it('computes final cut depth from material thickness', () => {
    expect(finalCutDepth(createDefaultBoxSettings())).toBeCloseTo(-6.35);
    expect(finalCutDepth({ material_thickness: 9.5 })).toBeCloseTo(-9.85);
  });
});
