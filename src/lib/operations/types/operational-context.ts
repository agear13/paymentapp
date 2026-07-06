/**
 * Snapshot inputs for deterministic orchestration.
 * Populated from DB/API — never assume fields exist.
 */

import type { WorkspaceOnboardingStatus } from '@/lib/commercial/supplier-onboarding';

export type WorkspaceOperationalContext = {
  hasOrganization: boolean;
  onboardingCompleted: boolean;
  defaultCurrency: string | null;
  stripeConfigured: boolean;
  wiseConfigured: boolean;
  hederaConfigured: boolean;
  evmWalletConfigured?: boolean;
  anyRailConfigured?: boolean;
  projectCount: number;
  primaryProjectId: string | null;
  participantCount: number;
  participantsConfiguredCount: number;
  obligationCount: number;
  paymentLinkCount: number;
  collectionPreferenceDecideLater: boolean;
  releaseEligibleCount: number;
  releaseBatchCount: number;
  /**
   * Aggregated supplier onboarding status for the workspace.
   * Populated when supplier onboarding data is available.
   * Used by the dashboard widget — omit when not yet derived.
   */
  onboardingWorkspace?: WorkspaceOnboardingStatus;
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
    evmWalletConfigured: false,
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
