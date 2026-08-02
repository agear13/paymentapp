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
    throw new Error(
      typeof payload.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : 'Failed to delete invoice'
    );
  }
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
