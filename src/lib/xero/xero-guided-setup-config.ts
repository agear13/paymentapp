import type { GuidedSetupConfig, GuidedSetupStep } from '@/lib/commercial-os/guided-setup';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { CLEARING_ACCOUNTS_EXPLANATION, QUEUE_GUIDANCE } from '@/lib/xero/xero-setup-guidance';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';

export const XERO_GUIDED_SETUP_CONFIG: GuidedSetupConfig = {
  id: 'xero',
  introTitle: "Let's finish your Xero setup",
  introSubtitle: "We'll guide you through a few quick steps on this page.",
  estimatedTime: '2–3 minutes',
  completion: {
    title: 'Xero is Ready',
    body: 'Everything is configured.',
    bullets: [
      'Push invoices',
      'Push payments',
      'Reconcile Stripe settlements',
      'Sync future activity',
    ],
    primaryAction: {
      label: 'Return to Workspace',
      href: COMMERCIAL_OS_ROUTES.workspace,
    },
    secondaryAction: {
      label: 'Create your first invoice',
      href: COMMERCIAL_OS_ROUTES.receivables,
    },
  },
};

export type XeroGuidedSetupContext = {
  merchantRails: MerchantPaymentRails;
  missingClearingCount: number;
  pendingPaymentCount: number;
  hasPaymentRails: boolean;
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
  revenue: 'This is where sales from invoices are recorded inside Xero.',
  receivable: "Tracks invoices that haven't yet been paid.",
  processorFees: 'Payment processor fees from card payments are recorded here.',
  stripeClearing:
    'Stripe temporarily holds funds before paying your bank account. This account allows Provvy to reconcile deposits automatically.',
  paymentRails:
    'Provvy uses temporary clearing accounts so deposits reconcile automatically.',
  clearingAccounts:
    'Recommended accounts are created inside Xero — nothing is deleted and duplicates are avoided.',
} as const;

export function buildXeroGuidedSetupSteps(ctx: XeroGuidedSetupContext): GuidedSetupStep[] {
  const steps: GuidedSetupStep[] = [
    {
      id: 'revenue',
      title: 'Revenue Account',
      explanation:
        'When customers pay invoices, Provvy records revenue into this account.',
      targetId: XERO_GUIDED_SECTION_IDS.revenue,
      continueLabel: 'Looks good · Continue',
    },
    {
      id: 'receivable',
      title: 'Accounts Receivable',
      explanation: 'This is where unpaid invoices live until customers pay.',
      targetId: XERO_GUIDED_SECTION_IDS.receivable,
    },
  ];

  if (ctx.merchantRails.stripeEnabled) {
    steps.push({
      id: 'processor-fees',
      title: 'Processor Fees',
      explanation: 'Payment processor fees are automatically recorded here.',
      targetId: XERO_GUIDED_SECTION_IDS.processorFees,
    });
  }

  if (ctx.hasPaymentRails) {
    const railNames: string[] = [];
    if (ctx.merchantRails.stripeEnabled) railNames.push('Stripe');
    if (ctx.merchantRails.wiseEnabled) railNames.push('Wise');
    if (ctx.merchantRails.stablecoinSettlementsEnabled) {
      railNames.push('HBAR', 'USDC', 'USDT', 'AUDD');
    }

    steps.push({
      id: 'payment-rails',
      title: 'Payment Rail Mappings',
      explanation: `Provvy uses temporary clearing accounts so ${railNames.join(', ')} deposits reconcile automatically.`,
      targetId: XERO_GUIDED_SECTION_IDS.paymentRails,
    });
  }

  if (ctx.missingClearingCount > 0) {
    steps.push({
      id: 'clearing-accounts',
      title: 'Recommended Clearing Accounts',
      explanation: `${CLEARING_ACCOUNTS_EXPLANATION.body} ${CLEARING_ACCOUNTS_EXPLANATION.action} ${CLEARING_ACCOUNTS_EXPLANATION.reassurance}`,
      targetId: XERO_GUIDED_SECTION_IDS.clearingAccounts,
      continueLabel: 'Continue',
    });
  }

  if (ctx.pendingPaymentCount > 0) {
    steps.push({
      id: 'historical-payments',
      title: 'Historical Payments',
      explanation: `We found ${ctx.pendingPaymentCount} historical payment${ctx.pendingPaymentCount === 1 ? '' : 's'} waiting to sync. This is normal after connecting Xero for the first time. Use Sync payments to Xero when you're ready.`,
      targetId: XERO_GUIDED_SECTION_IDS.syncQueue,
      continueLabel: QUEUE_GUIDANCE.processQueueLabel,
    });
  }

  steps.push({
    id: 'finished',
    title: 'All set',
    explanation: "You're done! Provvy will keep invoices and payments in sync automatically.",
    targetId: XERO_GUIDED_SECTION_IDS.revenue,
    continueLabel: 'Finish setup',
  });

  return steps;
}

export function xeroHasPaymentRails(rails: MerchantPaymentRails): boolean {
  return rails.stripeEnabled || rails.wiseEnabled || rails.stablecoinSettlementsEnabled;
}
