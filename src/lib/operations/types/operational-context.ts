/**
 * Snapshot inputs for deterministic orchestration.
 * Populated from DB/API — never assume fields exist.
 */

export type WorkspaceOperationalContext = {
  hasOrganization: boolean;
  onboardingCompleted: boolean;
  defaultCurrency: string | null;
  stripeConfigured: boolean;
  wiseConfigured: boolean;
  hederaConfigured: boolean;
  projectCount: number;
  primaryProjectId: string | null;
  participantCount: number;
  participantsConfiguredCount: number;
  obligationCount: number;
  paymentLinkCount: number;
  collectionPreferenceDecideLater: boolean;
  releaseEligibleCount: number;
  releaseBatchCount: number;
};

export type ProjectOperationalContext = {
  projectId: string;
  setupStatus?: string;
  participantCount: number;
  participantsPayoutReadyCount: number;
  participantsConfiguredCount: number;
  obligationCount: number;
  hasFundingSources: boolean;
  releaseEligibleCount: number;
  providerConnected: boolean;
};

export type GlobalOperationalContext = {
  workspace: WorkspaceOperationalContext;
  /** Optional project snapshots; defaults to empty when omitted */
  projects?: ProjectOperationalContext[];
};

export function defaultWorkspaceContext(): WorkspaceOperationalContext {
  return {
    hasOrganization: false,
    onboardingCompleted: false,
    defaultCurrency: null,
    stripeConfigured: false,
    wiseConfigured: false,
    hederaConfigured: false,
    projectCount: 0,
    primaryProjectId: null,
    participantCount: 0,
    participantsConfiguredCount: 0,
    obligationCount: 0,
    paymentLinkCount: 0,
    collectionPreferenceDecideLater: true,
    releaseEligibleCount: 0,
    releaseBatchCount: 0,
  };
}
