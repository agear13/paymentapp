/**
 * Payments & Settlement setup checklist for Commercial OS (display-only).
 */

import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import type { PaymentLinkRailSetupStatus } from '@/lib/payment-links/setup-status';

export type PaymentsSetupChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  optional?: boolean;
};

export type PaymentsSetupReadiness = {
  checklist: PaymentsSetupChecklistItem[];
  doneCount: number;
  requiredDone: boolean;
  customerPaymentsEnabled: boolean;
  remainingLabels: string[];
  estimatedMinutes: number;
};

type BuildPaymentsSetupReadinessInput = {
  activation: WorkspaceActivationSnapshot | null;
  railSetup: PaymentLinkRailSetupStatus | null;
  brandingConfigured: boolean;
  accountingConnected: boolean;
  manualBankConfigured: boolean;
};

export function buildPaymentsSetupReadiness(
  input: BuildPaymentsSetupReadinessInput
): PaymentsSetupReadiness {
  const activation = input.activation;
  const anyProvider =
    Boolean(input.railSetup?.anyRailConfigured) || input.manualBankConfigured;

  const checklist: PaymentsSetupChecklistItem[] = [
    {
      id: 'organization',
      label: 'Organization configured',
      done: activation?.workspaceCreated ?? false,
    },
    {
      id: 'branding',
      label: 'Branding configured',
      done: input.brandingConfigured,
    },
    {
      id: 'provider',
      label: 'Payment provider connected',
      done: anyProvider || (activation?.providerConnected ?? false),
    },
    {
      id: 'settlement',
      label: 'Settlement configured',
      done: activation?.releaseEligible ?? false,
    },
    {
      id: 'earnings',
      label: 'Participant earnings configured',
      done: activation?.participantsConfigured ?? false,
    },
    {
      id: 'accounting',
      label: 'Accounting connected (optional)',
      done: input.accountingConnected,
      optional: true,
    },
  ];

  const doneCount = checklist.filter((item) => item.done).length;
  const requiredDone = checklist.filter((item) => !item.optional).every((item) => item.done);
  const remainingLabels = checklist.filter((item) => !item.done).map((item) => item.label);

  const customerPaymentsEnabled =
    activation?.firstReleaseCompleted === true ||
    (anyProvider && activation?.providerConnected === true);

  let estimatedMinutes = 0;
  if (!activation?.workspaceCreated) estimatedMinutes += 5;
  if (!input.brandingConfigured) estimatedMinutes += 3;
  if (!anyProvider) estimatedMinutes += 5;
  if (!activation?.participantsConfigured) estimatedMinutes += 10;
  if (!activation?.releaseEligible) estimatedMinutes += 10;

  return {
    checklist,
    doneCount,
    requiredDone,
    customerPaymentsEnabled,
    remainingLabels,
    estimatedMinutes: Math.min(estimatedMinutes, 30) || 15,
  };
}
