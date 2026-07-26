import {
  isDevelopmentPaymentSimulatorEnabled,
  isHackathonJourneyEnabled,
} from '@/lib/journey/hackathon-journey';
import {
  buildSimulatedPinchCollectionResult,
  shouldSimulatePinchPaymentConfirmation,
  simulateDemoClientPayment,
  simulatePinchPaymentConfirmation,
} from '@/lib/payments/pinch/development-payment-simulator.client';
import { isPinchPaymentSuccessful } from '@/lib/payments/pinch/collection-flow.client';

describe('isHackathonJourneyEnabled', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('is false when NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED is unset', () => {
    delete process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED;
    expect(isHackathonJourneyEnabled()).toBe(false);
  });

  it('is true when NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED is true', () => {
    process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED = 'true';
    expect(isHackathonJourneyEnabled()).toBe(true);
  });
});

describe('isDevelopmentPaymentSimulatorEnabled', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('follows the hackathon public flag', () => {
    delete process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED;
    expect(isDevelopmentPaymentSimulatorEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED = 'true';
    expect(isDevelopmentPaymentSimulatorEnabled()).toBe(true);
  });
});

describe('shouldSimulatePinchPaymentConfirmation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('is false when the hackathon flag is unset', () => {
    delete process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED;
    expect(shouldSimulatePinchPaymentConfirmation()).toBe(false);
  });

  it('is true when the hackathon flag is enabled', () => {
    process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED = 'true';
    expect(shouldSimulatePinchPaymentConfirmation()).toBe(true);
  });
});

describe('buildSimulatedPinchCollectionResult', () => {
  it('returns typed Pinch responses that satisfy the existing success check', () => {
    const result = buildSimulatedPinchCollectionResult({
      amountCents: 125000,
      description: 'Provvy workflow collection · Demo Deal',
      payerLabel: 'Demo Client Pty Ltd',
      payerId: 'pyr_demo',
    });

    expect(result.source.id).toMatch(/^src_demo_/);
    expect(result.payment.id).toMatch(/^pmt_demo_/);
    expect(result.payment.amount).toBe(125000);
    expect(result.payment.payer.companyName).toBe('Demo Client Pty Ltd');
    expect(isPinchPaymentSuccessful(result.payment.status)).toBe(true);
  });
});

describe('simulateDemoClientPayment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'development' };
    process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED = 'true';
    jest.useFakeTimers();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.useRealTimers();
  });

  it('progresses through request, received, and reconciled demo steps', async () => {
    const steps: string[] = [];
    const promise = simulateDemoClientPayment({
      amountCents: 50000,
      description: 'Demo collection',
      payerLabel: 'Demo Client',
      minDelayMs: 3000,
      maxDelayMs: 3000,
      onDemoStep: (step) => steps.push(step),
    });

    await jest.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(steps).toEqual(['request', 'received', 'reconciled']);
    expect(isPinchPaymentSuccessful(result.payment.status)).toBe(true);
  });
});

describe('simulatePinchPaymentConfirmation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'development' };
    process.env.NEXT_PUBLIC_HACKATHON_JOURNEY_ENABLED = 'true';
    jest.useFakeTimers();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.useRealTimers();
  });

  it('progresses through capture, source, and payment steps before returning', async () => {
    const steps: string[] = [];
    const promise = simulatePinchPaymentConfirmation({
      amountCents: 50000,
      description: 'Demo collection',
      payerLabel: 'Demo Client',
      minDelayMs: 3000,
      maxDelayMs: 3000,
      onStep: (step) => steps.push(step),
    });

    await jest.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(steps).toEqual(['capture', 'source', 'payment']);
    expect(isPinchPaymentSuccessful(result.payment.status)).toBe(true);
  });
});
