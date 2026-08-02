/**
 * Authenticated Commercial OS routes (Lovable workspace UX).
 * Source: src/lovable-import/src/routes/workspace*
 */

export const COMMERCIAL_OS_ROUTES = {
  provisioningBuild: '/journey/provisioning?build=1',
  workspace: '/workspace',
  receivables: '/workspace/receivables',
  workflows: '/workspace/workflows',
  workflowLibrary: '/workspace/workflows',
  workflowDetail: (slug: string) => `/workspace/workflows/${slug}`,
  publicWorkflowDetail: (slug: string) => `/journey/workflows/${slug}`,
  workflowReconciliation: '/workspace/workflow/reconciliation',
  workflowReconciliationTour: '/workspace/workflow/reconciliation?tour=1',
  timeline: '/workspace/timeline',
  connected: '/workspace/connected',
  advisor: '/workspace/advisor',
  settings: '/workspace/settings',
  assessment: '/journey/assessment',
  loginWithTourRedirect: `/auth/login?redirectedFrom=${encodeURIComponent('/workspace/workflow/reconciliation?tour=1')}`,
} as const;

/** Default destination immediately after a successful sign-in. */
export function postLoginDestination(): string {
  return COMMERCIAL_OS_ROUTES.provisioningBuild;
}

/** Default destination for authenticated users returning to the app root. */
export function authenticatedHomeDestination(): string {
  return COMMERCIAL_OS_ROUTES.workspace;
}

const LEGACY_PAYMENT_LINKS_PATH = '/dashboard/payment-links';

/** Safe return path for handoffs from Commercial OS back to legacy invoice UI. */
export function legacyPaymentLinksHandoffUrl(options?: {
  action?: 'create';
  invoiceId?: string;
  returnTo?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.action === 'create') params.set('action', 'create');
  if (options?.invoiceId) params.set('invoiceId', options.invoiceId);
  const returnTo = options?.returnTo;
  if (returnTo && returnTo.startsWith('/workspace')) {
    params.set('returnTo', returnTo);
  }
  const query = params.toString();
  return query ? `${LEGACY_PAYMENT_LINKS_PATH}?${query}` : LEGACY_PAYMENT_LINKS_PATH;
}
