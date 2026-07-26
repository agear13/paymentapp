import {
  isDevelopmentPaymentSimulatorEnabled,
} from '@/lib/journey/hackathon-journey';
import {
  buildSimulatedPinchCollectionResult,
  shouldSimulatePinchPaymentConfirmation,
  simulatePinchPaymentConfirmation,
} from '@/lib/payments/pinch/development-payment-simulator.client';
import { isPinchPaymentSuccessful } from '@/lib/payments/pinch/collection-flow.client';

describe('isDevelopmentPaymentSimulatorEnabled', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('is disabled in production unless an explicit demo flag is set', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_DEMO_PAYMENT_SIMULATOR_ENABLED;
    delete process.env.HACKATHON_JOURNEY_ENABLED;

    expect(isDevelopmentPaymentSimulatorEnabled()).toBe(false);
  });

  it('is enabled in production when the demo flag is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_DEMO_PAYMENT_SIMULATOR_ENABLED = 'true';

    expect(isDevelopmentPaymentSimulatorEnabled()).toBe(true);
  });
});

describe('shouldSimulatePinchPaymentConfirmation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'development' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('simulates in production demo builds even when sandbox config exists', () => {
    expect(
      shouldSimulatePinchPaymentConfirmation({
        publishableKey: 'pk_test',
        payerId: 'pyr_test',
        isProductionBuild: true,
      }),
    ).toBe(true);
  });

  it('uses the real sandbox flow in development when sandbox config is ready', () => {
    expect(
      shouldSimulatePinchPaymentConfirmation({
        publishableKey: 'pk_test',
        payerId: 'pyr_test',
        isProductionBuild: false,
      }),
    ).toBe(false);
  });

  it('simulates in development when sandbox config is missing', () => {
    expect(
      shouldSimulatePinchPaymentConfirmation({
        publishableKey: '',
        payerId: null,
        isProductionBuild: false,
      }),
    ).toBe(true);
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

describe('simulatePinchPaymentConfirmation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'development' };
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
