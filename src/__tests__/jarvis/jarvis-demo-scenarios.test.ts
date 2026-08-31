import {
  JARVIS_DEMO_HERO_SCENARIO_ID,
  JARVIS_DEMO_SCENARIOS,
  getJarvisDemoScenario,
} from '@/lib/jarvis/jarvis-demo-scenarios';
import { JARVIS_ORB_STATES } from '@/lib/jarvis/jarvis-orb-states';
import { jarvisDemoAudioPath } from '@/lib/jarvis/jarvis-demo-audio';

describe('Jarvis demo scenarios', () => {
  it('defines the five campaign scenarios with simulated execution only', () => {
    expect(JARVIS_DEMO_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      'invoice-execution',
      'business-information',
      'workspace-status',
      'participant-coordination',
      'settlement-preparation',
    ]);
    expect(JARVIS_DEMO_SCENARIOS[0]?.id).toBe(JARVIS_DEMO_HERO_SCENARIO_ID);

    for (const scenario of JARVIS_DEMO_SCENARIOS) {
      expect(scenario.userInstruction).toMatch(/^Provvy,/);
      expect(scenario.spokenResponse.length).toBeGreaterThan(10);
      expect(scenario.successResponse.length).toBeGreaterThan(20);
      expect(scenario.spokenResponse).not.toBe(scenario.successResponse);
      expect(scenario.simulatedResult.kind).toBe('simulated');
      expect(scenario.backendAction.execution).toBe('simulated');
      expect(scenario.orbSequence.map((step) => step.state)).toEqual([
        'listening',
        'thinking',
        'speaking',
        'executing',
        'success',
      ]);
      expect(scenario.audioResponse?.src).toBe(jarvisDemoAudioPath(scenario.id));
    }
  });

  it('keeps invoice spoken and success copy on separate beats', () => {
    const invoice = getJarvisDemoScenario('invoice-execution');
    expect(invoice?.userInstruction).toBe(
      'Provvy, generate the $4,800 invoice for Apex Promotions and send it to Sarah.'
    );
    expect(invoice?.spokenResponse).toMatch(/^Absolutely\./);
    expect(invoice?.spokenResponse.toLowerCase()).not.toContain('done.');
    expect(invoice?.successResponse).toMatch(/^Done\./);
  });

  it('marks which eventual actions can connect to existing backend capabilities', () => {
    expect(getJarvisDemoScenario('business-information')?.backendAction).toMatchObject({
      id: 'query.supplier_obligations',
      canConnect: true,
      connection: 'ready',
    });
    expect(getJarvisDemoScenario('invoice-execution')?.backendAction).toMatchObject({
      id: 'invoice.create_and_send',
      canConnect: true,
      connection: 'ready',
    });
    expect(getJarvisDemoScenario('workspace-status')?.backendAction).toMatchObject({
      id: 'workspace.get_activation_status',
      canConnect: true,
      connection: 'ready',
    });
    expect(getJarvisDemoScenario('participant-coordination')?.backendAction).toMatchObject({
      id: 'participant.request_approval',
      canConnect: true,
      connection: 'partial',
    });
    expect(getJarvisDemoScenario('settlement-preparation')?.backendAction).toMatchObject({
      id: 'settlement.prepare_readiness',
      canConnect: true,
      connection: 'partial',
    });
  });

  it('keeps orb states on the shared vocabulary', () => {
    for (const scenario of JARVIS_DEMO_SCENARIOS) {
      for (const step of scenario.orbSequence) {
        expect(JARVIS_ORB_STATES).toContain(step.state);
      }
    }
  });
});
