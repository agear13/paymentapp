export const JARVIS_ORB_STATES = [
  'idle',
  'listening',
  'thinking',
  'speaking',
  'executing',
  'success',
] as const;

export type JarvisOrbState = (typeof JARVIS_ORB_STATES)[number];

export type JarvisOrbStep = {
  state: JarvisOrbState;
  durationMs: number;
  caption?: string;
};

export const DEFAULT_JARVIS_ORB_SEQUENCE: readonly JarvisOrbStep[] = [
  { state: 'listening', durationMs: 700, caption: "I'm listening." },
  { state: 'thinking', durationMs: 800 },
  { state: 'speaking', durationMs: 0 },
  { state: 'executing', durationMs: 1300 },
  { state: 'success', durationMs: 0 },
] as const;

export const estimateSpeakingDurationMs = (text: string): number => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(5200, Math.max(1600, words * 220));
};

export const resolveJarvisOrbStepDurationMs = (
  step: JarvisOrbStep,
  spokenResponse: string
): number => {
  if (step.state === 'speaking' && step.durationMs === 0) {
    return estimateSpeakingDurationMs(spokenResponse);
  }
  return step.durationMs;
};

export const isJarvisOrbState = (value: unknown): value is JarvisOrbState =>
  typeof value === 'string' && (JARVIS_ORB_STATES as readonly string[]).includes(value);
