import {
  isCronBaseUrlValid,
  isCronSecretValid,
  isStripeWebhookSecretValid,
} from '@/lib/config/production-env-guards';

export const PILOT_REQUIRED_ENV_VARS = [
  'NODE_ENV',
  'NEXT_PUBLIC_APP_URL',
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'XERO_CLIENT_ID',
  'XERO_CLIENT_SECRET',
  'CRON_SECRET',
  'RESEND_API_KEY',
] as const;

export type PilotEnvironmentEvaluation = {
  productionMode: boolean;
  appUrl: string | null;
  stripeConfigured: boolean;
  xeroConfigured: boolean;
  resendConfigured: boolean;
  redisConfigured: boolean;
  cronConfigured: boolean;
  missingRequiredEnv: string[];
  blockingReasons: string[];
};

function isPresent(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 && trimmed.toLowerCase() !== 'disabled';
}

export function evaluatePilotEnvironment(
  processEnv: NodeJS.ProcessEnv = process.env
): PilotEnvironmentEvaluation {
  const missingRequiredEnv = PILOT_REQUIRED_ENV_VARS.filter(
    (key) => !isPresent(processEnv[key])
  );

  const stripeConfigured =
    isPresent(processEnv.STRIPE_SECRET_KEY) &&
    isPresent(processEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) &&
    isStripeWebhookSecretValid(processEnv.STRIPE_WEBHOOK_SECRET);

  const xeroConfigured =
    isPresent(processEnv.XERO_CLIENT_ID) &&
    isPresent(processEnv.XERO_CLIENT_SECRET) &&
    ['true', '1'].includes((processEnv.ENABLE_XERO_SYNC || 'true').toLowerCase());

  const resendConfigured = isPresent(processEnv.RESEND_API_KEY);
  const redisConfigured =
    isPresent(processEnv.UPSTASH_REDIS_REST_URL) &&
    isPresent(processEnv.UPSTASH_REDIS_REST_TOKEN);

  const cronConfigured =
    isCronSecretValid(processEnv.CRON_SECRET) && isCronBaseUrlValid(processEnv);

  const blockingReasons: string[] = [];
  if (missingRequiredEnv.length > 0) {
    blockingReasons.push(`Missing required env: ${missingRequiredEnv.join(', ')}`);
  }
  if (!stripeConfigured) {
    blockingReasons.push('Stripe is not fully configured (keys + whsec webhook secret)');
  }
  if (!xeroConfigured) {
    blockingReasons.push('Xero is not fully configured');
  }
  if (!cronConfigured) {
    blockingReasons.push('Cron jobs are not configured (CRON_SECRET + CRON_BASE_URL)');
  }
  if (!resendConfigured) {
    blockingReasons.push('Resend email is not configured');
  }

  return {
    productionMode: processEnv.NODE_ENV === 'production',
    appUrl: processEnv.NEXT_PUBLIC_APP_URL?.trim() || null,
    stripeConfigured,
    xeroConfigured,
    resendConfigured,
    redisConfigured,
    cronConfigured,
    missingRequiredEnv: [...missingRequiredEnv],
    blockingReasons,
  };
}

export function derivePilotReadiness(input: {
  environment: PilotEnvironmentEvaluation;
  stripeHealthy: boolean;
  stripeReasons: string[];
  xeroHealthy: boolean;
  xeroReasons: string[];
  ledgerHealthy: boolean;
  ledgerReasons: string[];
  failedSyncCount: number;
  danielleReady: boolean;
  danielleReasons: string[];
}): { pilotStatus: 'READY' | 'NOT_READY'; blockingReasons: string[] } {
  const blockingReasons = [
    ...input.environment.blockingReasons,
    ...(input.stripeHealthy ? [] : input.stripeReasons),
    ...(input.xeroHealthy ? [] : input.xeroReasons),
    ...(input.ledgerHealthy ? [] : input.ledgerReasons),
    ...(input.failedSyncCount > 0
      ? [`${input.failedSyncCount} failed Xero sync(s) require attention`]
      : []),
    ...(input.danielleReady ? [] : input.danielleReasons),
  ];

  return {
    pilotStatus: blockingReasons.length === 0 ? 'READY' : 'NOT_READY',
    blockingReasons,
  };
}
