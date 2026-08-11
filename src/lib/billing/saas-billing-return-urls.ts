import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

export type SaasCheckoutContext = 'onboarding' | 'upgrade';

/** Default Commercial OS return path after SaaS billing portal or checkout. */
export const DEFAULT_SAAS_BILLING_RETURN_PATH = COMMERCIAL_OS_ROUTES.planBilling;

/**
 * Stripe Checkout / Billing Portal require absolute URLs.
 * returnTo must be an app-relative path (e.g. /workspace/settings/team).
 */
export function resolveSaasCheckoutReturnUrls(
  origin: string,
  context: SaasCheckoutContext,
  returnTo?: string
): { success_url: string; cancel_url: string } {
  const normalizedReturnTo =
    returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : undefined;

  if (context === 'onboarding') {
    return {
      success_url: normalizedReturnTo
        ? `${origin}${normalizedReturnTo}?billing=success`
        : `${origin}/dashboard?billing=success`,
      cancel_url: `${origin}/onboarding?billing=canceled`,
    };
  }

  return {
    success_url: normalizedReturnTo
      ? `${origin}${normalizedReturnTo}?billing=success`
      : `${origin}${DEFAULT_SAAS_BILLING_RETURN_PATH}?billing=success`,
    cancel_url: normalizedReturnTo
      ? `${origin}${normalizedReturnTo}?billing=canceled`
      : `${origin}${DEFAULT_SAAS_BILLING_RETURN_PATH}?billing=canceled`,
  };
}

export function resolveBillingPortalReturnUrl(
  origin: string,
  returnTo?: string
): string {
  const normalizedReturnTo =
    returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : DEFAULT_SAAS_BILLING_RETURN_PATH;

  return `${origin}${normalizedReturnTo}`;
}
