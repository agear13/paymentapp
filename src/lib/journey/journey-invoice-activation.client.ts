'use client';

import { parseSourceParticipantHint } from '@/lib/participants/source-participant-hint';
import {
  GENERATE_INVOICE_INTENT,
  isSafeInvoiceActivationDestination,
  participantPortalCreateInvoiceHref,
} from '@/lib/invoices/participant-invoice-activation';
import {
  persistSourceParticipantHint,
  readStoredSourceParticipantHint,
} from '@/lib/journey/journey-source-participant.client';

const INTENT_KEY = 'provvy.journey.invoiceActivationIntent';
const NEXT_KEY = 'provvy.journey.invoiceActivationNext';

function readStorageItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;
    const localValue = localStorage.getItem(key);
    if (localValue) {
      sessionStorage.setItem(key, localValue);
      return localValue;
    }
  } catch {
    /* ignore storage errors */
  }
  return null;
}

function writeStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
  } catch {
    /* ignore storage errors */
  }
}

function removeStorageItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    /* ignore storage errors */
  }
}

export function persistInvoiceActivationIntent(participantId: string): void {
  const parsed = parseSourceParticipantHint(participantId);
  if (parsed.kind !== 'hint') return;
  persistSourceParticipantHint(parsed.value);
  writeStorageItem(INTENT_KEY, GENERATE_INVOICE_INTENT);
  writeStorageItem(NEXT_KEY, participantPortalCreateInvoiceHref(parsed.value));
}

export function readStoredInvoiceActivationNext(): string | null {
  const intent = readStorageItem(INTENT_KEY);
  if (intent !== GENERATE_INVOICE_INTENT) return null;
  const next = readStorageItem(NEXT_KEY);
  return isSafeInvoiceActivationDestination(next) ? next : null;
}

export function clearStoredInvoiceActivationIntent(): void {
  removeStorageItem(INTENT_KEY);
  removeStorageItem(NEXT_KEY);
}

/**
 * Capture generate-invoice intent from the provisioning URL.
 * A valid query intent overwrites storage. Missing query keeps any stored intent
 * so OAuth/email-verification returns to `?build=1` still land on Create Invoice.
 */
export function captureInvoiceActivationIntentFromSearchParams(
  searchParams: { get(name: string): string | null } | null | undefined
): string | null {
  const intent = searchParams?.get('intent')?.trim();
  const hintFromQuery = parseSourceParticipantHint(
    searchParams?.get('sourceParticipantId') ?? searchParams?.get('participantId')
  );
  if (intent === GENERATE_INVOICE_INTENT) {
    const participantId =
      hintFromQuery.kind === 'hint' ? hintFromQuery.value : readStoredSourceParticipantHint();
    if (participantId) {
      persistInvoiceActivationIntent(participantId);
      return participantPortalCreateInvoiceHref(participantId);
    }
  }
  return readStoredInvoiceActivationNext();
}

/** After bootstrap: consume stored Create Invoice destination, else null (caller uses Workspace). */
export function consumePostProvisioningDestination(): string | null {
  const next = readStoredInvoiceActivationNext();
  if (!next) return null;
  clearStoredInvoiceActivationIntent();
  return next;
}
