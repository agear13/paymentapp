import { computePaymentLinkRailSetup } from '@/lib/payment-links/setup-status';

import type {

  PaymentLinkMerchantRailSnapshot,

  PaymentRailPlatformFeatures,

} from '@/lib/payment-links/setup-status';

import { getMultiCheckoutRailIds } from '@/lib/payments/payment-rail-registry';

import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';

import { deriveWorkspaceActivationFromOperations } from '@/lib/operations/orchestration/activation-bridge';



export function resolveAnyRailConfigured(input: {

  stripeConfigured: boolean;

  wiseConfigured: boolean;

  hederaConfigured: boolean;

  evmWalletConfigured?: boolean;

  anyRailConfigured?: boolean;

}): boolean {
  const perRail =
    input.stripeConfigured ||
    input.wiseConfigured ||
    input.hederaConfigured ||
    input.evmWalletConfigured === true;

  // Registry aggregate when true; otherwise fall back to per-rail flags so legacy
  // contexts (e.g. defaultWorkspaceContext with stripeConfigured) are not masked
  // by an explicit false placeholder on anyRailConfigured.
  return (input.anyRailConfigured ?? false) || perRail;
}



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

  evmWalletConfigured?: boolean;

  anyRailConfigured?: boolean;

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



/** Bridges registry readiness to legacy per-rail flags used by the operations layer. */

export function merchantRowToRailFlags(

  merchant: PaymentLinkMerchantRailSnapshot | null,

  features: PaymentRailPlatformFeatures = {}

) {

  const setup = computePaymentLinkRailSetup(merchant, features);

  const flags = Object.fromEntries(

    getMultiCheckoutRailIds().map((id) => [

      id === 'evm_wallet' ? 'evmWalletConfigured' : `${id}Configured`,

      setup.multiRails[id].configured,

    ])

  ) as {

    stripeConfigured: boolean;

    hederaConfigured: boolean;

    wiseConfigured: boolean;

    evmWalletConfigured: boolean;

  };



  return {

    ...flags,

    anyRailConfigured: setup.anyRailConfigured,

  };

}


