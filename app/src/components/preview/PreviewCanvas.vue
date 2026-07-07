<template>
  <figure class="preview-surface">
    <canvas ref="canvasElement" aria-label="Cut layout preview"></canvas>
    <figcaption>{{ caption }}</figcaption>
  </figure>
</template>

<script setup lang="ts">
/* global CanvasRenderingContext2D, HTMLCanvasElement, ResizeObserver, window */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { finalCutDepth, type BoxSettings } from '@/domain/boxSettings';
import { isBoundingEdge, tabCountForSegment } from '@/domain/gcodeGenerator';
import { type Panel, type Point, panelBounds } from '@/domain/geometry';
import {
  interpolate,
  isCuttingMove,
  positionAtElapsed,
  type MotionSegment
} from '@/domain/ncSimulator';

const props = defineProps<{
  panels: Panel[];
  settings: BoxSettings;
  mode: 'flat' | 'box' | 'material' | 'joints' | 'tabs' | 'generate' | 'simulate';
  simulationSegments: MotionSegment[];
  simulationElapsedSeconds: number;
  simulationTotalSeconds: number;
  simulationSpeedPercent: number;
}>();

const canvasElement = ref<HTMLCanvasElement>();
let resizeObserver: ResizeObserver | undefined;

const caption = computed(() => {
  const sheetCount = stockSheetCount();
  if (props.mode === 'simulate' && props.simulationSegments.length > 0) {
    return `${formatDuration(props.simulationElapsedSeconds)} / ${formatDuration(props.simulationTotalSeconds)}`;
  }
  return `${props.panels.length} panels on ${sheetCount} stock sheet${sheetCount === 1 ? '' : 's'}`;
});

watch(
  () => [
    props.panels,
    props.settings,
    props.mode,
    props.simulationSegments,
    props.simulationElapsedSeconds,
    props.simulationSpeedPercent
  ],
  () => void nextTick(drawPreview),
  { deep: true }
);

onMounted(() => {
  const canvas = canvasElement.value;
  if (canvas === undefined) {
    return;
  }
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => drawPreview());
    resizeObserver.observe(canvas);
  }
  drawPreview();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

const drawPreview = (): void => {
  const canvas = canvasElement.value;
  if (canvas === undefined) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  const context = canvas.getContext('2d');
  if (context === null) {
    return;
  }
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  context.fillStyle = '#101820';
  context.fillRect(0, 0, rect.width, rect.height);

  if (props.mode === 'box') {
    drawAssembled(context, rect.width, rect.height);
  } else {
    drawFlat(context, rect.width, rect.height);
    if (props.mode === 'simulate') {
      drawSimulation(context, rect.width, rect.height);
    }
  }
};

const drawFlat = (context: CanvasRenderingContext2D, width: number, height: number): void => {
  const transform = viewTransform(layoutBounds(), width, height);
  drawGrid(context, width, height, transform.scale, transform.offsetX, transform.offsetY);
  drawStockSheets(context, transform);

  for (const panel of props.panels) {
    drawPanel(context, panel, transform);
    if (props.mode === 'tabs' || props.mode === 'generate') {
      drawTabs(context, panel, transform);
    }
    const labelPoint = mapPoint(
      { x: panel.origin_x + panel.width * 0.5, y: panel.origin_y + panel.height * 0.5 },
      transform
    );
    context.fillStyle = '#f8fafc';
    context.font = '12px Inter, sans-serif';
    context.textAlign = 'center';
    context.fillText(panel.name, labelPoint.x, labelPoint.y + 4);
  }

  if (props.mode === 'generate') {
    drawSummary(context, width);
  }
};

const drawPanel = (
  context: CanvasRenderingContext2D,
  panel: Panel,
  transform: ViewTransform
): void => {
  if (panel.outline.length === 0) {
    return;
  }
  context.beginPath();
  for (const [index, outlinePoint] of panel.outline.entries()) {
    const mapped = mapPoint(outlinePoint, transform);
    if (index === 0) {
      context.moveTo(mapped.x, mapped.y);
    } else {
      context.lineTo(mapped.x, mapped.y);
    }
  }
  context.closePath();
  context.fillStyle = 'rgb(43 98 83 / 0.64)';
  context.strokeStyle = '#f4c95d';
  context.lineWidth = 1.6;
  context.fill();
  context.stroke();

  if (panel.relief_points.length === 0 || props.settings.relief_diameter <= 0.0) {
    return;
  }
  context.save();
  context.clip();
  context.fillStyle = '#101820';
  context.strokeStyle = '#e8871e';
  context.lineWidth = 1.1;
  const radius =
    Math.max(props.settings.relief_diameter, props.settings.bit_diameter) * transform.scale * 0.5;
  for (const reliefPoint of panel.relief_points) {
    const mapped = mapPoint(reliefPoint, transform);
    context.beginPath();
    context.arc(mapped.x, mapped.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.restore();
};

const drawTabs = (
  context: CanvasRenderingContext2D,
  panel: Panel,
  transform: ViewTransform
): void => {
  if (!props.settings.include_tabs) {
    return;
  }
  context.strokeStyle = '#61a5ff';
  context.lineWidth = 3;
  context.lineCap = 'round';
  for (let index = 0; index < panel.outline.length - 1; index += 1) {
    const start = panel.outline[index];
    const end = panel.outline[index + 1];
    if (start === undefined || end === undefined || !isBoundingEdge(panel, start, end)) {
      continue;
    }
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < props.settings.tab_width * 2.0) {
      continue;
    }
    const tabCount = tabCountForSegment(length, props.settings.tab_width);
    for (let tabIndex = 0; tabIndex < tabCount; tabIndex += 1) {
      const center = (length * (tabIndex + 1)) / (tabCount + 1);
      const tabStart = pointAlongSegment(
        start,
        dx,
        dy,
        length,
        center - props.settings.tab_width * 0.5
      );
      const tabEnd = pointAlongSegment(
        start,
        dx,
        dy,
        length,
        center + props.settings.tab_width * 0.5
      );
      const mappedStart = mapPoint(tabStart, transform);
      const mappedEnd = mapPoint(tabEnd, transform);
      context.beginPath();
      context.moveTo(mappedStart.x, mappedStart.y);
      context.lineTo(mappedEnd.x, mappedEnd.y);
      context.stroke();
    }
  }
  context.lineCap = 'butt';
};

const drawSimulation = (
  context: CanvasRenderingContext2D,
  width: number,
  _height: number
): void => {
  if (props.simulationSegments.length === 0) {
    return;
  }
  const transform = viewTransform(layoutBounds(), width, canvasElement.value?.clientHeight ?? 1);
  const elapsedPosition = positionAtElapsed(
    props.simulationSegments,
    props.simulationElapsedSeconds
  );

  for (const segment of props.simulationSegments) {
    if (segment.command === 'G0') {
      continue;
    }
    context.strokeStyle = isCuttingMove(segment)
      ? 'rgb(232 135 30 / 0.28)'
      : 'rgb(97 165 255 / 0.32)';
    context.lineWidth = isCuttingMove(segment)
      ? Math.max(1.4, props.settings.bit_diameter * transform.scale)
      : 1.2;
    drawToolLine(context, segment.start, segment.end, transform);
  }

  for (const [index, segment] of props.simulationSegments.entries()) {
    if (index > elapsedPosition.segment_index || segment.command === 'G0') {
      break;
    }
    const end =
      index === elapsedPosition.segment_index
        ? interpolate(segment.start, segment.end, elapsedPosition.segment_ratio)
        : segment.end;
    context.strokeStyle = isCuttingMove(segment) ? 'rgb(128 205 118 / 0.70)' : '#80cd76';
    context.lineWidth = isCuttingMove(segment)
      ? Math.max(1.4, props.settings.bit_diameter * transform.scale)
      : 1.6;
    drawToolLine(context, segment.start, end, transform);
  }

  if (elapsedPosition.position !== undefined) {
    const cutter = mapPoint(elapsedPosition.position, transform);
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#101820';
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(
      cutter.x,
      cutter.y,
      Math.max(3, props.settings.bit_diameter * transform.scale * 0.5),
      0,
      Math.PI * 2
    );
    context.fill();
    context.stroke();
  }

  drawOverlay(
    context,
    width,
    `${formatDuration(props.simulationElapsedSeconds)} / ${formatDuration(props.simulationTotalSeconds)}  |  ${props.simulationSpeedPercent}%`
  );
};

const drawAssembled = (context: CanvasRenderingContext2D, width: number, height: number): void => {
  const xSize = props.settings.size_x;
  const ySize = props.settings.size_y;
  const zSize = props.settings.size_z;
  const isoX = ySize * 0.45;
  const isoY = ySize * 0.32;
  const transform = viewTransform([-10, xSize + isoX + 10, -isoY - 10, zSize + 10], width, height);
  drawGrid(context, width, height, transform.scale, transform.offsetX, transform.offsetY);
  const faces = [
    {
      color: 'rgb(77 111 165 / 0.78)',
      points: [
        { x: xSize, y: 0 },
        { x: xSize + isoX, y: -isoY },
        { x: xSize + isoX, y: zSize - isoY },
        { x: xSize, y: zSize }
      ]
    },
    {
      color: 'rgb(96 139 78 / 0.78)',
      points: [
        { x: 0, y: zSize },
        { x: xSize, y: zSize },
        { x: xSize + isoX, y: zSize - isoY },
        { x: isoX, y: zSize - isoY }
      ]
    },
    {
      color: 'rgb(178 111 58 / 0.78)',
      points: [
        { x: 0, y: 0 },
        { x: xSize, y: 0 },
        { x: xSize, y: zSize },
        { x: 0, y: zSize }
      ]
    }
  ];

  for (const face of faces) {
    context.beginPath();
    for (const [index, facePoint] of face.points.entries()) {
      const mapped = mapPoint(facePoint, transform);
      if (index === 0) {
        context.moveTo(mapped.x, mapped.y);
      } else {
        context.lineTo(mapped.x, mapped.y);
      }
    }
    context.closePath();
    context.fillStyle = face.color;
    context.strokeStyle = '#f8fafc';
    context.lineWidth = 1.2;
    context.fill();
    context.stroke();
  }
};

const drawSummary = (context: CanvasRenderingContext2D, width: number): void => {
  drawOverlay(
    context,
    width,
    `${props.panels.length} panels  |  ${stockSheetCount()} sheet${stockSheetCount() === 1 ? '' : 's'}  |  final Z ${finalCutDepth(props.settings).toFixed(3)} mm`
  );
};

const drawOverlay = (context: CanvasRenderingContext2D, width: number, text: string): void => {
  context.fillStyle = 'rgb(16 24 32 / 0.86)';
  context.strokeStyle = '#53616f';
  context.lineWidth = 1;
  context.fillRect(12, 12, width - 24, 28);
  context.strokeRect(12, 12, width - 24, 28);
  context.fillStyle = '#f8fafc';
  context.font = '12px Inter, sans-serif';
  context.textAlign = 'center';
  context.fillText(text, width / 2, 30);
};

const drawStockSheets = (context: CanvasRenderingContext2D, transform: ViewTransform): void => {
  context.fillStyle = 'rgb(18 27 36 / 0.72)';
  context.strokeStyle = '#53616f';
  context.lineWidth = 1.2;
  for (let stockIndex = 0; stockIndex < stockSheetCount(); stockIndex += 1) {
    const originX = stockOriginX(stockIndex);
    const topLeft = mapPoint({ x: originX, y: props.settings.stock_height }, transform);
    const bottomRight = mapPoint({ x: originX + props.settings.stock_width, y: 0 }, transform);
    context.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    context.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    context.fillStyle = '#a9b4bf';
    context.font = '12px Inter, sans-serif';
    context.textAlign = 'left';
    context.fillText(`stock ${stockIndex + 1}`, topLeft.x + 8, topLeft.y + 18);
    context.fillStyle = 'rgb(18 27 36 / 0.72)';
  }
};

const drawGrid = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
  offsetX: number,
  offsetY: number
): void => {
  context.strokeStyle = 'rgb(255 255 255 / 0.055)';
  context.lineWidth = 1;
  const spacing = 25 * scale < 10 ? 50 * scale : 25 * scale;
  for (let x = offsetX % spacing; x < width; x += spacing) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = offsetY % spacing; y < height; y += spacing) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
};

const drawToolLine = (
  context: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  transform: ViewTransform
): void => {
  const mappedStart = mapPoint(start, transform);
  const mappedEnd = mapPoint(end, transform);
  context.beginPath();
  context.moveTo(mappedStart.x, mappedStart.y);
  context.lineTo(mappedEnd.x, mappedEnd.y);
  context.stroke();
};

const layoutBounds = (): Bounds => {
  if (props.panels.length === 0) {
    return [0, props.settings.stock_width, 0, props.settings.stock_height];
  }
  const bounds = props.panels.map(panelBounds);
  const sheetCount = stockSheetCount();
  return [
    Math.min(0, ...bounds.map((bound) => bound.min_x)),
    Math.max(
      stockOriginX(sheetCount - 1) + props.settings.stock_width,
      ...bounds.map((bound) => bound.max_x)
    ),
    Math.min(0, ...bounds.map((bound) => bound.min_y)),
    Math.max(props.settings.stock_height, ...bounds.map((bound) => bound.max_y))
  ];
};

type Bounds = [number, number, number, number];

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const viewTransform = (
  [minX, maxX, minY, maxY]: Bounds,
  width: number,
  height: number
): ViewTransform => {
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.max(0.01, Math.min((width - 42) / spanX, (height - 42) / spanY));
  return {
    scale,
    offsetX: 21 - minX * scale + (width - 42 - spanX * scale) * 0.5,
    offsetY: height - 21 + minY * scale - (height - 42 - spanY * scale) * 0.5
  };
};

const mapPoint = (mappedPoint: Point, transform: ViewTransform): Point => {
  return {
    x: transform.offsetX + mappedPoint.x * transform.scale,
    y: transform.offsetY - mappedPoint.y * transform.scale
  };
};

const pointAlongSegment = (
  start: Point,
  dx: number,
  dy: number,
  length: number,
  distance: number
): Point => {
  const clamped = Math.max(0, Math.min(length, distance));
  const ratio = clamped / length;
  return { x: start.x + dx * ratio, y: start.y + dy * ratio };
};

const stockSheetCount = (): number => {
  if (props.panels.length === 0) {
    return 1;
  }
  return Math.max(...props.panels.map((panel) => panel.stock_index)) + 1;
};

const stockOriginX = (stockIndex: number): number => {
  return (
    props.panels.find((panel) => panel.stock_index === stockIndex)?.stock_origin_x ??
    stockIndex * (props.settings.stock_width + props.settings.layout_gap * 2)
  );
};

const formatDuration = (seconds: number): string => {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0
    ? `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    : `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};
</script>

<style scoped>
.preview-surface {
  min-width: 0;
  min-height: 28rem;
  margin: 0;
  border: 1px solid var(--dg-color-border);
  border-radius: 8px;
  background: #101820;
  overflow: hidden;
  display: grid;
  grid-template-rows: minmax(22rem, 1fr) auto;
}

canvas {
  width: 100%;
  height: 100%;
}

figcaption {
  min-height: 2.25rem;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid rgb(255 255 255 / 9%);
  background: rgb(16 24 32 / 0.96);
  color: #dbe7f3;
  font-size: 0.85rem;
}
</style>
