import type { BoxSettings } from './boxSettings';

export type BoxDimensionAxis = 'x' | 'y' | 'z';

export type PanelEdgeName = 'top' | 'right' | 'bottom' | 'left';

export type FingerJointPhase = 'startsOnNominalEdge' | 'startsWithJointFeature';

export interface PanelEdgeReference {
  panelName: string;
  edgeName: PanelEdgeName;
}

export interface FingerJointSpacing {
  nominalEdgeLengthMm: number;
  targetFingerWidthMm: number;
  fingerIntervalCount: number;
  resolvedFingerPitchMm: number;
  jointFeaturePhase: FingerJointPhase;
}

export interface LogicalFingerJointRun {
  dimensionAxis: BoxDimensionAxis;
  nominalEdgeLengthMm: number;
  spacing: FingerJointSpacing;
  matingPanelEdges: PanelEdgeReference[];
}

export type FingerJointPlan = Record<BoxDimensionAxis, LogicalFingerJointRun>;

const minimumFingerIntervalCount = 3;
const minimumTargetFingerWidthMm = 1.0;
const defaultJointFeaturePhase: FingerJointPhase = 'startsOnNominalEdge';

export const resolveFingerJointSpacing = (
  nominalEdgeLengthMm: number,
  targetFingerWidthMm: number
): FingerJointSpacing => {
  const positiveEdgeLengthMm = Math.abs(nominalEdgeLengthMm);
  const safeTargetFingerWidthMm = Math.max(targetFingerWidthMm, minimumTargetFingerWidthMm);

  // Finger joints need a centered active interval and matching nominal corner
  // intervals so both halves of an edge are true mirrors. Valid interval counts
  // are 3, 7, 11, and so on: one center finger, paired fingers moving outward,
  // and nominal material at both corners.
  let fingerIntervalCount = Math.max(
    minimumFingerIntervalCount,
    Math.round(positiveEdgeLengthMm / safeTargetFingerWidthMm)
  );
  while (!hasCenteredOddFingerCount(fingerIntervalCount)) {
    fingerIntervalCount += 1;
  }

  return {
    nominalEdgeLengthMm: positiveEdgeLengthMm,
    targetFingerWidthMm: safeTargetFingerWidthMm,
    fingerIntervalCount,
    resolvedFingerPitchMm: positiveEdgeLengthMm / fingerIntervalCount,
    jointFeaturePhase: defaultJointFeaturePhase
  };
};

const hasCenteredOddFingerCount = (fingerIntervalCount: number): boolean => {
  return fingerIntervalCount % 4 === 3;
};

export const isJointFeatureInterval = (
  intervalIndex: number,
  jointFeaturePhase: FingerJointPhase
): boolean => {
  const startsWithJointFeature = jointFeaturePhase === 'startsWithJointFeature';
  const isEvenInterval = intervalIndex % 2 === 0;
  return startsWithJointFeature ? isEvenInterval : !isEvenInterval;
};

export const createFingerJointPlan = (settings: BoxSettings): FingerJointPlan => {
  return {
    x: createLogicalFingerJointRun('x', settings.size_x, settings.finger_width, [
      { panelName: 'front', edgeName: 'top' },
      { panelName: 'front', edgeName: 'bottom' },
      { panelName: 'back', edgeName: 'top' },
      { panelName: 'back', edgeName: 'bottom' },
      { panelName: 'bottom', edgeName: 'top' },
      { panelName: 'bottom', edgeName: 'bottom' },
      ...optionalPanelEdges(settings.box_kind === 'box', [
        { panelName: 'top', edgeName: 'top' },
        { panelName: 'top', edgeName: 'bottom' }
      ])
    ]),
    y: createLogicalFingerJointRun('y', settings.size_y, settings.finger_width, [
      { panelName: 'left', edgeName: 'top' },
      { panelName: 'left', edgeName: 'bottom' },
      { panelName: 'right', edgeName: 'top' },
      { panelName: 'right', edgeName: 'bottom' },
      { panelName: 'bottom', edgeName: 'right' },
      { panelName: 'bottom', edgeName: 'left' },
      ...optionalPanelEdges(settings.box_kind === 'box', [
        { panelName: 'top', edgeName: 'right' },
        { panelName: 'top', edgeName: 'left' }
      ])
    ]),
    z: createLogicalFingerJointRun('z', settings.size_z, settings.finger_width, [
      { panelName: 'front', edgeName: 'right' },
      { panelName: 'front', edgeName: 'left' },
      { panelName: 'back', edgeName: 'right' },
      { panelName: 'back', edgeName: 'left' },
      { panelName: 'left', edgeName: 'right' },
      { panelName: 'left', edgeName: 'left' },
      { panelName: 'right', edgeName: 'right' },
      { panelName: 'right', edgeName: 'left' }
    ])
  };
};

const createLogicalFingerJointRun = (
  dimensionAxis: BoxDimensionAxis,
  nominalEdgeLengthMm: number,
  targetFingerWidthMm: number,
  matingPanelEdges: PanelEdgeReference[]
): LogicalFingerJointRun => {
  return {
    dimensionAxis,
    nominalEdgeLengthMm,
    spacing: resolveFingerJointSpacing(nominalEdgeLengthMm, targetFingerWidthMm),
    matingPanelEdges
  };
};

const optionalPanelEdges = (
  includeEdges: boolean,
  panelEdges: PanelEdgeReference[]
): PanelEdgeReference[] => {
  return includeEdges ? panelEdges : [];
};
