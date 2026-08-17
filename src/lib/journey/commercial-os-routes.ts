/**
 * Authenticated Commercial OS routes (Lovable workspace UX).
 * Source: src/lovable-import/src/routes/workspace*
 */

export const COMMERCIAL_OS_ROUTES = {
  provisioningBuild: '/journey/provisioning?build=1',
  workspace: '/workspace',
  commercialWorkspace: '/workspace/commercial',
  receivables: '/workspace/receivables',
  createInvoice: '/workspace/receivables/create',
  invoiceList: '/workspace/receivables/invoices',
  invoiceDetail: (reference: string, options?: { id?: string }) => {
    const encoded = encodeURIComponent(reference.trim());
    const base = `/workspace/invoice/${encoded}`;
    if (options?.id?.trim()) {
      return `${base}?id=${encodeURIComponent(options.id.trim())}`;
    }
    return base;
  },
  invoiceHrefFromLink: (link: {
    id: string;
    invoiceReference?: string | null;
    shortCode?: string | null;
  }) => {
    const reference =
      link.invoiceReference?.trim() || link.shortCode?.trim() || link.id;
    return COMMERCIAL_OS_ROUTES.invoiceDetail(reference, { id: link.id });
  },
  workflows: '/workspace/workflows',
  workflowLibrary: '/workspace/workflows',
  /** Marketplace preview — always the capability/detail page. */
  workflowDetail: (slug: string) => `/workspace/workflows/${slug}/preview`,
  /** Installed workflow operating surface. */
  workflowInstance: (slug: string) => `/workspace/workflows/${slug}`,
  publicWorkflowDetail: (slug: string) => `/journey/workflows/${slug}`,
  workflowReconciliation: '/workspace/workflow/reconciliation',
  workflowReconciliationTour: '/workspace/workflow/reconciliation?tour=1',
  timeline: '/workspace/timeline',
  connected: '/workspace/connected',
  connectedXero: '/workspace/connected/xero',
  historicalAccountingSync: '/workspace/connected/xero/historical-sync',
  advisor: '/workspace/advisor',
  settings: '/workspace/settings',
  planBilling: '/workspace/settings/plan',
  accountProfile: '/workspace/settings/account',
  accountPreferences: '/workspace/settings/preferences',
  accountSecurity: '/workspace/settings/security',
  payments: '/workspace/payments',
  treasury: '/workspace/treasury',
  assessment: '/journey/assessment',
  provisioning: '/journey/provisioning',
  /** Journey onboarding continues here after inline auth or OAuth. */
  journeyPostAuth: '/journey/provisioning?build=1',
} as const;

/** Default destination immediately after a successful sign-in. */
export function postLoginDestination(): string {
  return COMMERCIAL_OS_ROUTES.provisioningBuild;
}

/** Destination after journey assessment auth (workspace bootstrap + assessment save). */
export function journeyPostAuthDestination(): string {
  return COMMERCIAL_OS_ROUTES.journeyPostAuth;
}

/** OAuth/email callback redirect for journey onboarding (must stay on journey routes). */
export function journeyAuthCallbackUrl(origin: string): string {
  const redirectedFrom = encodeURIComponent(COMMERCIAL_OS_ROUTES.journeyPostAuth);
  return `${origin}/auth/callback?redirectedFrom=${redirectedFrom}`;
}

/** Default destination for authenticated users returning to the app root. */
export function authenticatedHomeDestination(): string {
  return COMMERCIAL_OS_ROUTES.workspace;
}

/** @deprecated Use COMMERCIAL_OS_ROUTES.invoiceList or createInvoice instead. */
export function legacyPaymentLinksHandoffUrl(options?: {
  action?: 'create';
  invoiceId?: string;
  returnTo?: string;
}): string {
  if (options?.action === 'create') {
    return COMMERCIAL_OS_ROUTES.createInvoice;
  }
  if (options?.invoiceId?.trim()) {
    return COMMERCIAL_OS_ROUTES.invoiceDetail(options.invoiceId, {
      id: options.invoiceId,
    });
  }
  return COMMERCIAL_OS_ROUTES.invoiceList;
}

/** Initiate production Xero OAuth from Commercial OS (return path stored in signed state). */
export function xeroConnectUrl(organizationId: string, returnTo: string): string {
  const params = new URLSearchParams();
  params.set('organization_id', organizationId);
  params.set('return_to', returnTo);
  return `/api/xero/connect?${params.toString()}`;
}
