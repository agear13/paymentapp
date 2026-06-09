import 'server-only';

export function resolveCsrfSecret(): string {
  const secret = process.env.CSRF_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;

  if (
    process.env.RELAX_ENV_VALIDATION === '1' ||
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'development'
  ) {
    return 'dev-csrf-secret-minimum-32-characters';
  }

  throw new Error('CSRF_SECRET must be set (min 32 characters) in production');
}
