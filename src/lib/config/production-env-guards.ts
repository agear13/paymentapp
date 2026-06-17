/**
 * B5 production hardening guards (C1, C3, C5).
 * Invoked at runtime startup when NODE_ENV === 'production'.
 */

import {
  readAgreementR2StorageConfig,
  readAgreementUploadStorageProvider,
} from '@/lib/agreement-analyzer/upload-storage/agreement-upload-storage-config';

export type ProductionGuardEnv = {
  NODE_ENV: string;
  STRIPE_SECRET_KEY: string;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
};

const MIN_CRON_SECRET_LENGTH = 16;
const MIN_CSRF_SECRET_LENGTH = 32;

export function isStripeWebhookSecretValid(secret: string | undefined): boolean {
  const trimmed = secret?.trim() ?? '';
  if (!trimmed) return false;
  if (trimmed.toLowerCase() === 'disabled') return false;
  return trimmed.startsWith('whsec_');
}

export function isCronSecretValid(secret: string | undefined): boolean {
  const trimmed = secret?.trim() ?? '';
  return trimmed.length >= MIN_CRON_SECRET_LENGTH;
}

export function isCronBaseUrlValid(processEnv: NodeJS.ProcessEnv = process.env): boolean {
  const base = (processEnv.CRON_BASE_URL || processEnv.NEXT_PUBLIC_APP_URL || '').trim();
  if (!base) return false;
  try {
    const url = new URL(base);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isCsrfSecretValid(secret: string | undefined): boolean {
  const trimmed = secret?.trim() ?? '';
  return trimmed.length >= MIN_CSRF_SECRET_LENGTH;
}

export function isAgreementStorageProductionReady(
  processEnv: NodeJS.ProcessEnv = process.env,
  options?: { nodeEnv?: string }
): { ok: true } | { ok: false; reason: string } {
  const nodeEnv = options?.nodeEnv ?? processEnv.NODE_ENV ?? process.env.NODE_ENV;
  if (nodeEnv !== 'production') {
    return { ok: true };
  }

  const provider = readAgreementUploadStorageProvider({
    ...processEnv,
    NODE_ENV: nodeEnv,
  });
  if (provider === 'local') {
    return {
      ok: false,
      reason:
        'Agreement upload storage must not use local filesystem in production. Set STORAGE_PROVIDER=r2 and configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.',
    };
  }

  if (!readAgreementR2StorageConfig(processEnv)) {
    return {
      ok: false,
      reason:
        'Agreement upload storage requires R2 in production. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.',
    };
  }

  return { ok: true };
}

export function assertProductionEnvGuards(
  env: ProductionGuardEnv,
  processEnv: NodeJS.ProcessEnv = process.env
): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  const errors: string[] = [];

  if (!isStripeWebhookSecretValid(env.STRIPE_WEBHOOK_SECRET)) {
    errors.push(
      'STRIPE_WEBHOOK_SECRET must be set to a valid Stripe signing secret (whsec_...) in production; ' +
        'empty and "disabled" are not allowed (C1).'
    );
  }

  if (!isCronSecretValid(processEnv.CRON_SECRET)) {
    errors.push(
      `CRON_SECRET is required in production (min ${MIN_CRON_SECRET_LENGTH} characters) for B3 scheduled jobs (C3).`
    );
  }

  if (!isCronBaseUrlValid(processEnv)) {
    errors.push(
      'CRON_BASE_URL or NEXT_PUBLIC_APP_URL is required in production so Render cron services can invoke HTTP job routes.'
    );
  }

  if (!isCsrfSecretValid(processEnv.CSRF_SECRET)) {
    errors.push(
      `CSRF_SECRET is required in production (min ${MIN_CSRF_SECRET_LENGTH} characters) for dashboard CSRF protection.`
    );
  }

  const agreementStorage = isAgreementStorageProductionReady(processEnv, {
    nodeEnv: env.NODE_ENV,
  });
  if (!agreementStorage.ok) {
    errors.push(agreementStorage.reason);
  }

  const allowTestKeys = processEnv.ALLOW_STRIPE_TEST_KEYS === 'true';
  if (!allowTestKeys) {
    if (env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
      errors.push(
        'STRIPE_SECRET_KEY must use live mode (sk_live_...) in production, or set ALLOW_STRIPE_TEST_KEYS=true for staging only (C5).'
      );
    }
    if (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_')) {
      errors.push(
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must use live mode (pk_live_...) in production, or set ALLOW_STRIPE_TEST_KEYS=true for staging only (C5).'
      );
    }
  }

  if (errors.length > 0) {
    console.error('❌ Production environment hardening failed:');
    errors.forEach((msg) => console.error(`  - ${msg}`));
    throw new Error(`Production environment hardening failed: ${errors.join(' ')}`);
  }
}
