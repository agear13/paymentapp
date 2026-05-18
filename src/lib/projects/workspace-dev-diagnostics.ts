/**
 * Development-only diagnostics for project workspace stability.
 */

const DEV = process.env.NODE_ENV !== 'production';

type CounterWindow = {
  timestamps: number[];
  windowMs: number;
  max: number;
  label: string;
};

function pruneWindow(counter: CounterWindow) {
  const cutoff = Date.now() - counter.windowMs;
  counter.timestamps = counter.timestamps.filter((t) => t >= cutoff);
}

function record(counter: CounterWindow) {
  if (!DEV) return;
  pruneWindow(counter);
  counter.timestamps.push(Date.now());
  if (counter.timestamps.length > counter.max) {
    console.warn(
      `[ProjectWorkspace] ${counter.label}: ${counter.timestamps.length} events in ${counter.windowMs / 1000}s (threshold ${counter.max})`
    );
  }
}

const refreshCounter: CounterWindow = {
  timestamps: [],
  windowMs: 60_000,
  max: 10,
  label: 'Excessive snapshot refreshes',
};

const mountCounter: CounterWindow = {
  timestamps: [],
  windowMs: 5_000,
  max: 3,
  label: 'Rapid provider remounts',
};

const duplicateFetchCounter: CounterWindow = {
  timestamps: [],
  windowMs: 2_000,
  max: 2,
  label: 'Duplicate snapshot fetches',
};

export function devRecordWorkspaceRefresh(projectId: string) {
  record(refreshCounter);
  if (DEV && refreshCounter.timestamps.length === 1) {
    console.debug('[ProjectWorkspace] refresh', projectId);
  }
}

export function devRecordWorkspaceMount(projectId: string) {
  record(mountCounter);
  if (DEV) {
    console.debug('[ProjectWorkspace] provider mount', projectId);
  }
}

export function devRecordDuplicateFetch(projectId: string, scope: string) {
  record(duplicateFetchCounter);
  if (DEV && duplicateFetchCounter.timestamps.length > duplicateFetchCounter.max) {
    console.warn(`[ProjectWorkspace] duplicate fetch (${scope}) for ${projectId}`);
  }
}

let renderCount = 0;
let renderWindowStart = Date.now();

export function devRecordWorkspaceRender(projectId: string) {
  if (!DEV) return;
  const now = Date.now();
  if (now - renderWindowStart > 3_000) {
    renderCount = 0;
    renderWindowStart = now;
  }
  renderCount += 1;
  if (renderCount > 40) {
    console.warn(
      `[ProjectWorkspace] high render count (${renderCount}/3s) for project ${projectId}`
    );
    renderCount = 0;
  }
}
