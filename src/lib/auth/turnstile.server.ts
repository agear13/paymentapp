import 'server-only';

export type TurnstileConfig = {
  enabled: boolean;
  siteKey: string | null;
  requiredForSignup: boolean;
  requiredForLogin: boolean;
  requiredForPasswordReset: boolean;
  failureThreshold: number;
};

export function getTurnstileConfig(): TurnstileConfig {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;
  const secretKey = process.env.TURNSTILE_SECRET_KEY ?? null;
  const enabled = Boolean(siteKey && secretKey);

  const alwaysRequired = process.env.AUTH_TURNSTILE_ALWAYS === 'true';
  const failureThreshold = Number.parseInt(process.env.AUTH_TURNSTILE_AFTER_FAILURES || '3', 10);

  return {
    enabled,
    siteKey,
    requiredForSignup: enabled && alwaysRequired,
    requiredForLogin: enabled && alwaysRequired,
    requiredForPasswordReset: enabled && alwaysRequired,
    failureThreshold,
  };
}

export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string
): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    return true;
  }

  if (!token) {
    return false;
  }

  const body = new URLSearchParams({
    secret: secretKey,
    response: token,
  });
  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await response.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}

export async function isTurnstileRequired(
  scope: 'signup' | 'login' | 'reset',
  ip: string
): Promise<boolean> {
  const config = getTurnstileConfig();
  if (!config.enabled) return false;

  if (scope === 'signup' && config.requiredForSignup) return true;
  if (scope === 'login' && config.requiredForLogin) return true;
  if (scope === 'reset' && config.requiredForPasswordReset) return true;

  const { getAuthFailureCounter } = await import('@/lib/auth/auth-rate-limit.server');
  const failures = await getAuthFailureCounter(scope, ip);
  return failures >= config.failureThreshold;
}
