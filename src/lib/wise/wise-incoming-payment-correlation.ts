/**
 * Deterministic Wise incoming-payment correlation for webhook processing.
 * Only PROVVY-{shortCode} may correlate — never amount/currency/transfer id alone.
 */

import { invoiceDenominationCurrency } from '@/lib/payments/invoice-denomination';
import { paymentLinkAllowsMultiCheckoutRail } from '@/lib/payments/payment-link-rail-access';
import { buildProvvyWiseReference, parseProvvyPaymentReference } from '@/lib/wise/wise-payment-reference';
import { mapWiseStatusToInternal } from '@/lib/wise/status-mapping';

export type WiseWebhookResource = {
  id?: number | string;
  profile_id?: number;
  status?: string;
  rate?: number;
  source_amount?: number;
  target_amount?: number;
  source_currency?: string;
  target_currency?: string;
  type?: string;
};

export type WiseAccountDetailsTransfer = {
  id?: number;
  type?: string;
  amount?: number;
  currency?: string;
};

export type WiseSwiftInAction = {
  type?: string;
  id?: number;
  profile_id?: number;
  account_id?: number;
};

export type WiseSwiftInResource = {
  id?: string;
  uetr?: string;
  reference?: string;
  settled_amount?: { value?: number; currency?: string };
  instructed_amount?: { value?: number; currency?: string };
};

export type WiseWebhookPayload = {
  data?: {
    resource?: WiseWebhookResource & { reference?: string };
    amount?: number;
    currency?: string;
    transaction_type?: string;
    transfer_reference?: string;
    step_id?: number;
    occurred_at?: string;
    current_state?: string;
    previous_state?: string;
    transfer?: WiseAccountDetailsTransfer;
    action?: WiseSwiftInAction;
    channel_name?: string;
  };
  delivery_id?: string;
  subscription_id?: string;
  event_type?: string;
  sent_at?: string;
};

export type WisePaymentLinkCandidate = {
  id: string;
  short_code: string;
  status: string;
  amount: { toNumber(): number } | number | string;
  currency: string;
  invoice_currency?: string | null;
  payment_method: string | null;
  organization_id: string;
  wise_status?: string | null;
};

export type WiseMerchantProfile = {
  wise_profile_id: string | null;
  wise_enabled: boolean | null;
};

export type WiseCorrelationRejectReason =
  | 'missing_event_type'
  | 'unsupported_event_type'
  | 'missing_transfer_id'
  | 'missing_customer_reference'
  | 'invalid_provvvy_reference'
  | 'payment_link_not_found'
  | 'payment_link_not_open'
  | 'payment_rail_not_wise'
  | 'profile_mismatch'
  | 'currency_mismatch'
  | 'amount_mismatch'
  | 'transfer_not_paid'
  | 'not_credit_transaction'
  | 'statement_transaction_not_found';

export type WiseCorrelationResult =
  | {
      status: 'correlated';
      paymentLinkId: string;
      shortCode: string;
      reference: string;
      amountReceived: number;
      currencyReceived: string;
      webhookDedupKey: string;
      providerRef: string;
      transactionId: string;
      wiseTransferId: string;
      correlationMetadata: Record<string, unknown>;
    }
  | {
      status: 'rejected';
      reason: WiseCorrelationRejectReason;
      detail?: string;
    }
  | {
      status: 'ignored';
      reason: string;
    };

export function toWiseNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    const parsed = Number((value as { toNumber(): number }).toNumber());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function buildWiseWebhookDedupKey(payload: WiseWebhookPayload): string | null {
  if (payload.delivery_id?.trim()) {
    return `wise:delivery:${payload.delivery_id.trim()}`;
  }
  const stepId = payload.data?.step_id;
  const subscriptionId = payload.subscription_id?.trim();
  const eventType = payload.event_type?.trim();
  if (stepId != null && subscriptionId && eventType) {
    return `wise:${eventType}:${subscriptionId}:${stepId}`;
  }
  return null;
}

/** Stable idempotency key for a Wise incoming transfer across webhook event types. */
export function buildWiseTransferSettlementKey(transferId: string | number): string {
  return `wise:transfer-settlement:${transferId}`;
}

export function amountsMatch(expected: number, received: number): boolean {
  if (!Number.isFinite(expected) || !Number.isFinite(received)) {
    return false;
  }
  const tolerance = Math.max(0.01, expected * 0.0001);
  return Math.abs(expected - received) <= tolerance;
}

function validateCorrelatedPayment(input: {
  customerReference: string;
  paymentLink: WisePaymentLinkCandidate | null;
  merchantProfile: WiseMerchantProfile | null;
  webhookProfileId: number | string | null | undefined;
  receivedAmount: number | null;
  receivedCurrency: string | null | undefined;
  wiseEventType: string;
  wiseTransferId: string;
  extraMetadata?: Record<string, unknown>;
  webhookDedupKey: string | null;
}): WiseCorrelationResult {
  const shortCode = parseProvvyPaymentReference(input.customerReference);
  if (!shortCode) {
    return {
      status: 'rejected',
      reason: 'invalid_provvvy_reference',
      detail: input.customerReference,
    };
  }

  const link = input.paymentLink;
  if (!link || link.short_code.toLowerCase() !== shortCode.toLowerCase()) {
    return { status: 'rejected', reason: 'payment_link_not_found', detail: shortCode };
  }

  if (link.status !== 'OPEN') {
    return { status: 'rejected', reason: 'payment_link_not_open', detail: link.status };
  }

  if (link.payment_method && !paymentLinkAllowsMultiCheckoutRail(link.payment_method, 'WISE')) {
    return { status: 'rejected', reason: 'payment_rail_not_wise', detail: link.payment_method };
  }

  const merchantProfileId = input.merchantProfile?.wise_profile_id?.trim();
  if (
    input.webhookProfileId != null &&
    merchantProfileId &&
    String(input.webhookProfileId) !== merchantProfileId
  ) {
    return { status: 'rejected', reason: 'profile_mismatch' };
  }

  if (!input.merchantProfile?.wise_enabled || !merchantProfileId) {
    return { status: 'rejected', reason: 'profile_mismatch', detail: 'Wise not enabled for merchant' };
  }

  const expectedCurrency = invoiceDenominationCurrency(link).toUpperCase();
  const receivedCurrency = input.receivedCurrency?.toString().trim().toUpperCase();
  if (!receivedCurrency || receivedCurrency !== expectedCurrency) {
    return {
      status: 'rejected',
      reason: 'currency_mismatch',
      detail: `${receivedCurrency ?? 'missing'} vs ${expectedCurrency}`,
    };
  }

  const expectedAmount = toWiseNumber(link.amount);
  const receivedAmount = input.receivedAmount;
  if (
    expectedAmount == null ||
    receivedAmount == null ||
    !amountsMatch(expectedAmount, receivedAmount)
  ) {
    return {
      status: 'rejected',
      reason: 'amount_mismatch',
      detail: `${receivedAmount} vs ${expectedAmount}`,
    };
  }

  if (!input.webhookDedupKey) {
    return { status: 'rejected', reason: 'missing_transfer_id', detail: 'No webhook dedup key' };
  }

  const transferSettlementKey = buildWiseTransferSettlementKey(input.wiseTransferId);

  return {
    status: 'correlated',
    paymentLinkId: link.id,
    shortCode: link.short_code,
    reference: buildProvvyWiseReference(link.short_code),
    amountReceived: receivedAmount,
    currencyReceived: receivedCurrency,
    webhookDedupKey: input.webhookDedupKey,
    providerRef: transferSettlementKey,
    transactionId: input.wiseTransferId,
    wiseTransferId: input.wiseTransferId,
    correlationMetadata: {
      wiseEventType: input.wiseEventType,
      wiseTransferId: input.wiseTransferId,
      wiseCustomerReference: input.customerReference,
      wiseTransferSettlementKey: transferSettlementKey,
      ...input.extraMetadata,
    },
  };
}

/** balances#update must NOT be used for Provvy reference correlation. */
export function correlateWiseBalanceCreditEvent(input: {
  payload: WiseWebhookPayload;
}): WiseCorrelationResult {
  const eventType = input.payload.event_type?.trim();
  if (eventType !== 'balances#update') {
    return { status: 'ignored', reason: `Unhandled event type: ${eventType ?? 'unknown'}` };
  }

  const data = input.payload.data;
  if (!data || data.transaction_type?.toLowerCase() !== 'credit') {
    return { status: 'ignored', reason: 'Not a balance credit event' };
  }

  const transferReference = data.transfer_reference?.trim();
  if (transferReference && parseProvvyPaymentReference(transferReference)) {
    return {
      status: 'rejected',
      reason: 'invalid_provvvy_reference',
      detail: `transfer_reference is Wise internal id, not customer reference: ${transferReference}`,
    };
  }

  return {
    status: 'ignored',
    reason:
      'balances#update does not carry customer payment reference; handled via account-details-payment or swift-in#credit',
  };
}

export function correlateAccountDetailsPaymentStateChange(input: {
  payload: WiseWebhookPayload;
  customerPaymentReference: string | null;
  paymentLink: WisePaymentLinkCandidate | null;
  merchantProfile: WiseMerchantProfile | null;
  statementFound: boolean;
}): WiseCorrelationResult {
  const eventType = input.payload.event_type?.trim();
  if (eventType !== 'account-details-payment#state-change') {
    return { status: 'ignored', reason: `Unhandled event type: ${eventType ?? 'unknown'}` };
  }

  const data = input.payload.data;
  const currentState = data?.current_state?.trim().toUpperCase();
  if (currentState !== 'COMPLETED') {
    return { status: 'ignored', reason: `Payment state ${currentState ?? 'unknown'} not completed` };
  }

  const transferId = data?.transfer?.id;
  if (transferId == null) {
    return { status: 'rejected', reason: 'missing_transfer_id' };
  }

  if (!input.statementFound) {
    return {
      status: 'rejected',
      reason: 'statement_transaction_not_found',
      detail: String(transferId),
    };
  }

  const customerReference = input.customerPaymentReference?.trim();
  if (!customerReference) {
    return { status: 'rejected', reason: 'missing_customer_reference', detail: String(transferId) };
  }

  const receivedAmount = toWiseNumber(data?.transfer?.amount ?? data?.amount);
  const receivedCurrency = data?.transfer?.currency ?? data?.currency;
  const webhookProfileId = data?.resource?.profile_id;

  return validateCorrelatedPayment({
    customerReference,
    paymentLink: input.paymentLink,
    merchantProfile: input.merchantProfile,
    webhookProfileId,
    receivedAmount,
    receivedCurrency,
    wiseEventType: eventType,
    wiseTransferId: String(transferId),
    webhookDedupKey:
      buildWiseWebhookDedupKey(input.payload) ??
      `wise:account-details:${transferId}:${currentState}`,
    extraMetadata: {
      wiseStatementReferenceNumber: `TRANSFER-${transferId}`,
      wiseBalanceId: data?.resource?.id ?? null,
      wiseOccurredAt: data?.occurred_at ?? null,
    },
  });
}

export function correlateSwiftInCreditEvent(input: {
  payload: WiseWebhookPayload;
  paymentLink: WisePaymentLinkCandidate | null;
  merchantProfile: WiseMerchantProfile | null;
}): WiseCorrelationResult {
  const eventType = input.payload.event_type?.trim();
  if (eventType !== 'swift-in#credit') {
    return { status: 'ignored', reason: `Unhandled event type: ${eventType ?? 'unknown'}` };
  }

  const data = input.payload.data;
  const transferId = data?.action?.id;
  if (transferId == null) {
    return { status: 'rejected', reason: 'missing_transfer_id' };
  }

  const customerReference = data?.resource?.reference?.trim();
  if (!customerReference) {
    return { status: 'rejected', reason: 'missing_customer_reference', detail: String(transferId) };
  }

  const receivedAmount = toWiseNumber(
    data?.resource?.settled_amount?.value ?? data?.resource?.instructed_amount?.value
  );
  const receivedCurrency =
    data?.resource?.settled_amount?.currency ?? data?.resource?.instructed_amount?.currency;

  return validateCorrelatedPayment({
    customerReference,
    paymentLink: input.paymentLink,
    merchantProfile: input.merchantProfile,
    webhookProfileId: data?.action?.profile_id,
    receivedAmount,
    receivedCurrency,
    wiseEventType: eventType,
    wiseTransferId: String(transferId),
    webhookDedupKey:
      buildWiseWebhookDedupKey(input.payload) ?? `wise:swift-in:${transferId}`,
    extraMetadata: {
      wiseSwiftUetr: data?.resource?.uetr ?? null,
      wiseOccurredAt: data?.occurred_at ?? null,
    },
  });
}

/** Correlate transfers#state-change when payment_links.wise_transfer_id is already linked. */
export function correlateWiseTransferStateChange(input: {
  payload: WiseWebhookPayload;
  paymentLink: WisePaymentLinkCandidate | null;
}): WiseCorrelationResult {
  const eventType = input.payload.event_type?.trim();
  if (eventType !== 'transfers#state-change') {
    return { status: 'ignored', reason: `Unhandled event type: ${eventType ?? 'unknown'}` };
  }

  const resource = input.payload.data?.resource;
  const transferId = resource?.id;
  const status = resource?.status;
  if (transferId == null || !status) {
    return { status: 'ignored', reason: 'Missing transfer id or status' };
  }

  const internalStatus = mapWiseStatusToInternal(status);
  if (internalStatus === 'FAILED') {
    return { status: 'ignored', reason: 'Transfer failed' };
  }
  if (internalStatus !== 'PAID') {
    return { status: 'ignored', reason: `Transfer status ${status} not paid` };
  }

  const link = input.paymentLink;
  if (!link) {
    return { status: 'rejected', reason: 'payment_link_not_found', detail: String(transferId) };
  }

  if (link.status !== 'OPEN') {
    return { status: 'rejected', reason: 'payment_link_not_open', detail: link.status };
  }

  const dedupKey =
    buildWiseWebhookDedupKey(input.payload) ?? `wise:transfer-state:${transferId}:${status}`;

  const amountReceived =
    resource.target_amount != null ? Number(resource.target_amount) : toWiseNumber(link.amount);
  const currencyReceived = (resource.target_currency ?? link.currency)?.toString();

  if (amountReceived == null || !currencyReceived) {
    return { status: 'rejected', reason: 'amount_mismatch' };
  }

  const expectedAmount = toWiseNumber(link.amount);
  const expectedCurrency = invoiceDenominationCurrency(link).toUpperCase();
  if (currencyReceived.toUpperCase() !== expectedCurrency) {
    return { status: 'rejected', reason: 'currency_mismatch' };
  }
  if (expectedAmount == null || !amountsMatch(expectedAmount, amountReceived)) {
    return { status: 'rejected', reason: 'amount_mismatch' };
  }

  const wiseTransferId = String(transferId);
  const transferSettlementKey = buildWiseTransferSettlementKey(wiseTransferId);

  return {
    status: 'correlated',
    paymentLinkId: link.id,
    shortCode: link.short_code,
    reference: buildProvvyWiseReference(link.short_code),
    amountReceived,
    currencyReceived: currencyReceived.toUpperCase(),
    webhookDedupKey: dedupKey,
    providerRef: transferSettlementKey,
    transactionId: wiseTransferId,
    wiseTransferId,
    correlationMetadata: {
      wiseEventType: eventType,
      wiseTransferId: transferId,
      wiseStatus: status,
      wiseRate: resource.rate ?? null,
      sourceCurrency: resource.source_currency ?? null,
      targetCurrency: resource.target_currency ?? null,
      wiseTransferSettlementKey: transferSettlementKey,
    },
  };
}
