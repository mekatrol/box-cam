<template>
  <main class="app-shell">
    <header class="top-bar">
      <h1>Box CAM</h1>
      <nav aria-label="Project actions" class="action-row">
        <button type="button" class="secondary-button" @click="newProject">New</button>
        <button type="button" class="secondary-button" @click="openProjectPicker">Open</button>
        <button type="button" class="secondary-button" @click="saveProject">Save Project</button>
        <button type="button" class="primary-button" @click="generateNc">Generate NC</button>
        <button
          type="button"
          class="secondary-button"
          :disabled="generatedNcText.length === 0"
          @click="saveNc"
        >
          Save NC
        </button>
        <input
          ref="fileInput"
          class="file-input"
          type="file"
          accept=".boxcreator.json,.json,application/json"
          @change="openProjectFile"
        />
      </nav>
    </header>

    <section class="status-bar" aria-live="polite">
      <strong>{{ settings.job_name }}</strong>
      <span>{{ statusMessage }}</span>
      <span v-if="isDirty">Unsaved changes</span>
    </section>

    <div class="workspace">
      <aside class="settings-panel" aria-label="CAM settings">
        <section class="settings-group">
          <h2>Box</h2>
          <label>
            Job name
            <input v-model="settings.job_name" type="text" @input="markDirtyAndClearSimulation" />
          </label>
          <label>
            Box type
            <select v-model="settings.box_kind" @change="markDirtyAndClearSimulation">
              <option value="drawer">Drawer tray</option>
              <option value="box">Box with lid</option>
            </select>
          </label>
          <label v-for="field in boxFields" :key="field.key">
            {{ field.label }}
            <input
              v-model.number="settings[field.key]"
              type="number"
              min="0.001"
              step="0.001"
              @input="markDirtyAndClearSimulation"
            />
          </label>
        </section>

        <section class="settings-group">
          <h2>Material</h2>
          <label v-for="field in materialFields" :key="field.key">
            {{ field.label }}
            <input
              v-model.number="settings[field.key]"
              type="number"
              min="0.001"
              step="0.001"
              @input="markDirtyAndClearSimulation"
            />
          </label>
        </section>

        <section class="settings-group">
          <h2>Joints</h2>
          <label v-for="field in jointFields" :key="field.key">
            {{ field.label }}
            <input
              v-model.number="settings[field.key]"
              type="number"
              min="0.001"
              step="0.001"
              @input="markDirtyAndClearSimulation"
            />
          </label>
        </section>

        <section class="settings-group">
          <h2>Tabs</h2>
          <label class="toggle-row">
            <input
              v-model="settings.include_tabs"
              type="checkbox"
              @change="markDirtyAndClearSimulation"
            />
            Holding tabs
          </label>
          <label v-for="field in tabFields" :key="field.key">
            {{ field.label }}
            <input
              v-model.number="settings[field.key]"
              type="number"
              min="0.001"
              step="0.001"
              @input="markDirtyAndClearSimulation"
            />
          </label>
        </section>

        <section class="settings-group">
          <h2>Cut</h2>
          <label v-for="field in cutFields" :key="field.key">
            {{ field.label }}
            <input
              v-model.number="settings[field.key]"
              type="number"
              min="1"
              step="1"
              @input="markDirtyAndClearSimulation"
            />
          </label>
        </section>
      </aside>

      <section class="preview-panel" aria-label="Preview and simulation">
        <div class="preview-toolbar">
          <label>
            Preview
            <select v-model="previewMode">
              <option value="flat">Flat layout</option>
              <option value="box">Assembled</option>
              <option value="material">Material</option>
              <option value="joints">Joints</option>
              <option value="tabs">Tabs</option>
              <option value="generate">Job summary</option>
              <option value="simulate" :disabled="simulationProgram.segments.length === 0">
                Simulation
              </option>
            </select>
          </label>
          <div class="job-summary">
            <span>{{ panels.length }} panels</span>
            <span>{{ stockSheetCount }} stock sheet{{ stockSheetCount === 1 ? '' : 's' }}</span>
            <span>Final Z {{ finalDepth.toFixed(3) }} mm</span>
          </div>
        </div>

        <PreviewCanvas
          :panels="panels"
          :settings="settings"
          :mode="activePreviewMode"
          :simulation-segments="scaledSimulationSegments"
          :simulation-elapsed-seconds="simulationElapsedSeconds"
          :simulation-total-seconds="simulationProgram.total_seconds"
          :simulation-speed-percent="simulationSpeedPercent"
        />

        <section class="simulation-controls" aria-label="Simulation controls">
          <button
            type="button"
            class="secondary-button"
            :disabled="simulationProgram.segments.length === 0"
            @click="runSimulation"
          >
            Run
          </button>
          <button
            type="button"
            class="secondary-button"
            :disabled="simulationProgram.segments.length === 0"
            @click="pauseSimulation"
          >
            Pause
          </button>
          <button
            type="button"
            class="secondary-button"
            :disabled="simulationProgram.segments.length === 0"
            @click="restartSimulation"
          >
            Restart
          </button>
          <label>
            Speed {{ (simulationSpeedPercent / 100).toFixed(2) }}x
            <input
              v-model.number="simulationSpeedPercent"
              type="range"
              min="10"
              max="400"
              step="5"
              :disabled="simulationProgram.segments.length === 0"
            />
          </label>
          <output>{{ simulationLabel }}</output>
        </section>

        <section class="nc-output" aria-label="Generated NC output">
          <h2>NC Output</h2>
          <textarea
            v-model="generatedNcText"
            readonly
            spellcheck="false"
            placeholder="Generate NC to preview the program text"
          ></textarea>
        </section>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
/* global Event, HTMLInputElement, cancelAnimationFrame, requestAnimationFrame, window */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';

import PreviewCanvas from '@/components/preview/PreviewCanvas.vue';
import { createDefaultBoxSettings, finalCutDepth, type BoxSettings } from '@/domain/boxSettings';
import { generateGcode } from '@/domain/gcodeGenerator';
import { generateLayout } from '@/domain/layoutGenerator';
import { parseNcProgram, type MotionSegment, type SimulatorProgram } from '@/domain/ncSimulator';
import { downloadTextFile, ncFileName, projectFileName, readTextFile } from '@/utils/browserFiles';

type NumberFieldKey = {
  [Key in keyof BoxSettings]: BoxSettings[Key] extends number ? Key : never;
}[keyof BoxSettings];

interface NumberField {
  key: NumberFieldKey;
  label: string;
}

interface ProjectPayload {
  format?: string;
  application?: string;
  version?: number;
  settings?: Partial<BoxSettings>;
  current_step?: number;
  output_path?: string;
}

type PreviewMode = 'flat' | 'box' | 'material' | 'joints' | 'tabs' | 'generate' | 'simulate';

const coerceSettings = (data: Partial<BoxSettings> | undefined): BoxSettings => {
  const defaults = createDefaultBoxSettings();
  const next = { ...defaults };
  if (data === undefined) {
    return next;
  }
  for (const key of Object.keys(defaults) as Array<keyof BoxSettings>) {
    const value = data[key];
    const current = defaults[key];
    if (value === undefined) {
      continue;
    }
    if (typeof current === 'boolean') {
      (next[key] as boolean) = Boolean(value);
    } else if (typeof current === 'number') {
      (next[key] as number) = Number(value);
    } else if (key === 'box_kind') {
      next.box_kind = value === 'box' ? 'box' : 'drawer';
    } else {
      (next[key] as string) = String(value);
    }
  }
  return next;
};

const loadStoredSettings = (): BoxSettings => {
  try {
    const stored = window.localStorage.getItem('box-cam-settings');
    return stored === null
      ? createDefaultBoxSettings()
      : coerceSettings(JSON.parse(stored) as Partial<BoxSettings>);
  } catch {
    return createDefaultBoxSettings();
  }
};

const loadStoredPreviewMode = (): PreviewMode => {
  const stored = window.localStorage.getItem('box-cam-preview-mode');
  return stored === 'box' ||
    stored === 'material' ||
    stored === 'joints' ||
    stored === 'tabs' ||
    stored === 'generate' ||
    stored === 'simulate'
    ? stored
    : 'flat';
};

const loadStoredSimulationSpeed = (): number => {
  const stored = Number(window.localStorage.getItem('box-cam-simulation-speed') ?? 100);
  return Number.isFinite(stored) ? Math.max(10, Math.min(400, stored)) : 100;
};

const settings = reactive<BoxSettings>(loadStoredSettings());
const panels = ref(generateLayout(settings));
const layoutError = ref('');
const generatedNcText = ref('');
const isDirty = ref(false);
const previewMode = ref<PreviewMode>(loadStoredPreviewMode());
const simulationProgram = ref<SimulatorProgram>({ segments: [], total_seconds: 0.0 });
const simulationElapsedSeconds = ref(0.0);
const simulationSpeedPercent = ref(loadStoredSimulationSpeed());
const fileInput = ref<HTMLInputElement>();
let animationFrame = 0;
let lastAnimationTimestamp: number | undefined;

const boxFields: NumberField[] = [
  { key: 'size_x', label: 'Outside X width (mm)' },
  { key: 'size_y', label: 'Outside Y depth (mm)' },
  { key: 'size_z', label: 'Outside Z height (mm)' }
];

const materialFields: NumberField[] = [
  { key: 'material_thickness', label: 'Material thickness (mm)' },
  { key: 'stock_width', label: 'Stock X width (mm)' },
  { key: 'stock_height', label: 'Stock Y height (mm)' },
  { key: 'bit_diameter', label: 'Edge cutter diameter (mm)' },
  { key: 'relief_diameter', label: 'Relief diameter (mm)' },
  { key: 'cut_depth_step', label: 'Depth step (mm)' }
];

const jointFields: NumberField[] = [
  { key: 'finger_width', label: 'Finger width (mm)' },
  { key: 'layout_gap', label: 'Layout gap (mm)' }
];

const tabFields: NumberField[] = [
  { key: 'tab_width', label: 'Tab width (mm)' },
  { key: 'tab_height', label: 'Tab remaining height (mm)' }
];

const cutFields: NumberField[] = [
  { key: 'feed_rate', label: 'Feed rate' },
  { key: 'plunge_rate', label: 'Plunge rate' },
  { key: 'spindle_speed', label: 'Spindle speed' },
  { key: 'safe_height', label: 'Safe height (mm)' },
  { key: 'surface_height', label: 'Surface height (mm)' }
];

watch(
  settings,
  () => {
    refreshLayout();
    storePreferences();
  },
  { deep: true }
);

watch([previewMode, simulationSpeedPercent], () => {
  storePreferences();
});

const finalDepth = computed(() => finalCutDepth(settings));
const stockSheetCount = computed(() => {
  if (panels.value.length === 0) {
    return 0;
  }
  return Math.max(...panels.value.map((panel) => panel.stock_index)) + 1;
});

const statusMessage = computed(() => {
  if (layoutError.value) {
    return layoutError.value;
  }
  if (generatedNcText.value) {
    return `NC ready, ${simulationProgram.value.segments.length} simulated moves`;
  }
  return `${panels.value.length} panels ready`;
});

const simulationLabel = computed(() => {
  if (simulationProgram.value.segments.length === 0) {
    return 'No NC loaded';
  }
  return `${formatDuration(simulationElapsedSeconds.value)} / ${formatDuration(simulationProgram.value.total_seconds)}`;
});

const activePreviewMode = computed(() => {
  if (previewMode.value === 'simulate' && simulationProgram.value.segments.length === 0) {
    return 'flat';
  }
  return previewMode.value;
});

const scaledSimulationSegments = computed<MotionSegment[]>(() => {
  const scale = simulationSpeedPercent.value / 100.0;
  return simulationProgram.value.segments.map((segment) => ({
    ...segment,
    feed_rate: segment.feed_rate * scale,
    spindle_speed: Math.trunc(segment.spindle_speed * scale)
  }));
});

const refreshLayout = (): void => {
  try {
    if (settings.relief_diameter <= 0.0) {
      settings.relief_diameter = settings.bit_diameter;
    }
    panels.value = generateLayout(settings);
    layoutError.value = '';
  } catch (error) {
    layoutError.value = error instanceof Error ? error.message : 'Layout generation failed';
    panels.value = [];
  }
};

const markDirtyAndClearSimulation = (): void => {
  isDirty.value = true;
  clearSimulation();
};

const newProject = (): void => {
  if (!confirmDiscardChanges()) {
    return;
  }
  Object.assign(settings, createDefaultBoxSettings());
  generatedNcText.value = '';
  clearSimulation();
  previewMode.value = 'flat';
  isDirty.value = false;
};

const openProjectPicker = (): void => {
  if (!confirmDiscardChanges()) {
    return;
  }
  // Resetting the file input lets users reopen the same project file and still
  // receive a change event from the browser.
  if (fileInput.value !== undefined) {
    fileInput.value.value = '';
    fileInput.value.click();
  }
};

const openProjectFile = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file === undefined) {
    return;
  }
  try {
    const loaded = JSON.parse(await readTextFile(file)) as ProjectPayload | Partial<BoxSettings>;
    const settingsData: Partial<BoxSettings> | undefined =
      isProjectPayload(loaded) && typeof loaded.settings === 'object'
        ? loaded.settings
        : (loaded as Partial<BoxSettings>);
    Object.assign(settings, coerceSettings(settingsData));
    generatedNcText.value = '';
    clearSimulation();
    isDirty.value = false;
  } catch (error) {
    layoutError.value = error instanceof Error ? error.message : 'Project file could not be opened';
  }
};

const saveProject = (): void => {
  const payload = {
    format: 'box-creator-project',
    version: 1,
    settings: { ...settings },
    current_step: 0,
    output_path: ncFileName(settings.job_name)
  };
  downloadTextFile(
    projectFileName(settings.job_name),
    `${JSON.stringify(payload, null, 2)}\n`,
    'application/json'
  );
  isDirty.value = false;
};

const generateNc = (): void => {
  refreshLayout();
  if (layoutError.value) {
    return;
  }
  generatedNcText.value = generateGcode(panels.value, settings);
  simulationProgram.value = parseNcProgram(generatedNcText.value, stockOrigins());
  simulationElapsedSeconds.value = 0.0;
  previewMode.value = 'simulate';
};

const saveNc = (): void => {
  if (!generatedNcText.value) {
    generateNc();
  }
  if (generatedNcText.value) {
    downloadTextFile(ncFileName(settings.job_name), generatedNcText.value, 'text/plain');
  }
};

const runSimulation = (): void => {
  if (simulationProgram.value.segments.length === 0) {
    return;
  }
  if (simulationElapsedSeconds.value >= simulationProgram.value.total_seconds) {
    simulationElapsedSeconds.value = 0.0;
  }
  lastAnimationTimestamp = undefined;
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(advanceSimulation);
};

const pauseSimulation = (): void => {
  cancelAnimationFrame(animationFrame);
  lastAnimationTimestamp = undefined;
};

const restartSimulation = (): void => {
  simulationElapsedSeconds.value = 0.0;
  lastAnimationTimestamp = undefined;
};

const advanceSimulation = (timestamp: number): void => {
  if (lastAnimationTimestamp === undefined) {
    lastAnimationTimestamp = timestamp;
    animationFrame = requestAnimationFrame(advanceSimulation);
    return;
  }
  const deltaSeconds = (timestamp - lastAnimationTimestamp) / 1000.0;
  lastAnimationTimestamp = timestamp;
  simulationElapsedSeconds.value += deltaSeconds * (simulationSpeedPercent.value / 100.0);
  if (simulationElapsedSeconds.value >= simulationProgram.value.total_seconds) {
    simulationElapsedSeconds.value = simulationProgram.value.total_seconds;
    pauseSimulation();
    return;
  }
  animationFrame = requestAnimationFrame(advanceSimulation);
};

const clearSimulation = (): void => {
  pauseSimulation();
  simulationProgram.value = { segments: [], total_seconds: 0.0 };
  simulationElapsedSeconds.value = 0.0;
  generatedNcText.value = '';
  if (previewMode.value === 'simulate') {
    previewMode.value = 'flat';
  }
};

const stockOrigins = (): Map<number, [number, number]> => {
  const origins = new Map<number, [number, number]>();
  for (const panel of panels.value) {
    if (!origins.has(panel.stock_index)) {
      origins.set(panel.stock_index, [panel.stock_origin_x, panel.stock_origin_y]);
    }
  }
  return origins;
};

const confirmDiscardChanges = (): boolean => {
  return !isDirty.value || window.confirm('This project has unsaved changes. Discard them?');
};

const isProjectPayload = (
  value: ProjectPayload | Partial<BoxSettings>
): value is ProjectPayload => {
  return 'settings' in value;
};

const storePreferences = (): void => {
  try {
    window.localStorage.setItem('box-cam-settings', JSON.stringify({ ...settings }));
    window.localStorage.setItem('box-cam-preview-mode', previewMode.value);
    window.localStorage.setItem('box-cam-simulation-speed', String(simulationSpeedPercent.value));
  } catch {
    return;
  }
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

onBeforeUnmount(() => {
  pauseSimulation();
});
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto auto 1fr;
}

.top-bar,
.status-bar,
.workspace {
  width: min(100%, 96rem);
  margin-inline: auto;
}

.top-bar {
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

h1,
h2 {
  margin: 0;
  letter-spacing: 0;
}

h1 {
  font-size: 1.35rem;
}

h2 {
  font-size: 0.95rem;
}

.action-row,
.preview-toolbar,
.simulation-controls,
.job-summary,
.status-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.status-bar {
  min-height: 2.5rem;
  padding: 0.5rem 1rem;
  border-block: 1px solid var(--dg-color-border);
  color: var(--dg-color-text-muted);
}

.status-bar strong {
  color: var(--dg-color-text);
}

.workspace {
  min-height: 0;
  padding: 1rem;
  display: grid;
  grid-template-columns: minmax(18rem, 24rem) minmax(0, 1fr);
  gap: 1rem;
}

.settings-panel {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 0.75rem;
}

.settings-group {
  padding-block: 0.25rem 0.75rem;
  border-bottom: 1px solid var(--dg-color-border);
  display: grid;
  gap: 0.55rem;
}

label {
  min-width: 0;
  display: grid;
  gap: 0.25rem;
  color: var(--dg-color-text-muted);
  font-size: 0.86rem;
}

input,
select,
textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--dg-color-border);
  border-radius: 6px;
  background: var(--dg-color-surface);
  color: var(--dg-color-text);
  font: inherit;
}

input,
select {
  min-height: 2.2rem;
  padding: 0.35rem 0.5rem;
}

input:focus,
select:focus,
textarea:focus,
button:focus-visible {
  outline: 0;
  box-shadow: var(--dg-shadow-focus);
}

.toggle-row {
  grid-template-columns: auto 1fr;
  align-items: center;
}

.toggle-row input {
  width: auto;
}

.preview-panel {
  min-width: 0;
  display: grid;
  grid-template-rows: auto minmax(26rem, 1fr) auto auto;
  gap: 0.75rem;
}

.preview-toolbar {
  justify-content: space-between;
}

.preview-toolbar label {
  width: min(16rem, 100%);
}

.job-summary {
  color: var(--dg-color-text-muted);
  font-size: 0.88rem;
}

.simulation-controls {
  padding-block: 0.35rem;
}

.simulation-controls label {
  width: min(20rem, 100%);
}

.simulation-controls output {
  color: var(--dg-color-text-muted);
}

.nc-output {
  display: grid;
  gap: 0.4rem;
}

.nc-output textarea {
  min-height: 10rem;
  padding: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.82rem;
  resize: vertical;
}

button {
  min-height: 2.25rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--dg-color-border);
  border-radius: 6px;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.primary-button {
  background: var(--dg-color-primary);
  color: var(--dg-color-on-primary);
}

.primary-button:hover:not(:disabled) {
  background: var(--dg-color-primary-hover);
}

.secondary-button {
  background: var(--dg-color-surface);
  color: var(--dg-color-text);
}

.secondary-button:hover:not(:disabled) {
  background: var(--dg-color-surface-muted);
}

.file-input {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  opacity: 0;
  pointer-events: none;
}

@media (max-width: 900px) {
  .top-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .workspace {
    grid-template-columns: 1fr;
  }

  .settings-panel {
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  }
}
</style>
