/**
 * Shared merchant invoice actions — single source for API calls.
 * Consumed by Commercial OS Invoice Detail and legacy dashboard flows.
 */

import type { PaymentLinkDetails } from '@/components/payment-links/payment-link-detail-dialog';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';

export async function fetchPaymentLinkDetail(id: string): Promise<PaymentLinkDetails> {
  const response = await fetch(`/api/payment-links/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch payment link details');
  }
  const result = await response.json();
  return result.data as PaymentLinkDetails;
}

export async function fetchPaymentLinkQrCodeDataUrl(id: string): Promise<string> {
  const response = await fetch(`/api/payment-links/${id}/qr-code`);
  if (!response.ok) {
    throw new Error('Failed to load QR code');
  }
  const result = await response.json();
  return result.data.qrCode as string;
}

export type LifecycleSnapshot = {
  health?: string;
  healthLabel?: string;
  invoiceLifecycle?: {
    state: string;
    stateLabel: string;
    amountPaid: number;
    amountOutstanding: number;
    timeline: {
      id: string;
      state: string;
      label: string;
      reached: boolean;
      occurredAt: string | null;
    }[];
  };
  settlements?: {
    id: string;
    status: string;
    currency: string;
    amount: string;
    settledAt: string | null;
  }[];
};

export async function fetchPaymentLinkLifecycle(id: string): Promise<LifecycleSnapshot> {
  const response = await csrfAwareFetch(`/api/payment-links/${encodeURIComponent(id)}/lifecycle`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load lifecycle');
  }
  return payload.data as LifecycleSnapshot;
}

export type CryptoConfirmationRow = {
  id: string;
  payerNetwork: string | null;
  payerTxHash: string | null;
  payerWalletAddress: string | null;
  payerCurrency: string | null;
  payerAmountSent: string | null;
  verificationStatus: string | null;
  paymentLink: { id: string };
};

export async function fetchCryptoConfirmationsForOrg(
  organizationId: string
): Promise<CryptoConfirmationRow[]> {
  const response = await fetch(
    `/api/payment-links/crypto-confirmations?organizationId=${encodeURIComponent(organizationId)}`
  );
  if (!response.ok) return [];
  const result = await response.json();
  return (result.data ?? []) as CryptoConfirmationRow[];
}

export type ManualBankConfirmationRow = {
  id: string;
  payerAmountSent: string;
  payerCurrency: string | null;
  payerDestination: string | null;
  payerPaymentMethodUsed: string | null;
  payerReference: string | null;
  payerProofDetails: string | null;
  payerNote: string | null;
  verificationStatus: string | null;
  matchConfidence: string | null;
  verificationIssues: string[];
  paymentLink: { id: string };
};

export async function fetchManualBankConfirmationsForOrg(
  organizationId: string
): Promise<ManualBankConfirmationRow[]> {
  const response = await fetch(
    `/api/payment-links/manual-bank-confirmations?organizationId=${encodeURIComponent(organizationId)}`
  );
  if (!response.ok) return [];
  const result = await response.json();
  return (result.data ?? []) as ManualBankConfirmationRow[];
}

export type PaymentConfirmationReviewAction = 'mark_valid' | 'flag_investigate' | 'acknowledge';

export async function submitCryptoConfirmationReview(
  confirmationId: string,
  action: PaymentConfirmationReviewAction
): Promise<{ message?: string }> {
  const response = await fetch(`/api/payment-links/crypto-confirmations/${confirmationId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  const json = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(json.error || 'Review request failed');
  }
  return json;
}

export async function submitManualBankConfirmationReview(
  confirmationId: string,
  action: PaymentConfirmationReviewAction
): Promise<{ message?: string }> {
  const response = await fetch(
    `/api/payment-links/manual-bank-confirmations/${confirmationId}/review`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }
  );
  const json = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(json.error || 'Review request failed');
  }
  return json;
}

export async function sendPaymentLinkInvoice(id: string, email: string): Promise<void> {
  const response = await fetch(`/api/payment-links/${id}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Could not send invoice');
  }
}

export async function resendPaymentLinkInvoice(id: string): Promise<void> {
  const response = await fetch(`/api/payment-links/${id}/resend`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Could not resend invoice');
  }
}

export async function postPaymentLinkManualSettlement(
  id: string,
  action: 'mark_paid' | 'reopen'
): Promise<void> {
  const response = await csrfAwareFetch(`/api/payment-links/${id}/manual-settlement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    const errMsg =
      typeof body.error === 'string' && body.error.trim()
        ? body.error.trim()
        : response.status === 403
          ? 'You do not have permission for this action.'
          : action === 'mark_paid'
            ? 'Could not mark invoice as paid'
            : 'Could not reopen invoice';
    throw new Error(errMsg);
  }
}

export async function cancelPaymentLink(id: string): Promise<void> {
  const response = await csrfAwareFetch(`/api/payment-links/${id}`, {
    method: 'DELETE',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : 'Failed to cancel invoice'
    );
  }
}

export async function downloadPaymentLinkQrCode(id: string, shortCode: string): Promise<void> {
  const response = await fetch(`/api/payment-links/${id}/qr-code?format=png&download=true`);
  if (!response.ok) {
    throw new Error('Failed to download QR code');
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `qr-${shortCode}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

export async function deletePaymentLink(id: string): Promise<void> {
  const response = await fetch(`/api/payment-links/${id}/delete`, {
    method: 'POST',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        'You do not have permission to delete invoices for this organization. Ask an admin to grant invoice delete access.'
      );
    }
    const err = new Error(
      typeof payload.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : 'Failed to delete invoice'
    ) as Error & { code?: string; requiresAccountingDialog?: boolean };
    err.code = payload.code;
    err.requiresAccountingDialog = payload.requiresAccountingDialog;
    throw err;
  }
}

export async function archivePaymentLink(id: string): Promise<{ message: string }> {
  const response = await fetch(`/api/payment-links/${id}/archive`, { method: 'POST' });
  const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(payload.error?.trim() || 'Failed to archive invoice');
  }
  return { message: payload.message ?? 'Invoice archived.' };
}

export async function voidPaymentLink(id: string): Promise<{ message: string; queued?: boolean }> {
  const response = await fetch(`/api/payment-links/${id}/void`, { method: 'POST' });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    queued?: boolean;
  };
  if (!response.ok) {
    throw new Error(payload.error?.trim() || 'Failed to void invoice');
  }
  return { message: payload.message ?? 'Void queued.', queued: payload.queued };
}

export function canEditPaymentLink(status: string): boolean {
  return status === 'DRAFT' || status === 'OPEN';
}

export function canResendPaymentLink(status: string): boolean {
  return status === 'DRAFT' || status === 'OPEN' || status === 'PAID_UNVERIFIED';
}

export function canMarkAsPaid(status: string): boolean {
  return status === 'OPEN';
}

export function canReopenPaymentLink(status: string): boolean {
  return status === 'PAID' || status === 'PAID_UNVERIFIED' || status === 'REQUIRES_REVIEW';
}

export function canCancelPaymentLink(status: string): boolean {
  return status !== 'PAID' && status !== 'EXPIRED' && status !== 'CANCELED';
}

export function canDeletePaymentLink(status: string): boolean {
  return status === 'DRAFT' || status === 'OPEN' || status === 'CANCELED';
}
