export type WorkspaceActivationPhase =
  | 'setup_in_progress'
  | 'ready_to_collect'
  | 'ready_to_coordinate'
  | 'ready_for_release';

export type ActivationChecklistItemId =
  | 'workspace'
  | 'project'
  | 'participants'
  | 'compensation'
  | 'provider'
  | 'revenue'
  | 'currency'
  | 'obligations'
  | 'release';

export type ActivationChecklistItem = {
  id: ActivationChecklistItemId;
  label: string;
  complete: boolean;
};

export type WorkspaceActivationSnapshot = {
  workspaceCreated: boolean;
  projectCreated: boolean;
  participantCount: number;
  participantsConfigured: boolean;
  participantsConfiguredCount: number;
  obligationsCreated: boolean;
  obligationCount: number;
  revenueConfigured: boolean;
  providerConnected: boolean;
  payoutMethodConfigured: boolean;
  releaseEligible: boolean;
  releaseEligibleCount: number;
  firstReleaseCompleted: boolean;
  onboardingCompleted: boolean;
  defaultCurrency: string | null;
  onboardingProgressPercent: number;
  phase: WorkspaceActivationPhase;
  phaseLabel: string;
  checklist: ActivationChecklistItem[];
  activationBlockers: string[];
  setupWarnings: string[];
  /** First project for participant/compensation CTAs */
  primaryProjectId: string | null;
};
