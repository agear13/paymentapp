'use client';

/**
 * Development/demo-only helper that simulates external Pinch payment confirmation
 * using the existing Pinch response models — no live debits, no duplicate engine.
 */

import {
  formatPinchTransactionDate,
  PINCH_SANDBOX_BANK_DEFAULTS,
  type PinchCollectionFlowResult,
} from '@/lib/payments/pinch/collection-flow.client';
import {
  isDevelopmentPaymentSimulatorEnabled,
  isHackathonJourneyEnabled,
} from '@/lib/journey/hackathon-journey';
import type { PinchCreatePaymentResponse } from '@/lib/payments/pinch/payment-service';
import type {
  PinchCreateSourceResponse,
  PinchSourceType,
} from '@/lib/payments/pinch/source-service';

export { isDevelopmentPaymentSimulatorEnabled, isHackathonJourneyEnabled };

const DEFAULT_MIN_DELAY_MS = 3000;
const DEFAULT_MAX_DELAY_MS = 5000;

function randomDelayMs(minMs: number, maxMs: number): number {
  return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function shouldSimulatePinchPaymentConfirmation(): boolean {
  return isHackathonJourneyEnabled();
}

export function buildSimulatedPinchCollectionResult(input: {
  amountCents: number;
  description: string;
  payerLabel: string;
  payerId?: string | null;
  sourceType?: PinchSourceType;
}): PinchCollectionFlowResult {
  const transactionDate = formatPinchTransactionDate();
  const payerId = input.payerId?.trim() || 'pyr_demo_simulated';
  const sourceType = input.sourceType ?? 'bank-account';
  const stamp = Date.now();

  const source: PinchCreateSourceResponse = {
    id: `src_demo_${stamp}`,
    payerId,
    sourceType,
    bankAccountName: PINCH_SANDBOX_BANK_DEFAULTS.bankAccountName,
    bankAccountNumber: '0000',
    bankAccountBsb: '000000',
    last4: '0000',
    metadata: { simulated: true },
  };

  const payer: PinchCreatePaymentResponse['payer'] = {
    id: payerId,
    firstName: input.payerLabel.split(' ')[0] || 'Demo',
    lastName: input.payerLabel.split(' ').slice(1).join(' ') || 'Payer',
    emailAddress: 'demo@example.com',
    mobileNumber: null,
    streetAddress: null,
    suburb: null,
    postcode: null,
    state: null,
    country: 'AU',
    companyName: input.payerLabel,
    companyRegistrationNumber: null,
    metadata: { simulated: true },
  };

  const payment: PinchCreatePaymentResponse = {
    id: `pmt_demo_${stamp}`,
    attemptId: `att_demo_${stamp}`,
    amount: input.amountCents,
    currency: 'AUD',
    description: input.description,
    applicationFee: 0,
    totalFee: 0,
    isSurcharged: false,
    sourceType,
    transactionDate,
    status: 'scheduled',
    estimatedTransferDate: transactionDate,
    actualTransferDate: null,
    payer,
    subscription: null,
    attempts: [],
    metadata: { simulated: true, demoMode: true },
  };

  return { source, payment };
}

export type DemoClientPaymentStep = 'request' | 'received' | 'reconciled';

export function deriveDemoClientPaymentPurpose(dealName: string | undefined): string {
  if (dealName?.trim()) {
    return `Project funds · ${dealName.trim()}`;
  }
  return 'Agreed project funds';
}

export function deriveDemoClientPaymentStatus(options: {
  busy: boolean;
  demoStep: DemoClientPaymentStep | null;
  complete: boolean;
}): string {
  if (options.complete) return 'Funds reconciled';
  if (options.demoStep === 'reconciled') return 'Reconciling funds';
  if (options.demoStep === 'received') return 'Client payment received';
  if (options.demoStep === 'request') return 'Payment request created';
  if (options.busy) return 'Simulating payment';
  return 'Demo mode · Ready to simulate';
}

/**
 * Demo-only client payment simulation with hackathon-friendly progress steps.
 */
export async function simulateDemoClientPayment(input: {
  amountCents: number;
  description: string;
  payerLabel: string;
  payerId?: string | null;
  sourceType?: PinchSourceType;
  onDemoStep?: (step: DemoClientPaymentStep) => void;
  minDelayMs?: number;
  maxDelayMs?: number;
}): Promise<PinchCollectionFlowResult> {
  if (!isDevelopmentPaymentSimulatorEnabled()) {
    throw new Error('Payment simulator is disabled');
  }

  const minDelayMs = input.minDelayMs ?? DEFAULT_MIN_DELAY_MS;
  const maxDelayMs = input.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const totalDelayMs = randomDelayMs(minDelayMs, maxDelayMs);
  const stepDelayMs = Math.max(500, Math.floor(totalDelayMs / 3));

  input.onDemoStep?.('request');
  await sleep(stepDelayMs);
  input.onDemoStep?.('received');
  await sleep(stepDelayMs);
  input.onDemoStep?.('reconciled');
  await sleep(Math.max(0, totalDelayMs - stepDelayMs * 2));

  return buildSimulatedPinchCollectionResult(input);
}

/**
 * Walks through the same collection steps as the sandbox flow, then returns
 * typed Pinch source/payment responses for the existing Stage 5 completion path.
 */
export async function simulatePinchPaymentConfirmation(input: {
  amountCents: number;
  description: string;
  payerLabel: string;
  payerId?: string | null;
  sourceType?: PinchSourceType;
  onStep?: (step: 'capture' | 'source' | 'payment') => void;
  minDelayMs?: number;
  maxDelayMs?: number;
}): Promise<PinchCollectionFlowResult> {
  if (!isDevelopmentPaymentSimulatorEnabled()) {
    throw new Error('Payment simulator is disabled');
  }

  const minDelayMs = input.minDelayMs ?? DEFAULT_MIN_DELAY_MS;
  const maxDelayMs = input.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const totalDelayMs = randomDelayMs(minDelayMs, maxDelayMs);
  const stepDelayMs = Math.max(500, Math.floor(totalDelayMs / 3));

  input.onStep?.('capture');
  await sleep(stepDelayMs);
  input.onStep?.('source');
  await sleep(stepDelayMs);
  input.onStep?.('payment');
  await sleep(Math.max(0, totalDelayMs - stepDelayMs * 2));

  return buildSimulatedPinchCollectionResult(input);
}
