import {
  JARVIS_DEMO_SCENARIOS,
  type JarvisDemoScenario,
} from '@/lib/jarvis/jarvis-demo-scenarios';
import type { JarvisOrbState } from '@/lib/jarvis/jarvis-orb-states';

/**
 * Simulated voice today. A later STT adapter should emit the same shape
 * with `source: 'speech_to_text'` and a live transcript — then call
 * `beginJarvisDemoSession` / `advanceJarvisDemoSession` unchanged.
 */
export type JarvisDemoInputSource = 'simulated_voice' | 'speech_to_text';

export type JarvisDemoUserInput = {
  source: JarvisDemoInputSource;
  transcript: string;
  scenarioId?: string;
};

export type JarvisDemoSessionStatus = 'idle' | 'running' | 'complete';

export type JarvisDemoSession = {
  status: JarvisDemoSessionStatus;
  scenarioId: string | null;
  orbState: JarvisOrbState;
  stepIndex: number;
  userTranscript: string | null;
  spokenText: string | null;
  successText: string | null;
  caption: string | null;
  execution: 'idle' | 'simulated';
  completed: boolean;
};

export const assistantLineForSession = (session: JarvisDemoSession): string | null =>
  session.successText ?? session.spokenText;

export const normalizeJarvisDemoTranscript = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’']/g, "'")
    .replace(/[^\w\s$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const resolveJarvisDemoScenario = (
  input: JarvisDemoUserInput,
  scenarios: readonly JarvisDemoScenario[] = JARVIS_DEMO_SCENARIOS
): JarvisDemoScenario | null => {
  if (input.scenarioId) {
    return scenarios.find((scenario) => scenario.id === input.scenarioId) ?? null;
  }

  const transcript = normalizeJarvisDemoTranscript(input.transcript);
  if (!transcript) return null;

  const exact = scenarios.find(
    (scenario) => normalizeJarvisDemoTranscript(scenario.userInstruction) === transcript
  );
  if (exact) return exact;

  return (
    scenarios.find((scenario) =>
      transcript.includes(normalizeJarvisDemoTranscript(scenario.userInstruction))
    ) ?? null
  );
};

export const createIdleJarvisDemoSession = (): JarvisDemoSession => ({
  status: 'idle',
  scenarioId: null,
  orbState: 'idle',
  stepIndex: -1,
  userTranscript: null,
  spokenText: null,
  successText: null,
  caption: null,
  execution: 'idle',
  completed: false,
});

export const beginJarvisDemoSession = (
  input: JarvisDemoUserInput,
  scenarios: readonly JarvisDemoScenario[] = JARVIS_DEMO_SCENARIOS
): JarvisDemoSession => {
  const scenario = resolveJarvisDemoScenario(input, scenarios);
  if (!scenario) return createIdleJarvisDemoSession();

  const first = scenario.orbSequence[0];
  return {
    status: 'running',
    scenarioId: scenario.id,
    orbState: first?.state ?? 'listening',
    stepIndex: 0,
    userTranscript: input.transcript,
    spokenText: null,
    successText: null,
    caption: first?.caption ?? null,
    execution: 'simulated',
    completed: false,
  };
};

const linesForState = (
  state: JarvisOrbState,
  scenario: JarvisDemoScenario
): Pick<JarvisDemoSession, 'spokenText' | 'successText'> => {
  if (state === 'success') {
    return { spokenText: null, successText: scenario.successResponse };
  }
  if (state === 'speaking' || state === 'executing') {
    return { spokenText: scenario.spokenResponse, successText: null };
  }
  return { spokenText: null, successText: null };
};

export const advanceJarvisDemoSession = (
  session: JarvisDemoSession,
  scenarios: readonly JarvisDemoScenario[] = JARVIS_DEMO_SCENARIOS
): JarvisDemoSession => {
  if (session.status !== 'running' || !session.scenarioId) return session;

  const scenario = scenarios.find((item) => item.id === session.scenarioId);
  if (!scenario) return session;

  const nextIndex = session.stepIndex + 1;
  if (nextIndex >= scenario.orbSequence.length) {
    return {
      ...session,
      status: 'complete',
      orbState: 'success',
      ...linesForState('success', scenario),
      caption: null,
      completed: true,
      execution: 'simulated',
    };
  }

  const step = scenario.orbSequence[nextIndex];
  const isSuccess = step.state === 'success';
  return {
    ...session,
    stepIndex: nextIndex,
    orbState: step.state,
    caption: step.caption ?? null,
    ...linesForState(step.state, scenario),
    execution: 'simulated',
    completed: isSuccess,
    status: isSuccess ? 'complete' : 'running',
  };
};

export const selectSimulatedJarvisDemoInput = (
  scenario: JarvisDemoScenario
): JarvisDemoUserInput => ({
  source: 'simulated_voice',
  transcript: scenario.userInstruction,
  scenarioId: scenario.id,
});
