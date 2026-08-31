import { getJarvisDemoScenario } from '@/lib/jarvis/jarvis-demo-scenarios';
import {
  estimateSpeakingDurationMs,
  resolveJarvisOrbStepDurationMs,
} from '@/lib/jarvis/jarvis-orb-states';

describe('Jarvis orb timing', () => {
  it('keeps the invoice scenario inside a recordable 10–15s window', () => {
    const invoice = getJarvisDemoScenario('invoice-execution');
    expect(invoice).toBeDefined();

    const total = invoice!.orbSequence.reduce(
      (sum, step) => sum + resolveJarvisOrbStepDurationMs(step, invoice!.spokenResponse),
      0
    );

    expect(total).toBeGreaterThanOrEqual(4000);
    expect(total).toBeLessThanOrEqual(15000);
    expect(estimateSpeakingDurationMs(invoice!.spokenResponse)).toBeLessThanOrEqual(5200);
  });
});
