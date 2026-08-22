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
  /** Native participant coordination inside an installed workflow hub. */
  workflowParticipant: (slug: string, participantId: string) =>
    `/workspace/workflows/${slug}?participant=${encodeURIComponent(participantId)}`,
  /** Service catalog operating surface inside Referral Management. */
  workflowServices: (slug: string) => `/workspace/workflows/${slug}?view=services`,
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
  settlement: '/workspace/settlement',
  settlementObligations: '/workspace/settlement/obligations',
  settlementEarnings: '/workspace/settlement/earnings',
  settlementReleases: '/workspace/settlement/releases',
  settlementObligation: (id: string) =>
    `/workspace/settlement/obligations/${encodeURIComponent(id)}`,
  assessment: '/journey/assessment',
  provisioning: '/journey/provisioning',
  /** Journey onboarding continues here after inline auth or OAuth. */
  journeyPostAuth: '/journey/provisioning?build=1',
} as const;

export type SettlementWorkspaceQuery = {
  source?: string;
  status?: string;
  participant?: string;
};

export type SettlementWorkspaceSection = 'overview' | 'obligations' | 'earnings' | 'releases';

function withSettlementQuery(pathname: string, query?: SettlementWorkspaceQuery): string {
  const params = new URLSearchParams();
  if (query?.source?.trim() && query.source !== 'all') {
    params.set('source', query.source.trim());
  }
  if (query?.status?.trim() && query.status !== 'all') {
    params.set('status', query.status.trim());
  }
  if (query?.participant?.trim()) {
    params.set('participant', query.participant.trim());
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Scope that should persist across Settlement tabs (not obligation status). */
export function settlementScopeQuery(
  query?: SettlementWorkspaceQuery | null
): SettlementWorkspaceQuery {
  return {
    source: query?.source,
    participant: query?.participant,
  };
}

export function settlementSectionHref(
  section: SettlementWorkspaceSection,
  query?: SettlementWorkspaceQuery
): string {
  const path =
    section === 'overview'
      ? COMMERCIAL_OS_ROUTES.settlement
      : section === 'obligations'
        ? COMMERCIAL_OS_ROUTES.settlementObligations
        : section === 'earnings'
          ? COMMERCIAL_OS_ROUTES.settlementEarnings
          : COMMERCIAL_OS_ROUTES.settlementReleases;
  return withSettlementQuery(path, query);
}

/** Settlement obligations queue, optionally scoped to a commercial source. */
export function settlementObligationsHref(query?: SettlementWorkspaceQuery): string {
  return withSettlementQuery(COMMERCIAL_OS_ROUTES.settlementObligations, query);
}

/** Settlement earnings, optionally scoped to a commercial source or participant. */
export function settlementEarningsHref(query?: SettlementWorkspaceQuery): string {
  return withSettlementQuery(COMMERCIAL_OS_ROUTES.settlementEarnings, query);
}

/** Settlement overview, optionally scoped to a commercial source. */
export function settlementOverviewHref(query?: SettlementWorkspaceQuery): string {
  return withSettlementQuery(COMMERCIAL_OS_ROUTES.settlement, query);
}

/** Referral Management participant → Settlement Overview, scoped to that participant. */
export function referralParticipantSettlementHref(participantId: string): string {
  return settlementOverviewHref({
    source: 'referral-management',
    participant: participantId,
  });
}

export function settlementReleasesHref(query?: SettlementWorkspaceQuery): string {
  return withSettlementQuery(COMMERCIAL_OS_ROUTES.settlementReleases, query);
}

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
