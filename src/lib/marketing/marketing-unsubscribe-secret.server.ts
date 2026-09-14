import 'server-only';

import { resolveCsrfSecret } from '@/lib/security/csrf-secret.server';

export function resolveMarketingUnsubscribeSecret(): string {
  const secret = process.env.MARKETING_UNSUBSCRIBE_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;

  if (
    process.env.RELAX_ENV_VALIDATION === '1' ||
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'development'
  ) {
    return 'dev-marketing-unsubscribe-secret-min-32-chars';
  }

  return resolveCsrfSecret();
}
