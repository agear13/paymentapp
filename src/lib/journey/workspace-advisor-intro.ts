import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import {
  parseJourneyAssessmentContext,
  type JourneyAssessmentSnapshot,
} from '@/lib/journey/journey-assessment-storage.client';
import {
  accountingIsConnectable,
  accountingIsNonConnectable,
  deriveWorkspaceRecommendation,
  listedPaymentSystems,
  recommendationSourceLabel,
  type WorkspaceRecommendation,
  type WorkspaceRecommendationState,
} from '@/lib/journey/workspace-recommendation';

export const JOURNEY_OBJECTIVE_LABELS: Record<string, string> = {
  'paid-faster': 'Get paid faster',
  reconcile: 'Reconcile invoices automatically',
  'reduce-admin': 'Reduce admin',
  forecast: 'Forecast cashflow',
  'revenue-share': 'Revenue sharing',
  reporting: 'Improve reporting',
  other: 'Something else',
};

export const ADVISOR_LEARNING_NOTE =
  "As you use Provvy, I'll recommend workflows, connected systems and automation based on how you actually work.";

export const ADVISOR_NO_ACTIVITY_NOTE =
  'There is no commercial activity to learn from yet.';

export const ADVISOR_HAS_ACTIVITY_NOTE =
  'I can see commercial activity in your workspace — invoices, payments or connected work that has already happened.';

/** Factual timeline summary only. Not an observed recommendation. */
export function deriveAdvisorActivityNote(input: {
  timelineLoaded: boolean;
  hasCommercialActivity: boolean;
}): string | null {
  if (!input.timelineLoaded) return null;
  return input.hasCommercialActivity ? ADVISOR_HAS_ACTIVITY_NOTE : ADVISOR_NO_ACTIVITY_NOTE;
}

export type WorkspaceAdvisorWorkspaceState = WorkspaceRecommendationState;

export type WorkspaceAdvisorFinding = {
  key: 'industry' | 'objective' | 'accounting' | 'systems' | 'challenge';
  label: string;
  value: string;
};

export type WorkspaceAdvisorSecondaryCta = {
  label: string;
  href: string;
};

export type WorkspaceAdvisorIntro = {
  displayName: string | null;
  greeting: string;
  /** Setup-stage until observed-activity recommendations exist. */
  status: 'setup' | 'observed';
  statusLabel: string;
  findings: WorkspaceAdvisorFinding[];
  recommendation: WorkspaceRecommendation | null;
  recommendationSourceLabel: string | null;
  learningNote: string;
  systemsCta: WorkspaceAdvisorSecondaryCta | null;
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

/**
 * @deprecated Legacy objective→workflow mapping. Not used by the setup-stage
 * recommendation heuristic or Workspace start screen. Kept so tests can lock
 * that it is not reintroduced as the recommendation engine.
 */
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
  const systems = snapshot.business?.systems?.map((item) => item.trim()).filter(Boolean) ?? [];

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
  if (systems.length > 0) {
    findings.push({ key: 'systems', label: 'Existing systems', value: systems.join(', ') });
  }
  if (challenge) {
    findings.push({ key: 'challenge', label: 'Primary challenge', value: challenge });
  }

  return findings;
}

export function deriveAdvisorSecondaryCta(input: {
  snapshot: JourneyAssessmentSnapshot;
  workspace: WorkspaceAdvisorWorkspaceState;
  recommendation: WorkspaceRecommendation | null;
}): WorkspaceAdvisorSecondaryCta | null {
  const objective = input.snapshot.objective?.trim() || null;
  const accounting = input.snapshot.business?.accounting?.trim() || undefined;
  const challenge = input.snapshot.business?.challenge?.trim() || undefined;
  const systems = input.snapshot.business?.systems;

  if (input.workspace.xeroConnected) {
    return {
      label: 'Review your connected systems',
      href: COMMERCIAL_OS_ROUTES.connected,
    };
  }

  if (accountingIsNonConnectable(accounting)) {
    if (input.recommendation) return null;
    if (objective === 'paid-faster' || challenge === 'Late payments' || listedPaymentSystems(systems)) {
      return {
        label: 'Set up payment methods',
        href: COMMERCIAL_OS_ROUTES.paymentsProviders,
      };
    }
    if (objective === 'revenue-share' || objective === 'other' || objective === 'forecast' || objective === 'reporting') {
      return {
        label: 'Open Workflow Library',
        href: COMMERCIAL_OS_ROUTES.workflows,
      };
    }
    return null;
  }

  if (input.recommendation) {
    return null;
  }

  if (accountingIsConnectable(accounting)) {
    return {
      label: 'Connect Xero',
      href: COMMERCIAL_OS_ROUTES.connected,
    };
  }

  if (objective === 'paid-faster' || challenge === 'Late payments' || listedPaymentSystems(systems)) {
    return {
      label: 'Set up payment methods',
      href: COMMERCIAL_OS_ROUTES.paymentsProviders,
    };
  }

  if (objective === 'revenue-share') {
    return {
      label: 'Open Workflow Library',
      href: COMMERCIAL_OS_ROUTES.workflows,
    };
  }

  return null;
}

export function workspaceBuiltHeadline(): string {
  return "I've built your workspace around what you told me.";
}

export function workspaceBuiltSupporting(): string {
  return "Based on your goals and how your business works, I've started you with the tools that are most relevant.";
}

export function workspaceObjectivePriorityLine(
  snapshot: JourneyAssessmentSnapshot
): string | null {
  const objective = snapshot.objective?.trim();
  if (!objective) return null;

  switch (objective) {
    case 'reconcile':
      return "I've prioritised reconciliation because you told me that's where you'd like to start.";
    case 'reduce-admin':
      return "I've prioritised reducing admin because you told me that's where you'd like to start.";
    case 'paid-faster':
      return "I've prioritised payment and collections because you told me getting paid faster is your priority.";
    case 'forecast':
      return "I've prioritised cashflow visibility because you told me forecasting matters most.";
    case 'revenue-share':
      return "I've prioritised revenue sharing because that's where you'd like to start.";
    case 'reporting':
      return "I've prioritised reporting because you told me understanding operations matters most.";
    case 'other':
    default:
      return null;
  }
}

export type WorkspaceFirstStep = {
  body: string;
  ctaLabel: string;
  destination: string;
};

function conversationalFirstStepBody(
  objective: string | undefined,
  recommendation: WorkspaceRecommendation
): string | null {
  if (
    (objective === 'reconcile' || objective === 'reduce-admin') &&
    recommendation.kind === 'accounting'
  ) {
    return "Connect your accounting system first. That will give me the context I need to help automate reconciliation and surface exceptions.";
  }
  if (objective === 'paid-faster' && recommendation.kind === 'payment_rail') {
    return "Start by connecting your invoicing or accounting system. That will let me see what's outstanding and identify where cash is getting stuck.";
  }
  return null;
}

export function deriveWorkspaceFirstStep(input: {
  snapshot: JourneyAssessmentSnapshot;
  recommendation: WorkspaceRecommendation | null;
}): WorkspaceFirstStep {
  const { snapshot, recommendation } = input;
  const objective = snapshot.objective?.trim();

  if (!recommendation) {
    return {
      body: "Connect a business system to give me more context. I'll then recommend the best next step for your business.",
      ctaLabel: 'Connect your business →',
      destination: COMMERCIAL_OS_ROUTES.connected,
    };
  }

  return {
    body:
      conversationalFirstStepBody(objective, recommendation) ?? recommendation.description,
    ctaLabel: `${recommendation.actionLabel} →`,
    destination: recommendation.destination,
  };
}

export function buildWorkspaceAdvisorIntro(input: {
  snapshot: JourneyAssessmentSnapshot;
  workspace: WorkspaceAdvisorWorkspaceState;
  displayName?: string | null;
}): WorkspaceAdvisorIntro {
  const findings = collectAdvisorFindings(input.snapshot);
  const recommendation = deriveWorkspaceRecommendation({
    snapshot: input.snapshot,
    workspace: input.workspace,
  });

  return {
    displayName: input.displayName ?? null,
    greeting: input.displayName ? `Welcome, ${input.displayName}` : 'Welcome',
    status: 'setup',
    statusLabel: 'Ready to learn from your workflows',
    findings,
    recommendation,
    recommendationSourceLabel: recommendationSourceLabel(recommendation),
    learningNote: ADVISOR_LEARNING_NOTE,
    systemsCta: deriveAdvisorSecondaryCta({
      snapshot: input.snapshot,
      workspace: input.workspace,
      recommendation,
    }),
    advisorHref: COMMERCIAL_OS_ROUTES.advisor,
  };
}

/**
 * @deprecated Legacy objective→card mapping. Not used by Workspace start or
 * the setup-stage recommendation heuristic. Tests lock that the start screen
 * does not import this helper.
 */
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
