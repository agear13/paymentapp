import {
  evaluatePilotEnvironment,
  derivePilotReadiness,
  PILOT_REQUIRED_ENV_VARS,
} from '@/lib/pilot/evaluate-pilot-environment';
import { isWiseAutoSettlementAvailable } from '@/lib/pilot/wise-auto-settlement';

describe('pilot environment evaluation', () => {
  const validEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'https://app.provvypay.com',
    DATABASE_URL: 'postgresql://user:pass@host/db',
    NEXT_PUBLIC_SUPABASE_URL: 'https://xyz.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(120),
    SUPABASE_SERVICE_ROLE_KEY: 'b'.repeat(120),
    STRIPE_SECRET_KEY: 'sk_live_test',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_test',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    XERO_CLIENT_ID: 'xero-client',
    XERO_CLIENT_SECRET: 'xero-secret',
    ENABLE_XERO_SYNC: 'true',
    CRON_SECRET: 'cron-secret-min-16-ch',
    CRON_BASE_URL: 'https://app.provvypay.com',
    RESEND_API_KEY: 're_test',
    UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'token',
  };

  it('lists required env vars', () => {
    expect(PILOT_REQUIRED_ENV_VARS).toContain('STRIPE_WEBHOOK_SECRET');
    expect(PILOT_REQUIRED_ENV_VARS).toContain('XERO_CLIENT_ID');
  });

  it('passes when production env is complete', () => {
    const result = evaluatePilotEnvironment(validEnv);
    expect(result.stripeConfigured).toBe(true);
    expect(result.xeroConfigured).toBe(true);
    expect(result.cronConfigured).toBe(true);
    expect(result.missingRequiredEnv).toHaveLength(0);
    expect(result.blockingReasons).toHaveLength(0);
  });

  it('flags missing Stripe webhook secret', () => {
    const result = evaluatePilotEnvironment({
      ...validEnv,
      STRIPE_WEBHOOK_SECRET: 'disabled',
    });
    expect(result.stripeConfigured).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('Stripe'))).toBe(true);
  });

  it('derives READY only when all subsystems healthy', () => {
    const env = evaluatePilotEnvironment(validEnv);
    const ready = derivePilotReadiness({
      environment: env,
      stripeHealthy: true,
      stripeReasons: [],
      xeroHealthy: true,
      xeroReasons: [],
      ledgerHealthy: true,
      ledgerReasons: [],
      failedSyncCount: 0,
      danielleReady: true,
      danielleReasons: [],
    });
    expect(ready.pilotStatus).toBe('READY');
    expect(ready.blockingReasons).toHaveLength(0);
  });

  it('derives NOT_READY with explicit blocking reasons', () => {
    const env = evaluatePilotEnvironment({ ...validEnv, RESEND_API_KEY: '' });
    const notReady = derivePilotReadiness({
      environment: env,
      stripeHealthy: false,
      stripeReasons: ['Stripe rail unhealthy'],
      xeroHealthy: false,
      xeroReasons: ['Xero not connected'],
      ledgerHealthy: false,
      ledgerReasons: ['2 critical ledger issues'],
      failedSyncCount: 3,
      danielleReady: false,
      danielleReasons: ['Org not found'],
    });
    expect(notReady.pilotStatus).toBe('NOT_READY');
    expect(notReady.blockingReasons.length).toBeGreaterThan(3);
    expect(notReady.blockingReasons.some((r) => r.includes('failed Xero sync'))).toBe(true);
  });
});

describe('Wise auto-settlement gating', () => {
  it('is disabled unless WISE_AUTO_SETTLEMENT_ENABLED=true', () => {
    expect(isWiseAutoSettlementAvailable({ WISE_AUTO_SETTLEMENT_ENABLED: 'false' })).toBe(false);
    expect(isWiseAutoSettlementAvailable({})).toBe(false);
  });
});
