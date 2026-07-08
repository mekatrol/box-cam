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

  // Finger joints need an odd interval count so the physical corner condition
  // at one end of an edge matches the other end. The current CAM behavior bumps
  // an even rounded count upward, which avoids wider-than-requested fingers.
  let fingerIntervalCount = Math.max(
    minimumFingerIntervalCount,
    Math.round(positiveEdgeLengthMm / safeTargetFingerWidthMm)
  );
  if (fingerIntervalCount % 2 === 0) {
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
