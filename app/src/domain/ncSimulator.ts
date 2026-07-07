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

export interface ElapsedPosition {
  segment_index: number;
  segment_ratio: number;
  position: ToolPosition | undefined;
}

const wordPattern = /([A-Z])\s*([-+]?\d+(?:\.\d*)?|\.\d+)/g;
const stockCommentPattern = /\bstock\s+sheet\s+(\d+)\b/i;

export const parseNcProgram = (
  text: string,
  stockOrigins: Map<number, [number, number]> = new Map(),
  rapidRate = 3000.0
): SimulatorProgram => {
  let xPosition = 0.0;
  let yPosition = 0.0;
  let zPosition = 0.0;
  let feedRate = 1.0;
  let spindleSpeed = 0;
  let activeMotion: MotionSegment['command'] = 'G0';
  let activeStockIndex = 0;
  let absolutePositioning = true;
  let metricUnits = true;
  const segments: MotionSegment[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const commentText = [...rawLine.matchAll(/\((.*?)\)/g)]
      .map((match) => match[1] ?? '')
      .join(' ');
    const stockMatch = stockCommentPattern.exec(commentText);
    if (stockMatch?.[1] !== undefined) {
      activeStockIndex = Math.max(0, Number.parseInt(stockMatch[1], 10) - 1);
    }

    const line =
      rawLine
        .replace(/\(.*?\)/g, '')
        .split(';', 1)[0]
        ?.trim()
        .toUpperCase() ?? '';
    if (!line || line === '%' || line === '/') {
      continue;
    }

    const words = [...line.matchAll(wordPattern)].map(
      (match) => [match[1] ?? '', Number.parseFloat(match[2] ?? '0')] as const
    );
    if (words.length === 0) {
      continue;
    }

    let sawAxisWord = false;
    let nextX = xPosition;
    let nextY = yPosition;
    let nextZ = zPosition;
    let nextMotion: MotionSegment['command'] = activeMotion;

    for (const [letter, rawValue] of words) {
      if (letter === 'G') {
        const code = Math.trunc(rawValue);
        if (code === 0 || code === 1) {
          nextMotion = `G${code}`;
        } else if (code === 20) {
          metricUnits = false;
        } else if (code === 21) {
          metricUnits = true;
        } else if (code === 90) {
          absolutePositioning = true;
        } else if (code === 91) {
          absolutePositioning = false;
        }
      } else if (letter === 'F') {
        feedRate = Math.max(1.0, toMillimetres(rawValue, metricUnits));
      } else if (letter === 'S') {
        spindleSpeed = Math.max(0, Math.trunc(rawValue));
      } else if (letter === 'X' || letter === 'Y' || letter === 'Z') {
        sawAxisWord = true;
        const value = toMillimetres(rawValue, metricUnits);
        if (letter === 'X') {
          nextX = absolutePositioning ? value : xPosition + value;
        } else if (letter === 'Y') {
          nextY = absolutePositioning ? value : yPosition + value;
        } else {
          nextZ = absolutePositioning ? value : zPosition + value;
        }
      }
    }

    activeMotion = nextMotion;
    if (!sawAxisWord) {
      continue;
    }

    const start = withStockOrigin(
      { x: xPosition, y: yPosition, z: zPosition },
      activeStockIndex,
      stockOrigins
    );
    const end = withStockOrigin({ x: nextX, y: nextY, z: nextZ }, activeStockIndex, stockOrigins);
    const moveDistance = distance(start, end);
    xPosition = nextX;
    yPosition = nextY;
    zPosition = nextZ;
    if (moveDistance <= 0.0001) {
      continue;
    }

    const moveRate = activeMotion === 'G0' ? rapidRate : feedRate;
    segments.push({
      start,
      end,
      command: activeMotion,
      feed_rate: moveRate,
      spindle_speed: spindleSpeed,
      duration_seconds: (moveDistance / Math.max(moveRate, 1.0)) * 60.0,
      stock_index: activeStockIndex
    });
  }

  return {
    segments,
    total_seconds: segments.reduce((total, segment) => total + segment.duration_seconds, 0.0)
  };
};

export const positionAtElapsed = (
  segments: MotionSegment[],
  elapsedSeconds: number
): ElapsedPosition => {
  if (segments.length === 0) {
    return { segment_index: 0, segment_ratio: 0.0, position: undefined };
  }

  let remainingSeconds = Math.max(0.0, elapsedSeconds);
  for (const [index, segment] of segments.entries()) {
    if (remainingSeconds <= segment.duration_seconds) {
      const ratio =
        segment.duration_seconds > 0.0 ? remainingSeconds / segment.duration_seconds : 1.0;
      return {
        segment_index: index,
        segment_ratio: ratio,
        position: interpolate(segment.start, segment.end, ratio)
      };
    }
    remainingSeconds -= segment.duration_seconds;
  }

  const lastSegment = segments[segments.length - 1];
  return {
    segment_index: segments.length - 1,
    segment_ratio: 1.0,
    position: lastSegment?.end
  };
};

const withStockOrigin = (
  position: ToolPosition,
  stockIndex: number,
  stockOrigins: Map<number, [number, number]>
): ToolPosition => {
  const [originX, originY] = stockOrigins.get(stockIndex) ?? [0.0, 0.0];
  return { x: position.x + originX, y: position.y + originY, z: position.z };
};

const toMillimetres = (value: number, metricUnits: boolean): number => {
  return metricUnits ? value : value * 25.4;
};

const distance = (start: ToolPosition, end: ToolPosition): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const interpolate = (
  start: ToolPosition,
  end: ToolPosition,
  ratio: number
): ToolPosition => {
  const clamped = Math.max(0.0, Math.min(1.0, ratio));
  return {
    x: start.x + (end.x - start.x) * clamped,
    y: start.y + (end.y - start.y) * clamped,
    z: start.z + (end.z - start.z) * clamped
  };
};
