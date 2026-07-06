/**
 * Merchant / org setup inspection for Payment Links onboarding (Provvypay Copilot).
 * Server-only data access — call from API routes.
 */

import { loadPaymentLinksOrgContext } from '@/lib/payment-links/org-context.server';
import {
  isMultiCheckoutRailConfigured,
  isMultiCheckoutRailIncomplete,
} from '@/lib/payment-links/setup-status';
import {
  getMultiCheckoutRails,
  multiCheckoutMerchantLabels,
} from '@/lib/payments/payment-rail-registry';

export type MerchantSetupStepStatus = 'complete' | 'incomplete' | 'attention';

export type MerchantSetupActionIntent = 'open_merchant_settings' | 'scroll_create_invoice';

export type MerchantSetupStep = {
  code: string;
  title: string;
  status: MerchantSetupStepStatus;
  description: string;
  actionLabel?: string;
  actionIntent?: MerchantSetupActionIntent;
};

export type MerchantSetupOverallStatus = 'not_started' | 'incomplete' | 'ready';

export type MerchantSetupNextAction = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionIntent?: MerchantSetupActionIntent;
};

export type MerchantSetupStatusResult = {
  organizationId: string;
  overallStatus: MerchantSetupOverallStatus;
  summary: string;
  steps: MerchantSetupStep[];
  showOnboardingAssistant: boolean;
  /** Best next step for the user (first attention, else first incomplete). */
  nextRecommendedAction: MerchantSetupNextAction | null;
};

/**
 * Loads merchant settings and payment link counts, returns structured onboarding status.
 * Rail flags come from {@link computePaymentLinkRailSetup} (shared with Payment Links guardrails).
 */
export async function getMerchantSetupStatus(organizationId: string): Promise<MerchantSetupStatusResult> {
  const { railSetup: setup, paymentLinkCount } = await loadPaymentLinksOrgContext(organizationId);
  const hasRail = setup.anyRailConfigured;
  const hasFirstInvoice = paymentLinkCount > 0;

  const steps: MerchantSetupStep[] = [];

  if (!hasRail) {
    steps.push({
      code: 'no_payment_rail_configured',
      title: 'No payment method configured',
      status: 'incomplete',
      description: `Connect at least one rail (${multiCheckoutMerchantLabels()}) in merchant settings before customers can pay you.`,
      actionLabel: 'Open merchant settings',
      actionIntent: 'open_merchant_settings',
    });
  }

  for (const rail of getMultiCheckoutRails()) {
    const configured = isMultiCheckoutRailConfigured(setup, rail.id);
    const incomplete = isMultiCheckoutRailIncomplete(setup, rail.id);

    let status: MerchantSetupStepStatus = 'incomplete';
    let description =
      rail.merchantSetupIncompleteDescription ??
      `Configure ${rail.merchantSettingsLabel} in collection & settlement setup.`;

    if (configured) {
      status = 'complete';
      description =
        rail.merchantSetupCompleteDescription ??
        `${rail.merchantSettingsLabel} is configured.`;
    } else if (incomplete) {
      status = 'attention';
      description =
        rail.merchantSetupAttentionDescription ??
        `${rail.merchantSettingsLabel} is enabled but missing required configuration.`;
    }

    steps.push({
      code: rail.id,
      title: rail.merchantSettingsLabel,
      status,
      description,
      actionLabel: status === 'complete' ? undefined : 'Configure in merchant settings',
      actionIntent: status === 'complete' ? undefined : 'open_merchant_settings',
    });
  }

  steps.push({
    code: 'first_payment_link',
    title: 'First invoice',
    status: hasFirstInvoice ? 'complete' : 'incomplete',
    description: hasFirstInvoice
      ? `At least one invoice exists (${paymentLinkCount} total).`
      : 'Create your first invoice to generate a payment link for customers.',
    actionLabel: hasFirstInvoice ? undefined : 'Create invoice',
    actionIntent: hasFirstInvoice ? undefined : 'scroll_create_invoice',
  });

  const hasAttention = steps.some((s) => s.status === 'attention');

  /** Ready = can receive $ (≥1 rail) + at least one invoice; incomplete rails block until fixed. */
  let overallStatus: MerchantSetupOverallStatus;
  if (!hasRail && !hasFirstInvoice) {
    overallStatus = 'not_started';
  } else if (!hasRail || !hasFirstInvoice || hasAttention) {
    overallStatus = 'incomplete';
  } else {
    overallStatus = 'ready';
  }

  const showOnboardingAssistant = overallStatus !== 'ready';

  let summary: string;
  if (overallStatus === 'ready') {
    summary =
      'Your workspace has an active payment rail and at least one invoice. You can dismiss this checklist.';
  } else if (overallStatus === 'not_started') {
    summary =
      'Start by connecting a payment rail in merchant settings, then create your first invoice.';
  } else if (hasAttention) {
    const attentionRail = steps.find((s) => s.status === 'attention');
    summary = attentionRail
      ? `Resolve the highlighted item (${attentionRail.title} needs attention), then confirm your first invoice is created.`
      : 'Resolve the highlighted setup items, then confirm your first invoice is created.';
  } else {
    summary =
      'Finish the remaining items below to start collecting payments with confidence.';
  }

  const attentionStep = steps.find((s) => s.status === 'attention');
  const incompleteStep = steps.find((s) => s.status === 'incomplete');
  const pick = attentionStep ?? incompleteStep;
  const nextRecommendedAction: MerchantSetupNextAction | null =
    overallStatus === 'ready' || !pick
      ? null
      : {
          title: pick.title,
          description: pick.description,
          actionLabel: pick.actionLabel,
          actionIntent: pick.actionIntent,
        };

  return {
    organizationId,
    overallStatus,
    summary,
    steps,
    showOnboardingAssistant,
    nextRecommendedAction,
  };
}

