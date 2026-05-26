export const OPERATIONAL_ONBOARDING_PHASES = [
  'ONBOARDING_STARTED',
  'WORKSPACE_CREATED',
  'PROJECT_BOOTSTRAPPED',
  'PAYMENT_RAIL_INITIALIZED',
  'STRIPE_CONNECTED',
  'OPERATIONAL_GRAPH_READY',
] as const;

export type OperationalOnboardingPhase = (typeof OPERATIONAL_ONBOARDING_PHASES)[number];

export type OperationalOnboardingState = {
  phase: OperationalOnboardingPhase;
  workspaceReady: boolean;
  projectReady: boolean;
  paymentRailsReady: boolean;
  stripeConnected: boolean;
  graphReady: boolean;
  blockers: string[];
  pendingInitializationSteps: string[];
  primaryProjectId: string | null;
  organizationId: string | null;
  merchantSettingsId: string | null;
  recoveryMessage: string | null;
  correlationId: string;
};

export function isOperationalGraphReady(phase: OperationalOnboardingPhase): boolean {
  return phase === 'OPERATIONAL_GRAPH_READY';
}

export function phaseRank(phase: OperationalOnboardingPhase): number {
  return OPERATIONAL_ONBOARDING_PHASES.indexOf(phase);
}

export function phaseLabel(phase: OperationalOnboardingPhase): string {
  switch (phase) {
    case 'ONBOARDING_STARTED':
      return 'Onboarding started';
    case 'WORKSPACE_CREATED':
      return 'Workspace created';
    case 'PROJECT_BOOTSTRAPPED':
      return 'Project bootstrapped';
    case 'PAYMENT_RAIL_INITIALIZED':
      return 'Payment rails initialized';
    case 'STRIPE_CONNECTED':
      return 'Stripe connected';
    case 'OPERATIONAL_GRAPH_READY':
      return 'Operational graph ready';
  }
}

export function onboardingInitializationProgress(state: OperationalOnboardingState): {
  headline: string;
  steps: Array<{ id: string; label: string; complete: boolean }>;
} {
  return {
    headline: phaseLabel(state.phase),
    steps: [
      { id: 'workspace', label: 'Workspace created', complete: state.workspaceReady },
      { id: 'project', label: 'Project bootstrapped', complete: state.projectReady },
      { id: 'rails', label: 'Payment rails initialized', complete: state.paymentRailsReady },
      { id: 'stripe', label: 'Stripe connected', complete: state.stripeConnected },
      { id: 'graph', label: 'Operational graph ready', complete: state.graphReady },
    ],
  };
}
