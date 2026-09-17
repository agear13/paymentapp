import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { parseDelayedPaymentDays } from '@/lib/commercial-incentive/detect-delayed-terms';
import type { EarlyPaymentIncentiveRecord } from '@/lib/commercial-incentive/types';
import type { CanonicalIncentiveSnapshot } from '@/lib/xlayer/terms-hash';

const MINOR_UNITS_PER_MAJOR = 100;

function trimLabel(value: string | null | undefined, fallback: string): string {
  const next = value?.replace(/\s+/g, ' ').trim();
  return next && next.length > 0 ? next.slice(0, 120) : fallback;
}

function partyByRole(result: ExtractionResult, needle: string): string | null {
  const match = result.parties?.find((party) =>
    (party.role.value ?? '').toLowerCase().includes(needle)
  );
  return match?.name.value?.trim() || null;
}

export function amountMinorUnitsFromExtraction(result: ExtractionResult): number {
  const termAmounts = (result.paymentTerms ?? [])
    .map((term) => term.amount.value)
    .filter((amount): amount is number => amount != null && Number.isFinite(amount) && amount > 0);
  const major =
    termAmounts.length > 0
      ? termAmounts.reduce((sum, amount) => sum + amount, 0)
      : result.projectValue.value;
  if (major == null || !Number.isFinite(major) || major <= 0) {
    throw Object.assign(new Error('Agreement extraction does not include a usable amount'), {
      code: 'MISSING_AMOUNT',
      status: 409,
    });
  }
  return Math.round(major * MINOR_UNITS_PER_MAJOR);
}

export function currencyFromExtraction(result: ExtractionResult): string {
  const fromTerms = result.paymentTerms?.find((term) => term.currency.value?.trim())?.currency.value;
  const currency = (fromTerms || result.currency.value || 'AUD').trim().toUpperCase();
  return currency.slice(0, 8);
}

export function originalDueLabelFromExtraction(result: ExtractionResult): string | null {
  const fromTerms = result.paymentTerms
    ?.map((term) => term.dueCondition.value?.trim() || term.description.value?.trim() || '')
    .find(Boolean);
  return fromTerms || null;
}

export function dueDateUnixFromExtraction(result: ExtractionResult): number {
  const text = originalDueLabelFromExtraction(result) ?? '';
  const delayedDays = parseDelayedPaymentDays(text) ?? 30;
  const base = Date.parse(result.extractedAt);
  const start = Number.isFinite(base) ? base : Date.now();
  return Math.floor((start + delayedDays * 24 * 60 * 60 * 1000) / 1000);
}

export function buyerLabelFromExtraction(result: ExtractionResult): string {
  return trimLabel(
    result.agreementOwner?.name.value ||
      partyByRole(result, 'buyer') ||
      partyByRole(result, 'client') ||
      'Buyer',
    'Buyer'
  );
}

export function supplierLabelFromExtraction(result: ExtractionResult): string {
  return trimLabel(
    partyByRole(result, 'supplier') ||
      partyByRole(result, 'vendor') ||
      result.counterparty.value,
    'Supplier'
  );
}

export function purposeFromExtraction(result: ExtractionResult): string {
  return trimLabel(
    result.projectName.value || result.projectDescription.value,
    'Commercial commitment'
  );
}

export function incentiveSnapshotFromDecision(
  decision: EarlyPaymentIncentiveRecord | null
): CanonicalIncentiveSnapshot {
  if (!decision || decision.status !== 'approved') return null;
  return {
    status: 'approved',
    policyId: decision.policyId,
    acceleratedDays: decision.acceleratedDays,
    incentivePercent: decision.incentivePercent,
    compensationType: decision.compensationType,
  };
}

export function offchainStageFromAgreement(agreement: {
  approved_at: Date | null;
  extraction_status: string;
}): string {
  if (agreement.approved_at || agreement.extraction_status === 'APPROVED') {
    return 'agreement_approved';
  }
  return 'negotiated';
}
