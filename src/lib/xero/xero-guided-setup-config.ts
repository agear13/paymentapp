import type { GuidedSetupConfig, GuidedSetupStep } from '@/lib/commercial-os/guided-setup';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { CLEARING_ACCOUNTS_EXPLANATION } from '@/lib/xero/xero-setup-guidance';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import type { XeroReadinessResult } from '@/lib/commercial-os/xero-readiness';

export const XERO_GUIDED_SETUP_CONFIG: GuidedSetupConfig = {
  id: 'xero',
  introTitle: 'Optional walkthrough',
  introSubtitle: 'We can highlight each section on this page. Your setup summary above shows what matters.',
  estimatedTime: '2–3 minutes',
  completion: {
    title: 'Walkthrough complete',
    body: 'Continue with the sections below.',
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
  revenue: 'This is where sales from invoices are recorded in Xero.',
  receivable: "Tracks invoices that haven't been paid yet.",
  processorFees: 'Card processing fees from Stripe payments are recorded here.',
  stripeClearing:
    'Stripe temporarily holds funds before paying your bank. This holding account helps Provvy match deposits automatically.',
  paymentRails:
    'Provvy uses temporary holding accounts so deposits reconcile automatically.',
  clearingAccounts:
    'Suggested accounts are added in Xero — nothing is deleted and duplicates are avoided.',
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
      explanation: 'Sign in to Xero and approve access so Provvy can send invoices and payments.',
      targetId: 'xero-connection',
      continueLabel: 'Next',
    });
    return steps;
  }

  steps.push({
    id: 'revenue',
    title: 'Sales from invoices',
    explanation: 'Choose which Xero account records sales when customers pay.',
    targetId: XERO_GUIDED_SECTION_IDS.revenue,
    continueLabel: 'Next',
  });

  steps.push({
    id: 'receivable',
    title: 'Unpaid invoices',
    explanation: 'Choose where unpaid invoices live in Xero until customers pay.',
    targetId: XERO_GUIDED_SECTION_IDS.receivable,
    continueLabel: 'Next',
  });

  if (rails.stripeEnabled) {
    steps.push({
      id: 'processor-fees',
      title: 'Card processing fees',
      explanation: 'Optional — where Stripe fees are recorded.',
      targetId: XERO_GUIDED_SECTION_IDS.processorFees,
      continueLabel: 'Next',
    });
  }

  if (xeroHasPaymentRails(rails)) {
    steps.push({
      id: 'payment-rails',
      title: 'Payment methods',
      explanation:
        'Optional holding accounts help Provvy match Stripe and other payments to your bank deposits.',
      targetId: 'payment-reconciliation',
      continueLabel: 'Next',
    });
  }

  if (rails.stripeEnabled && !readiness.paymentMappings.stripeClearing.saved) {
    steps.push({
      id: 'clearing-accounts',
      title: 'Temporary holding accounts',
      explanation: `${CLEARING_ACCOUNTS_EXPLANATION.body} ${CLEARING_ACCOUNTS_EXPLANATION.reassurance}`,
      targetId: XERO_GUIDED_SECTION_IDS.clearingAccounts,
      continueLabel: 'Next',
    });
  }

  if (readiness.queue.showPastPayments) {
    const count = readiness.queue.postConnectSyncs.length;
    steps.push({
      id: 'historical-payments',
      title: 'Past payments',
      explanation: `${count} payment${count === 1 ? '' : 's'} from after you connected will sync automatically — no action needed.`,
      targetId: XERO_GUIDED_SECTION_IDS.syncQueue,
      continueLabel: 'Finish walkthrough',
    });
  } else {
    steps.push({
      id: 'finished',
      title: 'You are set',
      explanation: 'Use the summary at the top when you are ready to create an invoice.',
      targetId: 'guided-xero-health-check',
      continueLabel: 'Finish walkthrough',
    });
  }

  return steps;
}
