import { JARVIS_DEMO_SCENARIOS } from '@/lib/jarvis/jarvis-demo-scenarios';
import {
  advanceJarvisDemoSession,
  assistantLineForSession,
  beginJarvisDemoSession,
  createIdleJarvisDemoSession,
  resolveJarvisDemoScenario,
  selectSimulatedJarvisDemoInput,
} from '@/lib/jarvis/jarvis-demo-session';
import { JARVIS_ORB_STATES } from '@/lib/jarvis/jarvis-orb-states';

const invoice = JARVIS_DEMO_SCENARIOS.find((scenario) => scenario.id === 'invoice-execution')!;

describe('Jarvis demo session', () => {
  it('resolves a simulated instruction by scenario id or transcript', () => {
    expect(
      resolveJarvisDemoScenario({
        source: 'simulated_voice',
        transcript: invoice.userInstruction,
        scenarioId: invoice.id,
      })?.id
    ).toBe('invoice-execution');

    expect(
      resolveJarvisDemoScenario({
        source: 'speech_to_text',
        transcript: invoice.userInstruction,
      })?.id
    ).toBe('invoice-execution');

    expect(
      resolveJarvisDemoScenario({
        source: 'speech_to_text',
        transcript: 'please ignore this',
      })
    ).toBeNull();
  });

  it('walks idle → listening → thinking → speaking → executing → success', () => {
    let session = createIdleJarvisDemoSession();
    expect(session.orbState).toBe('idle');
    expect(session.completed).toBe(false);

    session = beginJarvisDemoSession(selectSimulatedJarvisDemoInput(invoice));
    expect(session.status).toBe('running');
    expect(session.execution).toBe('simulated');
    expect(session.userTranscript).toBe(invoice.userInstruction);

    const seen: string[] = [session.orbState];
    while (session.status === 'running') {
      session = advanceJarvisDemoSession(session);
      seen.push(session.orbState);
    }

    expect(seen).toEqual([...JARVIS_ORB_STATES.slice(1)]);
    expect(session.status).toBe('complete');
    expect(session.completed).toBe(true);
    expect(session.orbState).toBe('success');
    expect(session.successText).toBe(invoice.successResponse);
    expect(session.execution).toBe('simulated');
  });

  it('does not reveal the success response before the success state', () => {
    let session = beginJarvisDemoSession(selectSimulatedJarvisDemoInput(invoice));
    expect(session.orbState).toBe('listening');
    expect(session.spokenText).toBeNull();
    expect(session.successText).toBeNull();

    session = advanceJarvisDemoSession(session);
    expect(session.orbState).toBe('thinking');
    expect(session.spokenText).toBeNull();
    expect(session.successText).toBeNull();

    session = advanceJarvisDemoSession(session);
    expect(session.orbState).toBe('speaking');
    expect(session.spokenText).toBe(invoice.spokenResponse);
    expect(session.successText).toBeNull();
    expect(assistantLineForSession(session)).toBe(invoice.spokenResponse);
    expect(assistantLineForSession(session)).not.toContain('Done.');

    session = advanceJarvisDemoSession(session);
    expect(session.orbState).toBe('executing');
    expect(session.spokenText).toBe(invoice.spokenResponse);
    expect(session.successText).toBeNull();

    session = advanceJarvisDemoSession(session);
    expect(session.orbState).toBe('success');
    expect(session.successText).toBe(invoice.successResponse);
    expect(session.spokenText).toBeNull();
    expect(assistantLineForSession(session)).toBe(invoice.successResponse);
  });
});
