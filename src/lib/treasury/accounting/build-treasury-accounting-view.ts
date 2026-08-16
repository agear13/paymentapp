import { prisma } from '@/lib/server/prisma';
import {
  accountingStatusForTreasuryEvent,
  xeroSyncToAccountingStatus,
} from '@/lib/treasury/accounting/accounting-status';
import type {
  TreasuryAccountingCustomerPaymentSection,
  TreasuryAccountingLifecycleStage,
  TreasuryAccountingRevenueSection,
  TreasuryAccountingView,
} from '@/lib/treasury/accounting/types';
import {
  paymentMethodAndTokenToSettlementContext,
  resolveSettlementAccount,
} from '@/lib/accounting/settlement-account-resolver';
import { buildTreasuryReconciliationChain } from '@/lib/treasury/reconciliation/engine';
import type { ReconciliationChainNode } from '@/lib/treasury/reconciliation/types';

const STANDARD_EXPLANATIONS = [
  'Revenue is recognised when the invoice is posted to Xero — not when crypto is converted or withdrawn.',
  'The customer payment is posted to Xero against your configured holding/clearing account.',
  'Crypto conversion records a factual exchange event. It does not create additional revenue.',
  'Digital Surge AUD withdrawal confirms the exchange initiated a payout — it does not prove bank receipt.',
  'Disposal, gain/loss, fee expense, and tax treatment depend on your accountant and jurisdiction — Provvy does not apply these automatically.',
] as const;

function isAudWithdrawal(meta: unknown): boolean {
  return (meta as Record<string, unknown> | null)?.display_as === 'aud_withdrawal';
}

function isAudBalance(meta: unknown): boolean {
  return (meta as Record<string, unknown> | null)?.display_as === 'aud_balance_credit';
}

function isFeeEvent(meta: unknown, eventType: string): boolean {
  const display = (meta as Record<string, unknown> | null)?.display_as;
  return display === 'fee' || (eventType === 'UNKNOWN' && display === 'fee');
}

function nodeToLifecycleStage(
  node: ReconciliationChainNode,
  options: { hasConfirmedBank: boolean; manualByEventId: Map<string, TreasuryAccountingLifecycleStage['manualReconciliation']> }
): TreasuryAccountingLifecycleStage {
  const metaStage = node.stage;
  const isWithdrawal = metaStage === 'fiat_withdrawal';
  const isBank = metaStage === 'bank_settlement';

  let accountingStatus = accountingStatusForTreasuryEvent(node.status, {
    isAudWithdrawal: isWithdrawal,
    hasConfirmedBank: options.hasConfirmedBank,
  });

  if (isBank && node.status === 'CONFIRMED') {
    accountingStatus = 'observed';
  }
  if (metaStage === 'awaiting_bank_confirmation') {
    accountingStatus = 'awaiting_bank_confirmation';
  }

  const eventId = node.eventId ?? null;

  return {
    stage: node.stage,
    label: node.label,
    eventType: node.eventType === 'WALLET' ? null : node.eventType,
    asset: node.asset,
    destinationAsset: node.destinationAsset ?? null,
    amount: node.amount,
    destinationAmount: node.destinationAmount ?? null,
    feeAmount: node.feeAmount ?? null,
    exchangeRate: node.exchangeRate ?? null,
    provider: node.provider,
    occurredAt: node.occurredAt,
    transactionReference: node.transactionReference,
    providerReference: node.providerReference,
    sourceAddress: null,
    destinationAddress: node.destinationAddress,
    treasuryStatus: node.status,
    accountingStatus,
    evidence: node.evidence
      ? {
          strategy: node.evidence.strategy,
          manual: node.evidence.manual,
          linkStatus: node.evidence.linkStatus ?? null,
        }
      : null,
    eventId,
    manualReconciliation: eventId ? options.manualByEventId.get(eventId) ?? null : null,
  };
}

function buildAwaitingStage(
  stage: string,
  label: string,
  accountingStatus: TreasuryAccountingLifecycleStage['accountingStatus']
): TreasuryAccountingLifecycleStage {
  return {
    stage,
    label,
    eventType: null,
    asset: null,
    destinationAsset: null,
    amount: null,
    destinationAmount: null,
    feeAmount: null,
    exchangeRate: null,
    provider: null,
    occurredAt: null,
    transactionReference: null,
    providerReference: null,
    sourceAddress: null,
    destinationAddress: null,
    treasuryStatus: 'UNKNOWN',
    accountingStatus,
    evidence: null,
    eventId: null,
    manualReconciliation: null,
  };
}

export async function buildTreasuryAccountingView(
  organizationId: string,
  paymentLinkId: string
): Promise<TreasuryAccountingView | null> {
  const link = await prisma.payment_links.findFirst({
    where: { id: paymentLinkId, organization_id: organizationId },
    select: {
      id: true,
      invoice_reference: true,
      short_code: true,
      status: true,
      amount: true,
      currency: true,
      accounting_amount: true,
      accounting_currency: true,
      payment_method: true,
      token_type: true,
    },
  });

  if (!link) return null;

  const [settings, invoiceSync, paymentSync, paymentEvent, chain, treasuryEvents] =
    await Promise.all([
      prisma.merchant_settings.findFirst({
        where: { organization_id: organizationId },
        select: {
          xero_revenue_account_id: true,
          xero_stripe_clearing_account_id: true,
          xero_wise_clearing_account_id: true,
          xero_hbar_clearing_account_id: true,
          xero_usdc_clearing_account_id: true,
          xero_usdt_clearing_account_id: true,
          xero_audd_clearing_account_id: true,
          crypto_settlement_strategy: true,
        },
      }),
      prisma.xero_syncs.findFirst({
        where: { payment_link_id: paymentLinkId, sync_type: 'INVOICE' },
        select: { status: true, xero_invoice_id: true, error_message: true },
      }),
      prisma.xero_syncs.findFirst({
        where: { payment_link_id: paymentLinkId, sync_type: 'PAYMENT' },
        select: { status: true, xero_payment_id: true, error_message: true },
      }),
      prisma.payment_events.findFirst({
        where: { payment_link_id: paymentLinkId, event_type: 'PAYMENT_CONFIRMED' },
        orderBy: { received_at: 'desc' },
        select: {
          id: true,
          received_at: true,
          amount_received: true,
          currency_received: true,
          hedera_transaction_id: true,
          metadata: true,
        },
      }),
      buildTreasuryReconciliationChain(organizationId, paymentLinkId),
      prisma.treasury_events.findMany({
        where: { organization_id: organizationId, payment_link_id: paymentLinkId },
        orderBy: { occurred_at: 'asc' },
      }),
    ]);

  const eventIds = treasuryEvents.map((e) => e.id);
  const manualAudits =
    eventIds.length > 0
      ? await prisma.treasury_manual_reconciliations.findMany({
          where: {
            organization_id: organizationId,
            OR: [
              { source_event_id: { in: eventIds } },
              { target_event_id: { in: eventIds } },
            ],
          },
          orderBy: { linked_at: 'desc' },
        })
      : [];

  const manualByEventId = new Map<
    string,
    NonNullable<TreasuryAccountingLifecycleStage['manualReconciliation']>
  >();
  for (const audit of manualAudits) {
    if (!manualByEventId.has(audit.target_event_id)) {
      manualByEventId.set(audit.target_event_id, {
        linkedAt: audit.linked_at.toISOString(),
        linkedByUserId: audit.linked_by_user_id,
        notes: audit.notes,
      });
    }
  }

  const hasConfirmedBank = treasuryEvents.some(
    (e) => e.event_type === 'BANK_SETTLEMENT' && e.status === 'CONFIRMED'
  );

  const revenue: TreasuryAccountingRevenueSection = {
    invoiceAmount: link.amount?.toString() ?? null,
    invoiceCurrency: link.currency ?? null,
    accountingAmount: link.accounting_amount?.toString() ?? link.amount?.toString() ?? null,
    accountingCurrency: link.accounting_currency ?? link.currency ?? null,
    revenueAccountCode: settings?.xero_revenue_account_id ?? null,
    xeroInvoiceSyncStatus: invoiceSync?.status ?? null,
    xeroInvoiceId: invoiceSync?.xero_invoice_id ?? null,
    accountingStatus: xeroSyncToAccountingStatus(invoiceSync?.status),
  };

  let holdingAccountCode: string | null = null;
  let holdingAccountName: string | null = null;
  if (settings && paymentEvent) {
    const settlementContext = paymentMethodAndTokenToSettlementContext(
      link.payment_method ?? 'CRYPTO',
      link.token_type,
      link.currency ?? 'AUD'
    );
    const resolution = resolveSettlementAccount({
      settings,
      paymentRail: settlementContext.paymentRail,
      collectionMethod: settlementContext.collectionMethod,
      paymentAsset: settlementContext.paymentAsset,
      organizationId,
    });
    if (resolution.status === 'resolved') {
      holdingAccountCode = resolution.xeroAccountCode;
      holdingAccountName = resolution.target?.accountName ?? null;
    }
  }

  const customerPaymentAsset =
    link.token_type ??
    treasuryEvents.find((e) => e.event_type === 'ASSET_RECEIVED')?.asset ??
    null;

  const customerTreasury = treasuryEvents.find((e) => e.event_type === 'CUSTOMER_PAYMENT');

  const customerPayment: TreasuryAccountingCustomerPaymentSection = {
    paymentAmount:
      paymentEvent?.amount_received?.toString() ??
      customerTreasury?.amount?.toString() ??
      null,
    paymentCurrency: paymentEvent?.currency_received ?? link.currency ?? null,
    paymentRail: link.payment_method ?? null,
    asset: customerPaymentAsset,
    paymentEventId: paymentEvent?.id ?? null,
    paymentConfirmedAt: paymentEvent?.received_at?.toISOString() ?? null,
    transactionReference: paymentEvent?.hedera_transaction_id ?? null,
    xeroPaymentSyncStatus: paymentSync?.status ?? null,
    xeroPaymentId: paymentSync?.xero_payment_id ?? null,
    holdingAccountCode,
    holdingAccountName,
    treasuryStatus: customerTreasury?.status ?? (paymentEvent ? 'CONFIRMED' : null),
    accountingStatus: xeroSyncToAccountingStatus(paymentSync?.status),
  };

  const lifecycleStages: TreasuryAccountingLifecycleStage[] = [];

  if (chain?.nodes.length) {
    for (const node of chain.nodes) {
      if (node.stage === 'customer_payment') continue;
      lifecycleStages.push(nodeToLifecycleStage(node, { hasConfirmedBank, manualByEventId }));
    }
  }

  const feeEvents = treasuryEvents.filter((e) => isFeeEvent(e.metadata, e.event_type));
  for (const fee of feeEvents) {
    lifecycleStages.push({
      stage: 'exchange_fee',
      label: 'Exchange fee',
      eventType: fee.event_type,
      asset: fee.fee_currency ?? fee.asset,
      destinationAsset: null,
      amount: fee.fee_amount?.toString() ?? fee.amount?.toString() ?? null,
      destinationAmount: null,
      feeAmount: null,
      exchangeRate: null,
      provider: fee.provider,
      occurredAt: fee.occurred_at.toISOString(),
      transactionReference: fee.transaction_hash,
      providerReference: fee.provider_reference,
      sourceAddress: fee.source_address,
      destinationAddress: fee.destination_address,
      treasuryStatus: fee.status,
      accountingStatus: accountingStatusForTreasuryEvent(fee.status, { isFee: true }),
      evidence: null,
      eventId: fee.id,
      manualReconciliation: manualByEventId.get(fee.id) ?? null,
    });
  }

  const hasConversion = lifecycleStages.some((s) => s.stage === 'conversion');
  const hasWalletTransfer = lifecycleStages.some((s) => s.stage === 'wallet_transfer');
  const hasExchangeDeposit = lifecycleStages.some((s) => s.stage === 'exchange_deposit');
  const hasAudBalance = lifecycleStages.some((s) => s.stage === 'fiat_credit');
  const hasAudWithdrawal = lifecycleStages.some((s) => s.stage === 'fiat_withdrawal');
  const hasBankStep = lifecycleStages.some(
    (s) => s.stage === 'bank_settlement' || s.stage === 'awaiting_bank_confirmation'
  );

  if (!hasWalletTransfer && treasuryEvents.some((e) => e.event_type === 'ASSET_RECEIVED')) {
    lifecycleStages.push(
      buildAwaitingStage('awaiting_wallet', 'Wallet movement', 'not_applicable')
    );
  }
  if (hasWalletTransfer && !hasExchangeDeposit) {
    lifecycleStages.push(
      buildAwaitingStage('awaiting_exchange', 'Exchange deposit', 'requires_review')
    );
  }
  if (hasExchangeDeposit && !hasConversion) {
    lifecycleStages.push(
      buildAwaitingStage('awaiting_conversion', 'Conversion', 'not_applicable')
    );
  }
  if (hasConversion && !hasAudBalance) {
    lifecycleStages.push(
      buildAwaitingStage('awaiting_fiat_balance', 'AUD at exchange', 'not_applicable')
    );
  }
  if (hasAudBalance && !hasAudWithdrawal && !hasConfirmedBank) {
    const audCredit = treasuryEvents.find((e) => isAudBalance(e.metadata));
    if (audCredit) {
      // already in chain as fiat_credit
    }
  }
  if ((hasAudWithdrawal || chain?.chainStatus === 'AWAITING_BANK_CONFIRMATION') && !hasConfirmedBank && !hasBankStep) {
    lifecycleStages.push(
      buildAwaitingStage(
        'awaiting_bank_confirmation',
        'Bank settlement',
        'awaiting_bank_confirmation'
      )
    );
  }

  lifecycleStages.sort((a, b) => {
    const order = [
      'asset_received',
      'wallet',
      'wallet_transfer',
      'exchange_deposit',
      'conversion',
      'exchange_fee',
      'fiat_credit',
      'fiat_withdrawal',
      'awaiting_bank_confirmation',
      'bank_settlement',
      'awaiting_wallet',
      'awaiting_exchange',
      'awaiting_conversion',
      'awaiting_fiat_balance',
    ];
    return order.indexOf(a.stage) - order.indexOf(b.stage);
  });

  const chainStatus = chain?.chainStatus ?? 'PARTIAL';
  const exceptions = chain?.exceptions ?? [];

  return {
    paymentLinkId,
    invoiceReference: link.invoice_reference ?? link.short_code,
    chainStatus,
    revenue,
    customerPayment,
    lifecycleStages,
    exceptions,
    metricsHint: {
      requiresAccountantReview:
        exceptions.length > 0 ||
        lifecycleStages.some((s) => s.accountingStatus === 'requires_review'),
      awaitingBankConfirmation: chainStatus === 'AWAITING_BANK_CONFIRMATION',
    },
    explanations: [...STANDARD_EXPLANATIONS],
  };
}

export async function listTreasuryAccountingSummaries(organizationId: string) {
  const paidLinks = await prisma.payment_links.findMany({
    where: { organization_id: organizationId, status: 'PAID' },
    select: {
      id: true,
      invoice_reference: true,
      short_code: true,
      amount: true,
      currency: true,
      token_type: true,
    },
    orderBy: { updated_at: 'desc' },
    take: 100,
  });

  const summaries = [];
  for (const link of paidLinks) {
    const [paymentSync, chain] = await Promise.all([
      prisma.xero_syncs.findFirst({
        where: { payment_link_id: link.id, sync_type: 'PAYMENT' },
        select: { status: true },
      }),
      buildTreasuryReconciliationChain(organizationId, link.id),
    ]);

    summaries.push({
      paymentLinkId: link.id,
      invoiceReference: link.invoice_reference ?? link.short_code,
      invoiceAmount: link.amount?.toString() ?? null,
      invoiceCurrency: link.currency ?? null,
      asset: link.token_type ?? null,
      chainStatus: chain?.chainStatus ?? 'PARTIAL',
      xeroPaymentPosted: paymentSync?.status === 'SUCCESS',
      requiresReview:
        (chain?.exceptions.length ?? 0) > 0 ||
        chain?.chainStatus === 'EXCEPTION' ||
        chain?.chainStatus === 'AWAITING_EXCHANGE_IDENTIFICATION',
    });
  }

  return summaries;
}
