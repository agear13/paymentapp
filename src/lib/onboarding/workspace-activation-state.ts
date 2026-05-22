import { computePaymentLinkRailSetup } from '@/lib/payment-links/setup-status';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import { deriveWorkspaceActivationFromOperations } from '@/lib/operations/orchestration/activation-bridge';

export type WorkspaceActivationInput = {
  hasOrganization: boolean;
  onboardingCompleted: boolean;
  projectCreated: boolean;
  participantCount: number;
  participantsConfigured: boolean;
  participantsConfiguredCount: number;
  obligationCount: number;
  paymentLinkCount: number;
  collectionPreferenceDecideLater: boolean;
  defaultCurrency: string | null;
  stripeConfigured: boolean;
  wiseConfigured: boolean;
  hederaConfigured: boolean;
  releaseEligibleCount: number;
  releaseBatchCount: number;
  primaryProjectId: string | null;
};

/**
 * @deprecated Prefer `deriveWorkspaceActivationFromOperations` from `@/lib/operations`.
 * Delegates to the canonical operations layer.
 */
export function deriveWorkspaceActivation(
  input: WorkspaceActivationInput
): WorkspaceActivationSnapshot {
  return deriveWorkspaceActivationFromOperations(input);
}

export function merchantRowToRailFlags(merchant: {
  stripe_account_id: string | null;
  hedera_account_id: string | null;
  wise_enabled: boolean;
  wise_profile_id: string | null;
} | null) {
  const setup = computePaymentLinkRailSetup(merchant);
  return {
    stripeConfigured: setup.stripeConfigured,
    wiseConfigured: setup.wiseConfigured,
    hederaConfigured: setup.hederaConfigured,
  };
}
