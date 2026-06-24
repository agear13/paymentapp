import { NextRequest } from 'next/server';
import { getAuthFailureCounter } from '@/lib/auth/auth-rate-limit.server';
import { authSuccess } from '@/lib/auth/auth-api.shared';
import { getTurnstileConfig } from '@/lib/auth/turnstile.server';
import { getClientIdentifier } from '@/lib/rate-limit';

/**
 * GET /api/auth/turnstile-config?scope=login|signup|reset
 */
export async function GET(request: NextRequest) {
  const config = getTurnstileConfig();
  const scope = request.nextUrl.searchParams.get('scope');
  const ip = getClientIdentifier(request);

  let required = false;
  if (config.enabled && (scope === 'signup' || scope === 'login' || scope === 'reset')) {
    if (scope === 'signup' && config.requiredForSignup) required = true;
    if (scope === 'login' && config.requiredForLogin) required = true;
    if (scope === 'reset' && config.requiredForPasswordReset) required = true;

    if (!required) {
      const failures = await getAuthFailureCounter(scope, ip);
      required = failures >= config.failureThreshold;
    }
  }

  return authSuccess({
    enabled: config.enabled,
    siteKey: config.siteKey,
    required,
    failureThreshold: config.failureThreshold,
  });
}
