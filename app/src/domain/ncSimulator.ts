export interface ToolPosition {
  x: number;
  y: number;
  z: number;
}

export interface MotionSegment {
  start: ToolPosition;
  end: ToolPosition;
  // G0 is a rapid positioning move. G1 is a feed-rate controlled linear move,
  // which is the normal G-code command used for cutting once the tool is down.
  command: 'G0' | 'G1';
  feed_rate: number;
  spindle_speed: number;
  duration_seconds: number;
  stock_index: number;
}

export interface SimulatorProgram {
  segments: MotionSegment[];
  total_seconds: number;
}

export const isCuttingMove = (segment: MotionSegment): boolean => {
  // A G1 feed move is only cutting material when either end of the move is at
  // or below Z0, the material surface used by the generated NC program.
  return segment.command === 'G1' && Math.min(segment.start.z, segment.end.z) <= 0.0;
};
