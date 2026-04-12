/**
 * Merchant / org setup inspection for Payment Links onboarding (Provvypay Copilot).
 * Server-only data access — call from API routes.
 */

import { prisma } from '@/lib/server/prisma';
import { computePaymentLinkRailSetup } from '@/lib/payment-links/setup-status';

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
  const [merchant, paymentLinkCount] = await Promise.all([
    prisma.merchant_settings.findFirst({
      where: { organization_id: organizationId },
      select: {
        stripe_account_id: true,
        hedera_account_id: true,
        wise_enabled: true,
        wise_profile_id: true,
      },
    }),
    prisma.payment_links.count({
      where: { organization_id: organizationId },
    }),
  ]);

  const setup = computePaymentLinkRailSetup(merchant);
  const hasRail = setup.anyRailConfigured;
  const hasStripe = setup.stripeConfigured;
  const hasWise = setup.wiseConfigured;
  const hasHedera = setup.hederaConfigured;
  const hasFirstInvoice = paymentLinkCount > 0;

  const steps: MerchantSetupStep[] = [];

  if (!hasRail) {
    steps.push({
      code: 'no_payment_rail_configured',
      title: 'No payment method configured',
      status: 'incomplete',
      description:
        'Connect at least one rail (Stripe, Wise, or Hedera) in merchant settings before customers can pay you.',
      actionLabel: 'Open merchant settings',
      actionIntent: 'open_merchant_settings',
    });
  }

  steps.push({
    code: 'stripe',
    title: 'Stripe',
    status: hasStripe ? 'complete' : 'incomplete',
    description: hasStripe
      ? 'Stripe Connect is linked for card and wallet checkouts.'
      : 'Connect Stripe to accept card payments through Payment Links.',
    actionLabel: hasStripe ? undefined : 'Configure in merchant settings',
    actionIntent: hasStripe ? undefined : 'open_merchant_settings',
  });

  let wiseStepStatus: MerchantSetupStepStatus = 'incomplete';
  let wiseDescription =
    'Enable Wise and attach a Wise profile to offer bank-friendly payouts where supported.';
  if (hasWise) {
    wiseStepStatus = 'complete';
    wiseDescription = 'Wise is enabled and a profile is on file.';
  } else if (setup.wiseIncomplete) {
    wiseStepStatus = 'attention';
    wiseDescription =
      'Wise is toggled on but no profile ID is set — finish Wise setup in merchant settings.';
  }

  steps.push({
    code: 'wise',
    title: 'Wise',
    status: wiseStepStatus,
    description: wiseDescription,
    actionLabel: wiseStepStatus === 'complete' ? undefined : 'Review Wise setup',
    actionIntent: wiseStepStatus === 'complete' ? undefined : 'open_merchant_settings',
  });

  steps.push({
    code: 'hedera_wallet',
    title: 'Hedera wallet',
    status: hasHedera ? 'complete' : 'incomplete',
    description: hasHedera
      ? 'A Hedera account is configured for on-ledger settlement options.'
      : 'Optionally add a Hedera account ID for supported token flows.',
    actionLabel: hasHedera ? undefined : 'Add Hedera account',
    actionIntent: hasHedera ? undefined : 'open_merchant_settings',
  });

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

  /** Ready = can receive $ (≥1 rail) + at least one invoice; Wise “attention” blocks until fixed. */
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
    summary =
      'Resolve the highlighted item (Wise needs attention), then confirm your first invoice is created.';
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
