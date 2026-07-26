'use client';

/**
 * Client-side orchestration for the existing Pinch sandbox flow:
 * CaptureJS → POST /api/pinch/sources → POST /api/pinch/payments.
 *
 * Server-side Pinch logic lives in PinchSourceService / PinchPaymentService.
 */

import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import type { PinchCreatePaymentResponse } from '@/lib/payments/pinch/payment-service';
import type {
  PinchCreateSourceResponse,
  PinchSourceType,
} from '@/lib/payments/pinch/source-service';

export const PINCH_CAPTUREJS_SRC = 'https://cdn.getpinch.com.au/capturejs/pinch.capture.v2.js';
export const PINCH_CAPTUREJS_INTEGRITY =
  'sha384-hglYFSKC4AMA/rAQOGB3OiA8u5ri5F4qNMGgw4I+fggDSlTmPyREcj1J+VGnkAX8';

export const PINCH_SANDBOX_BANK_DEFAULTS = {
  bankAccountName: 'Jane Smith',
  bankAccountRouting: '000000',
  bankAccountNumber: '000000000',
} as const;

type PinchCaptureInstance = {
  createToken: (options: Record<string, string>) => Promise<{ token: string }>;
};

declare global {
  interface Window {
    Pinch?: {
      Capture: (config: { publishableKey: string }) => PinchCaptureInstance;
    };
  }
}

export type PinchCollectionFlowResult = {
  source: PinchCreateSourceResponse;
  payment: PinchCreatePaymentResponse;
};

export function formatPinchTransactionDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isPinchPaymentFailed(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === 'failed' || normalized === 'dishonoured' || normalized === 'cancelled';
}

/** Matches the existing /dev/pinch success path — non-failed createPayment response. */
export function isPinchPaymentSuccessful(status: string): boolean {
  return !isPinchPaymentFailed(status);
}

export function formatPinchPayerLabel(
  payer: PinchCreatePaymentResponse['payer'] | null | undefined,
  fallback = 'Payer',
): string {
  if (!payer) return fallback;

  const company = payer.companyName?.trim();
  if (company) return company;

  const name = [payer.firstName, payer.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;

  return payer.emailAddress?.trim() || fallback;
}

export function formatPinchSourceTypeLabel(sourceType: string): string {
  switch (sourceType) {
    case 'bank-account':
      return 'Direct Debit';
    case 'credit-card':
      return 'Credit Card';
    case 'payto-account':
      return 'PayTo';
    default:
      return sourceType;
  }
}

export function formatPinchPaymentStatusLabel(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'scheduled') return 'Scheduled';
  if (normalized === 'processing') return 'Processing';
  if (normalized === 'completed' || normalized === 'cleared') return 'Completed';
  if (normalized === 'failed') return 'Failed';
  if (normalized === 'dishonoured') return 'Failed';
  if (normalized === 'cancelled') return 'Cancelled';
  return status.trim() || 'Unknown';
}

async function createCaptureToken(
  publishableKey: string,
  sourceType: PinchSourceType,
): Promise<string> {
  if (!publishableKey) {
    throw new Error('NEXT_PUBLIC_PINCH_PUBLISHABLE_KEY is not configured');
  }
  if (!window.Pinch) {
    throw new Error('Pinch CaptureJS is not loaded yet');
  }

  const capture = window.Pinch.Capture({ publishableKey });
  const tokenOptions: Record<string, string> =
    sourceType === 'bank-account'
      ? {
          sourceType: 'bank-account',
          bankAccountName: PINCH_SANDBOX_BANK_DEFAULTS.bankAccountName,
          bankAccountRouting: PINCH_SANDBOX_BANK_DEFAULTS.bankAccountRouting,
          bankAccountNumber: PINCH_SANDBOX_BANK_DEFAULTS.bankAccountNumber,
        }
      : {
          sourceType: 'credit-card',
          cardNumber: '4242424242424242',
          expiryMonth: '12',
          expiryYear: '2030',
          cvc: '123',
          cardHolderName: 'Jane Smith',
        };

  const result = await capture.createToken(tokenOptions);
  if (!result.token) {
    throw new Error('CaptureJS did not return a token');
  }

  return result.token;
}

export async function runPinchCollectionFlow(input: {
  payerId: string;
  amountCents: number;
  description: string;
  publishableKey: string;
  sourceType?: PinchSourceType;
  onStep?: (step: 'capture' | 'source' | 'payment') => void;
}): Promise<PinchCollectionFlowResult> {
  const sourceType = input.sourceType ?? 'bank-account';
  const payerId = input.payerId.trim();

  if (!payerId) {
    throw new Error('Pinch payer ID is required (set PINCH_TEST_PAYER_ID)');
  }

  input.onStep?.('capture');
  const token = await createCaptureToken(input.publishableKey, sourceType);

  input.onStep?.('source');
  const sourceRes = await csrfAwareFetch('/api/pinch/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payerId, token, sourceType }),
  });

  const sourceJson = (await sourceRes.json()) as PinchCreateSourceResponse | { error?: string };
  if (!sourceRes.ok) {
    throw new Error(
      `Source creation failed (${sourceRes.status}): ${JSON.stringify(sourceJson)}`,
    );
  }

  const sourceId = 'id' in sourceJson && typeof sourceJson.id === 'string' ? sourceJson.id : null;
  if (!sourceId) {
    throw new Error('Source response did not include an id');
  }

  input.onStep?.('payment');
  const paymentRes = await csrfAwareFetch('/api/pinch/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payerId,
      sourceId,
      amount: input.amountCents,
      transactionDate: formatPinchTransactionDate(),
      description: input.description,
    }),
  });

  const paymentJson = (await paymentRes.json()) as PinchCreatePaymentResponse | { error?: string };
  if (!paymentRes.ok) {
    throw new Error(
      `Payment creation failed (${paymentRes.status}): ${JSON.stringify(paymentJson)}`,
    );
  }

  if (!('status' in paymentJson) || typeof paymentJson.status !== 'string') {
    throw new Error('Payment response did not include a status');
  }

  if (isPinchPaymentFailed(paymentJson.status)) {
    throw new Error(`Payment failed with status ${paymentJson.status}`);
  }

  return {
    source: sourceJson as PinchCreateSourceResponse,
    payment: paymentJson as PinchCreatePaymentResponse,
  };
}

export async function fetchPinchDevTestPayerId(): Promise<string | null> {
  try {
    const res = await fetch('/api/pinch/dev-config');
    if (!res.ok) return null;
    const data = (await res.json()) as { testPayerId?: string | null };
    return data.testPayerId?.trim() || null;
  } catch {
    return null;
  }
}
