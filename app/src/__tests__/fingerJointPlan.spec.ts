import { describe, expect, it } from 'vitest';

import { createDefaultBoxSettings } from '../domain/boxSettings';
import {
  createFingerJointPlan,
  isJointFeatureInterval,
  resolveFingerJointSpacing
} from '../domain/fingerJointPlan';

describe('finger joint plan', () => {
  it('keeps the interval count odd and derives pitch from the exact edge length', () => {
    const spacing = resolveFingerJointSpacing(62.0, 20.0);

    expect(spacing.fingerIntervalCount).toBe(3);
    expect(spacing.resolvedFingerPitchMm).toBeCloseTo(62.0 / 3.0);
    expect(spacing.jointFeaturePhase).toBe('startsOnNominalEdge');
  });

  it('bumps counts upward until the edge has a centered odd finger count', () => {
    const spacing = resolveFingerJointSpacing(80.0, 20.0);

    expect(spacing.fingerIntervalCount).toBe(7);
    expect(spacing.resolvedFingerPitchMm).toBeCloseTo(80.0 / 7.0);
  });

  it('clamps very short edges to the minimum practical odd interval count', () => {
    const spacing = resolveFingerJointSpacing(12.0, 25.0);

    expect(spacing.fingerIntervalCount).toBe(3);
    expect(spacing.resolvedFingerPitchMm).toBeCloseTo(4.0);
  });

  it('normalizes reversed edges and unsafe target finger widths', () => {
    const spacing = resolveFingerJointSpacing(-10.0, 0.0);

    expect(spacing.nominalEdgeLengthMm).toBe(10.0);
    expect(spacing.targetFingerWidthMm).toBe(1.0);
    expect(spacing.fingerIntervalCount).toBe(11);
    expect(spacing.resolvedFingerPitchMm).toBeCloseTo(10.0 / 11.0);
  });

  it('resolves one shared spacing plan for each physical box dimension', () => {
    const plan = createFingerJointPlan({
      ...createDefaultBoxSettings(),
      size_x: 101.0,
      size_y: 67.0,
      size_z: 43.0,
      finger_width: 18.0,
      box_kind: 'box'
    });

    expect(plan.x.nominalEdgeLengthMm).toBe(101.0);
    expect(plan.y.nominalEdgeLengthMm).toBe(67.0);
    expect(plan.z.nominalEdgeLengthMm).toBe(43.0);
    expect(plan.x.spacing.fingerIntervalCount % 2).toBe(1);
    expect(plan.y.spacing.fingerIntervalCount % 2).toBe(1);
    expect(plan.z.spacing.fingerIntervalCount % 2).toBe(1);
    expect(plan.x.matingPanelEdges).toContainEqual({ panelName: 'front', edgeName: 'bottom' });
    expect(plan.x.matingPanelEdges).toContainEqual({ panelName: 'bottom', edgeName: 'top' });
    expect(plan.y.matingPanelEdges).toContainEqual({ panelName: 'left', edgeName: 'bottom' });
    expect(plan.y.matingPanelEdges).toContainEqual({ panelName: 'bottom', edgeName: 'left' });
    expect(plan.z.matingPanelEdges).toContainEqual({ panelName: 'front', edgeName: 'right' });
    expect(plan.z.matingPanelEdges).toContainEqual({ panelName: 'left', edgeName: 'left' });
  });

  it('makes active joint intervals explicit for each rotation phase', () => {
    expect(isJointFeatureInterval(0, 'startsOnNominalEdge')).toBe(false);
    expect(isJointFeatureInterval(1, 'startsOnNominalEdge')).toBe(true);
    expect(isJointFeatureInterval(2, 'startsOnNominalEdge')).toBe(false);

    expect(isJointFeatureInterval(0, 'startsWithJointFeature')).toBe(true);
    expect(isJointFeatureInterval(1, 'startsWithJointFeature')).toBe(false);
    expect(isJointFeatureInterval(2, 'startsWithJointFeature')).toBe(true);
  });

  it('keeps the default phase centered with mirrored active finger intervals', () => {
    const spacing = resolveFingerJointSpacing(160.0, 12.0);
    const activeIntervalIndexes = Array.from(
      { length: spacing.fingerIntervalCount },
      (_, index) => index
    ).filter((index) => isJointFeatureInterval(index, spacing.jointFeaturePhase));
    const centerIndex = (spacing.fingerIntervalCount - 1) * 0.5;

    expect(spacing.fingerIntervalCount).toBe(15);
    expect(activeIntervalIndexes).toContain(centerIndex);
    expect(activeIntervalIndexes).toEqual([1, 3, 5, 7, 9, 11, 13]);
  });
});
