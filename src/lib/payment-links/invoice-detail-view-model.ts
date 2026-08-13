/**
 * Unified merchant-facing state for the invoice detail screen.
 * Single derivation point for invoice, payment, sent, accounting, timeline, and next-step UX.
 */

import { format } from 'date-fns';
import {
  accountingSyncDisplayLabel,
  resolveAccountingPushState,
  resolveAccountingSyncDisplayStatus,
  type AccountingInvoiceSyncRow,
} from '@/lib/accounting/accounting-push-state';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';
import { formatCurrency } from '@/lib/formatters/format-currency';
import type { LifecycleSnapshot } from '@/lib/payment-links/payment-link-merchant-actions';
import {
  invoiceHeroState,
  toInvoiceDisplayStatus,
  toPaymentDisplayStatus,
  type InvoiceDisplayStatus,
  type PaymentDisplayStatus,
} from '@/lib/payment-links/invoice-display-status';
import { isAccountingLifecycleStage } from '@/lib/payments/lifecycle/lifecycle-stages';

export type AccountingConnectionState = {
  connected: boolean;
  syncReady: boolean;
};

export type InvoiceAccountingDisplayState =
  | 'not_connected'
  | 'setup_incomplete'
  | 'not_synced'
  | 'sync_pending'
  | 'sync_failed'
  | 'synced'
  | 'local_changes'
  | 'update_pending';

export type InvoiceTimelineEntry = {
  label: string;
  detail: string;
  time: string;
  sortAt: number;
};

export type InvoiceNextStep =
  | {
      kind: 'send_invoice';
      title: string;
      message: string;
    }
  | {
      kind: 'payment_received';
      title: string;
      message: string;
    }
  | {
      kind: 'accounting_connect';
      title: string;
      message: string;
    }
  | {
      kind: 'accounting_action';
      title: string;
      message: string;
      accountingState: InvoiceAccountingDisplayState;
    }
  | null;

type PaymentEventLike = {
  id: string;
  eventType: string;
  paymentMethod?: string | null;
  createdAt: Date | string;
};

type PaymentLinkDetailLike = {
  id: string;
  status: string;
  amount: unknown;
  currency: string;
  description?: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  lastSentAt?: Date | string | null;
  lastSentToEmail?: string | null;
  paidAt?: Date | string | null;
  dueDate?: Date | string | null;
  invoiceOnlyMode?: boolean;
  paymentMethod?: string | null;
  xeroSyncs?: AccountingInvoiceSyncRow[] | null;
  paymentEvents?: PaymentEventLike[] | null;
  settlementCurrency?: string | null;
  settlementAmount?: unknown;
};

const MERCHANT_INVOICE_CREATED_LABEL = 'Invoice created';

function isInvoiceCreatedLabel(label: string): boolean {
  return label.toLowerCase() === MERCHANT_INVOICE_CREATED_LABEL.toLowerCase();
}

function normalizeMerchantTimelineLabel(label: string): string {
  if (isInvoiceCreatedLabel(label)) {
    return MERCHANT_INVOICE_CREATED_LABEL;
  }
  return label;
}

const PAYMENT_EVENT_MERCHANT_LABELS: Record<string, string> = {
  CREATED: MERCHANT_INVOICE_CREATED_LABEL,
  OPENED: 'Customer opened payment link',
  PAYMENT_INITIATED: 'Payment link ready',
  PAYMENT_CONFIRMED: 'Payment confirmed',
  PAYMENT_FAILED: 'Payment failed',
  CANCELED: 'Payment canceled',
  EXPIRED: 'Payment link expired',
};

function parseTimestamp(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function hasInvoiceBeenSent(link: { status: string; lastSentAt?: Date | string | null }): boolean {
  if (link.status === 'DRAFT') return false;
  return Boolean(link.lastSentAt && parseTimestamp(link.lastSentAt) != null);
}

export function deriveInvoiceAccountingDisplayState(input: {
  accountingConnection: AccountingConnectionState;
  invoiceSync?: AccountingInvoiceSyncRow | null;
  linkUpdatedAt?: Date | string | null;
  link?: Parameters<typeof resolveAccountingPushState>[0]['link'];
}): InvoiceAccountingDisplayState {
  const { accountingConnection, invoiceSync, linkUpdatedAt, link } = input;

  if (!accountingConnection.connected) {
    return 'not_connected';
  }

  if (!accountingConnection.syncReady) {
    return 'setup_incomplete';
  }

  const pushState = resolveAccountingPushState({ invoiceSync, linkUpdatedAt, link });
  return resolveAccountingSyncDisplayStatus(pushState);
}

export function invoiceAccountingStatusLabel(state: InvoiceAccountingDisplayState): string {
  switch (state) {
    case 'not_connected':
      return 'Accounting not connected';
    case 'setup_incomplete':
      return ACCOUNTING_INTEGRATION_COPY.setupIncompleteStatus;
    case 'sync_pending':
      return accountingSyncDisplayLabel('sync_pending');
    case 'sync_failed':
      return accountingSyncDisplayLabel('sync_failed');
    case 'synced':
      return accountingSyncDisplayLabel('synced');
    case 'local_changes':
      return accountingSyncDisplayLabel('local_changes');
    case 'update_pending':
      return accountingSyncDisplayLabel('update_pending');
    default:
      return accountingSyncDisplayLabel('not_synced');
  }
}

export function invoiceAccountingGuidance(input: {
  accountingState: InvoiceAccountingDisplayState;
  isPaid: boolean;
}): {
  tone: 'default' | 'success' | 'info';
  title: string;
  message: string;
} {
  const { accountingState, isPaid } = input;

  if (accountingState === 'not_connected') {
    return {
      tone: 'info',
      title: 'Accounting not connected',
      message: ACCOUNTING_INTEGRATION_COPY.notConnectedDescription,
    };
  }

  if (accountingState === 'setup_incomplete') {
    return {
      tone: 'info',
      title: 'Complete accounting setup',
      message:
        'Finish account mapping in accounting settings before pushing this invoice to your accounting software.',
    };
  }

  if (accountingState === 'sync_pending') {
    return {
      tone: 'info',
      title: 'Sync in progress',
      message:
        'Provvy is processing this invoice for your accounting software. This usually completes within a few minutes.',
    };
  }

  if (accountingState === 'sync_failed') {
    return {
      tone: 'default',
      title: 'Accounting sync needs attention',
      message:
        'Something went wrong while syncing to accounting. Review the sync history below and check your account mappings.',
    };
  }

  if (accountingState === 'synced') {
    return {
      tone: 'success',
      title: 'Synced with accounting',
      message: isPaid
        ? 'This invoice and payment are in your accounting software.'
        : 'This invoice is synced. When payment is received, Provvy can sync the payment too.',
    };
  }

  if (accountingState === 'local_changes' || accountingState === 'update_pending') {
    return {
      tone: 'info',
      title: 'Local changes not synced',
      message: ACCOUNTING_INTEGRATION_COPY.localChangesNotSyncedBody,
    };
  }

  return {
    tone: 'info',
    title: 'Ready to sync',
    message: isPaid
      ? 'Push this invoice and payment to your accounting software when you are ready.'
      : 'This invoice has not been pushed to accounting yet. Use Push to Accounting when you want to sync.',
  };
}

export function paymentEventMerchantLabel(
  eventType: string,
  linkStatus: string
): string {
  if (eventType === 'PAYMENT_INITIATED' && (linkStatus === 'OPEN' || linkStatus === 'DRAFT')) {
    return 'Payment link ready';
  }
  return PAYMENT_EVENT_MERCHANT_LABELS[eventType] ?? eventType.replace(/_/g, ' ');
}

export function buildInvoiceActivityTimeline(
  detail: PaymentLinkDetailLike,
  lifecycle: LifecycleSnapshot | null
): InvoiceTimelineEntry[] {
  const entries: InvoiceTimelineEntry[] = [];
  let hasInvoiceCreated = false;

  for (const step of lifecycle?.invoiceLifecycle?.timeline ?? []) {
    if (!step.reached || !step.occurredAt) continue;
    const label = normalizeMerchantTimelineLabel(step.label);
    if (isInvoiceCreatedLabel(label)) {
      hasInvoiceCreated = true;
    }
    const at = new Date(step.occurredAt);
    entries.push({
      label,
      detail: step.state,
      time: format(at, 'd MMM · HH:mm'),
      sortAt: at.getTime(),
    });
  }

  for (const event of detail.paymentEvents ?? []) {
    if (event.eventType === 'CREATED' && hasInvoiceCreated) {
      continue;
    }

    const label = paymentEventMerchantLabel(event.eventType, detail.status);
    if (isInvoiceCreatedLabel(label)) {
      if (hasInvoiceCreated) {
        continue;
      }
      hasInvoiceCreated = true;
    }

    const at = new Date(event.createdAt);
    entries.push({
      label,
      detail: event.paymentMethod ? `via ${event.paymentMethod}` : '',
      time: format(at, 'd MMM · HH:mm'),
      sortAt: at.getTime(),
    });
  }

  if (entries.length === 0 && detail.createdAt) {
    hasInvoiceCreated = true;
    const at = new Date(detail.createdAt);
    entries.push({
      label: MERCHANT_INVOICE_CREATED_LABEL,
      detail: detail.description || '',
      time: format(at, 'd MMM · HH:mm'),
      sortAt: at.getTime(),
    });
  }

  if (hasInvoiceBeenSent(detail) && detail.lastSentAt) {
    const sentMs = parseTimestamp(detail.lastSentAt);
    if (sentMs != null) {
      const at = new Date(sentMs);
      entries.push({
        label: 'Invoice sent',
        detail: detail.lastSentToEmail ? `to ${detail.lastSentToEmail}` : '',
        time: format(at, 'd MMM · HH:mm'),
        sortAt: sentMs,
      });
    }
  }

  return entries.sort((a, b) => a.sortAt - b.sortAt);
}

export function deriveSettlementDisplayLabel(input: {
  isPaid: boolean;
  lifecycle: LifecycleSnapshot | null;
  settlementCurrency?: string | null;
  settlementAmount?: unknown;
  linkStatus: string;
  formatAmount?: (amount: unknown, currency: string) => string;
}): string | null {
  if (!input.isPaid) {
    return null;
  }

  const formatAmount =
    input.formatAmount ??
    ((amount: unknown, currency: string) => formatCurrency(Number(amount), currency));

  const settled = input.lifecycle?.settlements?.find(
    (s) => s.status === 'SETTLED' || s.status === 'RECONCILED'
  );
  if (settled) {
    return `Settled ${formatAmount(settled.amount, settled.currency)}`;
  }

  if (input.settlementCurrency && input.settlementAmount != null) {
    return formatAmount(input.settlementAmount, input.settlementCurrency);
  }

  if (input.linkStatus === 'PAID') {
    return 'Payment received';
  }

  return null;
}

export function deriveInvoiceNextStep(input: {
  detail: PaymentLinkDetailLike;
  displayStatus: InvoiceDisplayStatus;
  isPaid: boolean;
  hasBeenSent: boolean;
  canSend: boolean;
  accountingState: InvoiceAccountingDisplayState;
}): InvoiceNextStep {
  const { detail, displayStatus, isPaid, hasBeenSent, canSend, accountingState } = input;

  if (canSend && !hasBeenSent && displayStatus !== 'Draft') {
    return {
      kind: 'send_invoice',
      title: 'Next step',
      message: 'Send this invoice to your customer so they can view details and pay online.',
    };
  }

  if (isPaid && accountingState === 'not_connected') {
    return {
      kind: 'accounting_connect',
      title: 'Next step',
      message:
        'Payment received. Connect accounting to sync this invoice and payment to your books.',
    };
  }

  if (isPaid && (accountingState === 'not_synced' || accountingState === 'local_changes')) {
    return {
      kind: 'accounting_action',
      title: 'Next step',
      message: 'Payment received. Push or update this invoice in your accounting software.',
      accountingState,
    };
  }

  if (isPaid) {
    return {
      kind: 'payment_received',
      title: 'Payment received',
      message: 'Provvy can sync this payment to your accounting software when connected.',
    };
  }

  if (
    accountingState === 'not_connected' &&
    detail.status === 'OPEN' &&
    hasBeenSent
  ) {
    return {
      kind: 'accounting_connect',
      title: 'Optional',
      message:
        'Connect accounting to push this invoice automatically when you receive payment.',
    };
  }

  return null;
}

export function derivePaymentLifecycleStageLabel(currentStage: string | null | undefined): string | null {
  if (!currentStage || isAccountingLifecycleStage(currentStage)) {
    return null;
  }
  return currentStage.replace(/_/g, ' ').toLowerCase();
}

export function deriveMerchantPaymentLifecycleHealthLabel(input: {
  payStatus: PaymentDisplayStatus;
  isPaid: boolean;
  apiHealthLabel: string;
}): string {
  if (input.payStatus === 'Confirming') {
    return 'Confirming';
  }
  if (input.payStatus === 'Part paid') {
    return 'Part paid';
  }
  if (input.isPaid || input.payStatus === 'Settled') {
    if (input.apiHealthLabel === 'Awaiting Payment' || input.apiHealthLabel === 'Processing') {
      return 'Paid';
    }
    return input.apiHealthLabel;
  }
  return 'Awaiting payment';
}

export function shouldShowPaymentLifecycleAccountingNote(input: {
  accountingState: InvoiceAccountingDisplayState;
  accountingStageLabel: string | null;
}): boolean {
  return input.accountingState !== 'not_connected' && Boolean(input.accountingStageLabel);
}

export function isPaymentLifecycleAccountingTimelineItem(
  item: { stage: string; label: string },
  accountingConnected: boolean
): boolean {
  if (isAccountingLifecycleStage(item.stage)) {
    return true;
  }
  if (item.stage === 'EXPORTED') {
    return true;
  }
  if (!accountingConnected && /exported|accounting sync/i.test(item.label)) {
    return true;
  }
  return false;
}

export function filterMerchantPaymentLifecycleTimeline<T extends { stage: string; label: string }>(
  items: T[],
  accountingState: InvoiceAccountingDisplayState
): T[] {
  const accountingConnected = accountingState !== 'not_connected';
  return items.filter(
    (item) => !isPaymentLifecycleAccountingTimelineItem(item, accountingConnected)
  );
}

export function deriveSidebarInvoiceLabel(hasBeenSent: boolean): string {
  return hasBeenSent ? 'Sent' : 'Not sent';
}

export function deriveSendInvoiceCtaLabel(
  hasBeenSent: boolean
): 'Send invoice' | 'Resend invoice' {
  return hasBeenSent ? 'Resend invoice' : 'Send invoice';
}

export type InvoiceDetailViewModel = {
  displayStatus: InvoiceDisplayStatus;
  payStatus: PaymentDisplayStatus;
  hasBeenSent: boolean;
  isPaid: boolean;
  hero: ReturnType<typeof invoiceHeroState>;
  accountingState: InvoiceAccountingDisplayState;
  accountingStatusLabel: string;
  accountingGuidance: ReturnType<typeof invoiceAccountingGuidance>;
  showAccountingSyncDetails: boolean;
  timeline: InvoiceTimelineEntry[];
  settlementLabel: string | null;
  settlementSummaryLabel: string;
  nextStep: InvoiceNextStep;
  paymentLifecycleStageLabel: string | null;
  sendInvoiceCtaLabel: 'Send invoice' | 'Resend invoice';
  sidebarInvoiceLabel: string;
};

export function deriveInvoiceDetailViewModel(input: {
  detail: PaymentLinkDetailLike;
  lifecycle: LifecycleSnapshot | null;
  accountingConnection: AccountingConnectionState;
  lifecycleCurrentStage?: string | null;
}): InvoiceDetailViewModel {
  const { detail, lifecycle, accountingConnection, lifecycleCurrentStage } = input;

  const invoiceSync = detail.xeroSyncs?.find((s) => s.syncType === 'INVOICE') ?? null;
  const amountOutstanding = lifecycle?.invoiceLifecycle?.amountOutstanding;
  const invoiceAmount = lifecycle?.invoiceLifecycle
    ? lifecycle.invoiceLifecycle.amountPaid + lifecycle.invoiceLifecycle.amountOutstanding
    : Number(detail.amount);

  const displayStatus = toInvoiceDisplayStatus(detail);
  const payStatus = toPaymentDisplayStatus(detail, amountOutstanding, invoiceAmount);
  const hasBeenSent = hasInvoiceBeenSent(detail);
  const isPaid =
    detail.status === 'PAID' ||
    detail.status === 'PAID_UNVERIFIED' ||
    displayStatus === 'Paid';

  const accountingState = deriveInvoiceAccountingDisplayState({
    accountingConnection,
    invoiceSync,
    linkUpdatedAt: detail.updatedAt,
    link: detail,
  });

  const canSend = detail.status === 'DRAFT' || detail.status === 'OPEN' || detail.status === 'PAID_UNVERIFIED';

  return {
    displayStatus,
    payStatus,
    hasBeenSent,
    isPaid,
    hero: invoiceHeroState(detail),
    accountingState,
    accountingStatusLabel: invoiceAccountingStatusLabel(accountingState),
    accountingGuidance: invoiceAccountingGuidance({ accountingState, isPaid }),
    showAccountingSyncDetails: accountingState !== 'not_connected',
    timeline: buildInvoiceActivityTimeline(detail, lifecycle),
    settlementLabel: deriveSettlementDisplayLabel({
      isPaid,
      lifecycle,
      settlementCurrency: detail.settlementCurrency,
      settlementAmount: detail.settlementAmount,
      linkStatus: detail.status,
    }),
    settlementSummaryLabel: isPaid
      ? deriveSettlementDisplayLabel({
          isPaid,
          lifecycle,
          settlementCurrency: detail.settlementCurrency,
          settlementAmount: detail.settlementAmount,
          linkStatus: detail.status,
        }) ?? 'Payment received'
      : 'Awaiting payment',
    nextStep: deriveInvoiceNextStep({
      detail,
      displayStatus,
      isPaid,
      hasBeenSent,
      canSend,
      accountingState,
    }),
    paymentLifecycleStageLabel: derivePaymentLifecycleStageLabel(lifecycleCurrentStage),
    sendInvoiceCtaLabel: deriveSendInvoiceCtaLabel(hasBeenSent),
    sidebarInvoiceLabel: deriveSidebarInvoiceLabel(hasBeenSent),
  };
}
