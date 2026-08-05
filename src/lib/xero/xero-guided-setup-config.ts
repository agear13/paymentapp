import type { GuidedSetupConfig, GuidedSetupStep } from '@/lib/commercial-os/guided-setup';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { CLEARING_ACCOUNTS_EXPLANATION } from '@/lib/xero/xero-setup-guidance';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import type { XeroReadinessResult } from '@/lib/commercial-os/xero-readiness';

export const XERO_GUIDED_SETUP_CONFIG: GuidedSetupConfig = {
  id: 'xero',
  introTitle: 'Optional walkthrough',
  introSubtitle:
    'We can highlight each section on this page. The checklist at the top shows what you still need to do.',
  estimatedTime: '2–3 minutes',
  completion: {
    title: 'Walkthrough complete',
    body: 'Use the checklist at the top when you are ready to create an invoice.',
    bullets: [],
    primaryAction: {
      label: 'Return to Workspace',
      href: COMMERCIAL_OS_ROUTES.workspace,
    },
  },
};

export const XERO_GUIDED_SECTION_IDS = {
  revenue: 'guided-xero-revenue',
  receivable: 'guided-xero-receivable',
  processorFees: 'guided-xero-processor-fees',
  paymentRails: 'guided-xero-payment-rails',
  clearingAccounts: 'guided-xero-clearing-accounts',
  syncQueue: 'guided-xero-sync-queue',
} as const;

export const XERO_CONTEXTUAL_HELP = {
  revenue:
    'Provvy posts customer payments to this Xero account when an invoice is paid.',
  receivable: 'Provvy creates each invoice here until your customer pays.',
  processorFees: 'Optional — Provvy can record Stripe card fees here.',
  stripeClearing:
    'Provvy records Stripe card payments here before they reach your bank account.',
  paymentRails:
    'Provvy records each payment in Xero first, then matches it when money reaches your bank.',
  clearingAccounts:
    'Provvy can add these accounts in Xero for you — nothing is deleted.',
} as const;

export function xeroHasPaymentRails(rails: MerchantPaymentRails): boolean {
  return rails.stripeEnabled || rails.wiseEnabled || rails.stablecoinSettlementsEnabled;
}

/** Tour steps only — never imply setup is complete. */
export function buildXeroGuidedTourSteps(
  readiness: XeroReadinessResult,
  rails: MerchantPaymentRails
): GuidedSetupStep[] {
  const steps: GuidedSetupStep[] = [];

  if (!readiness.connection.connected) {
    steps.push({
      id: 'connect',
      title: 'Connect Xero',
      explanation:
        'Sign in to Xero and approve access so Provvy can create invoices and record payments.',
      targetId: 'xero-connection',
      continueLabel: 'Next',
    });
    return steps;
  }

  steps.push({
    id: 'revenue',
    title: 'Where your sales are recorded',
    explanation: 'Choose the Xero account Provvy uses when a customer pays an invoice.',
    targetId: XERO_GUIDED_SECTION_IDS.revenue,
    continueLabel: 'Next',
  });

  steps.push({
    id: 'receivable',
    title: 'Where unpaid invoices are tracked',
    explanation: 'Choose where Provvy creates invoices until customers pay.',
    targetId: XERO_GUIDED_SECTION_IDS.receivable,
    continueLabel: 'Next',
  });

  if (rails.stripeEnabled) {
    steps.push({
      id: 'processor-fees',
      title: 'Card fees (optional)',
      explanation: 'Optional — Provvy can record Stripe card fees here.',
      targetId: XERO_GUIDED_SECTION_IDS.processorFees,
      continueLabel: 'Next',
    });
  }

  if (xeroHasPaymentRails(rails)) {
    steps.push({
      id: 'payment-rails',
      title: 'Where payments go',
      explanation:
        'Provvy records each payment in Xero first, then matches it when money reaches your bank.',
      targetId: 'payment-reconciliation',
      continueLabel: 'Next',
    });
  }

  if (rails.stripeEnabled && !readiness.paymentMappings.stripeClearing.saved) {
    steps.push({
      id: 'clearing-accounts',
      title: 'Payment accounts in Xero',
      explanation: `${CLEARING_ACCOUNTS_EXPLANATION.body} ${CLEARING_ACCOUNTS_EXPLANATION.reassurance}`,
      targetId: XERO_GUIDED_SECTION_IDS.clearingAccounts,
      continueLabel: 'Next',
    });
  }

  if (readiness.queue.showPastPayments) {
    const count = readiness.queue.postConnectSyncs.length;
    steps.push({
      id: 'historical-payments',
      title: 'Payments syncing to Xero',
      explanation: `${count} payment${count === 1 ? '' : 's'} will sync automatically — you can still create invoices.`,
      targetId: XERO_GUIDED_SECTION_IDS.syncQueue,
      continueLabel: 'Finish walkthrough',
    });
  } else {
    steps.push({
      id: 'finished',
      title: 'You are set',
      explanation: 'Use the checklist at the top when you are ready to create an invoice.',
      targetId: 'guided-xero-health-check',
      continueLabel: 'Finish walkthrough',
    });
  }

  return steps;
}
