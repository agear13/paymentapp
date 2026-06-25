/**
 * Xero environment configuration checks.
 * Never logs or returns secret values — booleans only.
 */

export class XeroConfigurationError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(
      `Xero integration is not configured. Missing environment variable(s): ${missing.join(', ')}`
    );
    this.name = 'XeroConfigurationError';
    this.missing = missing;
  }
}

export type XeroEnvStatus = {
  XERO_CLIENT_ID: boolean;
  XERO_CLIENT_SECRET: boolean;
  XERO_REDIRECT_URI: boolean;
  XERO_ENCRYPTION_KEY: boolean;
  SESSION_SECRET: boolean;
};

/** OAuth state signing secret — any one of these satisfies SESSION_SECRET requirement. */
function hasOAuthStateSecret(): boolean {
  return Boolean(
    process.env.OAUTH_STATE_SECRET ||
      process.env.SESSION_SECRET ||
      process.env.ENCRYPTION_KEY
  );
}

export function getXeroEnvStatus(): XeroEnvStatus {
  return {
    XERO_CLIENT_ID: Boolean(process.env.XERO_CLIENT_ID),
    XERO_CLIENT_SECRET: Boolean(process.env.XERO_CLIENT_SECRET),
    XERO_REDIRECT_URI: Boolean(process.env.XERO_REDIRECT_URI),
    XERO_ENCRYPTION_KEY: Boolean(process.env.XERO_ENCRYPTION_KEY),
    SESSION_SECRET: hasOAuthStateSecret(),
  };
}

export function getMissingXeroEnvVars(): string[] {
  const status = getXeroEnvStatus();
  return Object.entries(status)
    .filter(([, present]) => !present)
    .map(([key]) => key);
}

export function assertXeroConfigured(): void {
  const missing = getMissingXeroEnvVars();
  if (missing.length > 0) {
    throw new XeroConfigurationError(missing);
  }
}

export function isXeroFullyConfigured(): boolean {
  return getMissingXeroEnvVars().length === 0;
}
