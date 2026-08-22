import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import {
  parseJourneyAssessmentContext,
  type JourneyAssessmentBusiness,
  type JourneyAssessmentSnapshot,
} from '@/lib/journey/journey-assessment-storage.client';

export const JOURNEY_OBJECTIVE_LABELS: Record<string, string> = {
  'paid-faster': 'Get paid faster',
  reconcile: 'Reconcile invoices automatically',
  'reduce-admin': 'Reduce admin',
  forecast: 'Forecast cashflow',
  'revenue-share': 'Revenue sharing',
  reporting: 'Improve reporting',
  other: 'Something else',
};

const CONNECTABLE_ACCOUNTING = new Set(['Xero']);

export type WorkspaceAdvisorWorkspaceState = {
  xeroConnected: boolean;
  deployedWorkflowSlugs: string[];
};

export type WorkspaceAdvisorFinding = {
  key: 'industry' | 'objective' | 'accounting' | 'challenge';
  label: string;
  value: string;
};

export type WorkspaceAdvisorPrimaryAction = {
  label: string;
  href: string;
  kind: 'connect' | 'review-workflow' | 'start';
};

export type WorkspaceAdvisorIntro = {
  displayName: string | null;
  greeting: string;
  status: 'learning' | 'ready';
  statusLabel: string;
  findings: WorkspaceAdvisorFinding[];
  recommendation: string;
  primary: WorkspaceAdvisorPrimaryAction;
  systemsCta: {
    label: 'Connect your systems' | 'Review your connected systems';
    href: string;
  };
  advisorHref: string;
};

export function advisorDisplayName(input: {
  fullName?: string | null;
  email?: string | null;
}): string | null {
  const full = input.fullName?.trim();
  if (full) {
    return full.split(/\s+/)[0] ?? null;
  }
  const local = input.email?.split('@')[0]?.trim();
  return local && local.length >= 2 ? local : null;
}

export function snapshotFromOnboardingPayload(payload: {
  state?: {
    onboarding_context?: string | null;
    workspace_industry?: string | null;
  } | null;
}): JourneyAssessmentSnapshot | null {
  const context = parseJourneyAssessmentContext(payload.state?.onboarding_context);
  if (context) {
    return { objective: context.objective, business: context.business };
  }

  const industry = payload.state?.workspace_industry?.trim();
  if (industry) {
    return { objective: null, business: { industry } };
  }

  return null;
}

export function recommendedWorkflowSlug(
  objective: string | null,
  savedSlug?: string | null
): string | null {
  if (savedSlug?.trim()) return savedSlug.trim();
  switch (objective) {
    case 'reconcile':
    case 'reduce-admin':
      return 'autonomous-reconciliation';
    case 'forecast':
      return 'cashflow-forecasting';
    case 'revenue-share':
      return 'revenue-sharing';
    case 'paid-faster':
      return 'payment-collection';
    case 'reporting':
      return 'commercial-operations';
    default:
      return null;
  }
}

export function collectAdvisorFindings(
  snapshot: JourneyAssessmentSnapshot
): WorkspaceAdvisorFinding[] {
  const findings: WorkspaceAdvisorFinding[] = [];
  const industry = snapshot.business?.industry?.trim();
  const objective = snapshot.objective?.trim();
  const accounting = snapshot.business?.accounting?.trim();
  const challenge = snapshot.business?.challenge?.trim();

  if (industry) {
    findings.push({ key: 'industry', label: 'Industry', value: industry });
  }
  if (objective && JOURNEY_OBJECTIVE_LABELS[objective]) {
    findings.push({
      key: 'objective',
      label: 'Primary objective',
      value: JOURNEY_OBJECTIVE_LABELS[objective],
    });
  }
  if (accounting) {
    findings.push({ key: 'accounting', label: 'Accounting', value: accounting });
  }
  if (challenge) {
    findings.push({ key: 'challenge', label: 'Primary challenge', value: challenge });
  }

  return findings;
}

function accountingRequiresConnection(accounting?: string | null): boolean {
  return Boolean(accounting && CONNECTABLE_ACCOUNTING.has(accounting));
}

function recommendedWorkflowRequiresAccounting(objective: string | null, workflowSlug: string | null): boolean {
  if (workflowSlug === 'autonomous-reconciliation') return true;
  return objective === 'reconcile' || objective === 'reduce-admin';
}

function startActionForObjective(objective: string | null): WorkspaceAdvisorPrimaryAction {
  switch (objective) {
    case 'paid-faster':
      return {
        kind: 'start',
        label: 'Create a payment link',
        href: COMMERCIAL_OS_ROUTES.createInvoice,
      };
    case 'forecast':
    case 'reporting':
      return {
        kind: 'start',
        label: 'Open Collections & Revenue',
        href: COMMERCIAL_OS_ROUTES.timeline,
      };
    case 'reduce-admin':
      return {
        kind: 'start',
        label: 'Manage invoices',
        href: COMMERCIAL_OS_ROUTES.receivables,
      };
    case 'revenue-share':
      return {
        kind: 'start',
        label: 'Review workflows',
        href: COMMERCIAL_OS_ROUTES.workflows,
      };
    case 'reconcile':
    case 'other':
    default:
      return {
        kind: 'start',
        label: 'Create invoice',
        href: COMMERCIAL_OS_ROUTES.createInvoice,
      };
  }
}

function recommendationForPrimary(
  primary: WorkspaceAdvisorPrimaryAction,
  input: {
    objective: string | null;
    accounting?: string;
    workflowName?: string;
  }
): string {
  if (primary.kind === 'connect') {
    const software = input.accounting ?? 'your accounting software';
    return `Connect ${software} so Provvy can start coordinating invoices, payments and your ledger.`;
  }
  if (primary.kind === 'review-workflow' && input.workflowName) {
    return `Review ${input.workflowName} — it's already in your workspace from setup.`;
  }

  switch (input.objective) {
    case 'paid-faster':
      return 'Create a payment link so customers can pay as soon as they receive an invoice.';
    case 'forecast':
    case 'reporting':
      return 'Open Collections & Revenue to start seeing commercial activity in one place.';
    case 'reduce-admin':
      return 'Open Manage invoices to start reducing follow-up and bookkeeping work from one list.';
    case 'revenue-share':
      return 'Open Workflows to choose how you want to split and settle revenue.';
    case 'reconcile':
      return 'Create an invoice so incoming payments have something to reconcile against.';
    default:
      return 'Create an invoice to start a first commercial loop in this workspace.';
  }
}

export function buildWorkspaceAdvisorIntro(input: {
  snapshot: JourneyAssessmentSnapshot;
  workspace: WorkspaceAdvisorWorkspaceState;
  displayName?: string | null;
  savedRecommendedWorkflow?: string | null;
}): WorkspaceAdvisorIntro {
  const objective = input.snapshot.objective;
  const business: JourneyAssessmentBusiness = input.snapshot.business ?? {};
  const findings = collectAdvisorFindings(input.snapshot);
  const workflowSlug = recommendedWorkflowSlug(objective, input.savedRecommendedWorkflow);
  const catalog = workflowSlug ? getWorkflowBySlug(workflowSlug) : undefined;
  const workflowDeployed = Boolean(
    workflowSlug && input.workspace.deployedWorkflowSlugs.includes(workflowSlug)
  );
  const needsAccounting =
    recommendedWorkflowRequiresAccounting(objective, workflowSlug) &&
    accountingRequiresConnection(business.accounting);
  const missingAccounting = needsAccounting && !input.workspace.xeroConnected;

  let primary: WorkspaceAdvisorPrimaryAction;
  if (missingAccounting) {
    primary = {
      kind: 'connect',
      label: business.accounting ? `Connect ${business.accounting}` : 'Connect your systems',
      href: COMMERCIAL_OS_ROUTES.connected,
    };
  } else if (workflowDeployed && catalog) {
    primary = {
      kind: 'review-workflow',
      label: `Review ${catalog.name}`,
      href: COMMERCIAL_OS_ROUTES.workflowInstance(catalog.slug),
    };
  } else {
    primary = startActionForObjective(objective);
  }

  const hasConnectedContext =
    input.workspace.xeroConnected || input.workspace.deployedWorkflowSlugs.length > 0;

  return {
    displayName: input.displayName ?? null,
    greeting: input.displayName ? `Welcome, ${input.displayName}` : 'Welcome',
    status: hasConnectedContext ? 'learning' : 'ready',
    statusLabel: hasConnectedContext
      ? 'Learning from your workspace'
      : 'Ready to learn from your workflows',
    findings,
    recommendation: recommendationForPrimary(primary, {
      objective,
      accounting: business.accounting,
      workflowName: catalog?.name,
    }),
    primary,
    systemsCta: {
      label: input.workspace.xeroConnected
        ? 'Review your connected systems'
        : 'Connect your systems',
      href: COMMERCIAL_OS_ROUTES.connected,
    },
    advisorHref: COMMERCIAL_OS_ROUTES.advisor,
  };
}

export function workspaceStartCardIdForObjective(
  objective: string | null
): 'create-invoice' | 'manage-invoices' | 'sync-xero' | 'collections' | 'workspace' | null {
  switch (objective) {
    case 'forecast':
    case 'reporting':
      return 'collections';
    case 'reduce-admin':
      return 'manage-invoices';
    case 'paid-faster':
    case 'reconcile':
    case 'revenue-share':
    case 'other':
      return 'create-invoice';
    default:
      return null;
  }
}
