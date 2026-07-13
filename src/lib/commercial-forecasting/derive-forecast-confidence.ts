/**
 * Forecast confidence derivation.
 *
 * Confidence derives from agreement status, participant approvals, settlement
 * readiness, invoice lifecycle, and funding source status — never fabricated.
 */

import {
  isFundingConfirmed,
  isFundingForecast,
  isFundingPending,
  isHighFundingConfidence,
  isMediumFundingConfidence,
} from '@/lib/projects/funding-sources/funding-source-status';
import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { InvoiceForecastInput, SettlementForecastInput } from '@/lib/commercial-forecasting/types';
import { CommercialForecastConfidence } from '@/lib/commercial-forecasting/types';
import { CustomerInvoiceLifecycleState } from '@/lib/payment-links/customer-invoice-lifecycle';
import { CommercialReconciliationStatus } from '@/lib/commercial-reconciliation/types';

export type ConfidenceDerivationInput = {
  fundingSource?: ProjectFundingSourceDto | null;
  invoice?: InvoiceForecastInput | null;
  settlement?: SettlementForecastInput | null;
  releaseConfidence?: ReleaseConfidenceSnapshot | null;
};

/** Map funding source status to forecast confidence. */
export function confidenceFromFundingSource(
  source: ProjectFundingSourceDto
): { confidence: CommercialForecastConfidence; reasons: string[] } {
  const reasons: string[] = [];

  if (isFundingConfirmed(source.status) || source.actualSettlementDate) {
    reasons.push('Funding confirmed and received');
    return { confidence: CommercialForecastConfidence.Committed, reasons };
  }

  if (isFundingPending(source.status)) {
    if (isHighFundingConfidence(source.confidenceLevel)) {
      reasons.push('Payment pending with high confidence');
      return { confidence: CommercialForecastConfidence.Likely, reasons };
    }
    if (isMediumFundingConfidence(source.confidenceLevel)) {
      reasons.push('Payment pending with medium confidence');
      return { confidence: CommercialForecastConfidence.Expected, reasons };
    }
    reasons.push('Payment pending with low confidence');
    return { confidence: CommercialForecastConfidence.Tentative, reasons };
  }

  if (isFundingForecast(source.status)) {
    reasons.push('Revenue forecast — not yet invoiced');
    return { confidence: CommercialForecastConfidence.Tentative, reasons };
  }

  reasons.push(`Funding source status: ${source.status}`);
  return { confidence: CommercialForecastConfidence.Expected, reasons };
}

/** Map invoice lifecycle to forecast confidence. */
export function confidenceFromInvoiceLifecycle(
  invoice: InvoiceForecastInput
): { confidence: CommercialForecastConfidence; reasons: string[] } {
  const reasons: string[] = [];
  const state = invoice.lifecycleState;

  if (invoice.linkStatus === 'PAID' || state === CustomerInvoiceLifecycleState.PAID) {
    reasons.push('Invoice fully paid');
    return { confidence: CommercialForecastConfidence.Committed, reasons };
  }

  if (
    invoice.reconciliationStatus === CommercialReconciliationStatus.Matched ||
    invoice.reconciliationStatus === CommercialReconciliationStatus.Cleared
  ) {
    reasons.push('Payment commercially reconciled');
    return { confidence: CommercialForecastConfidence.Committed, reasons };
  }

  if (state === CustomerInvoiceLifecycleState.PARTIALLY_PAID) {
    reasons.push('Partial payment received');
    return { confidence: CommercialForecastConfidence.Likely, reasons };
  }

  if (
    state === CustomerInvoiceLifecycleState.OUTSTANDING ||
    state === CustomerInvoiceLifecycleState.EXPORTED
  ) {
    reasons.push('Invoice exported — awaiting customer payment');
    return { confidence: CommercialForecastConfidence.Expected, reasons };
  }

  if (state === CustomerInvoiceLifecycleState.ISSUED) {
    reasons.push('Invoice created — not yet exported');
    return { confidence: CommercialForecastConfidence.Tentative, reasons };
  }

  reasons.push('Invoice lifecycle state unknown');
  return { confidence: CommercialForecastConfidence.Tentative, reasons };
}

/** Map settlement readiness to forecast confidence. */
export function confidenceFromSettlement(
  settlement: SettlementForecastInput
): { confidence: CommercialForecastConfidence; reasons: string[] } {
  const reasons: string[] = [];

  if (settlement.settlementReady) {
    reasons.push('Settlement prerequisites met');
    return { confidence: CommercialForecastConfidence.Committed, reasons };
  }

  if (settlement.agreementApproved) {
    reasons.push('Agreement approved — settlement pending prerequisites');
    return { confidence: CommercialForecastConfidence.Likely, reasons };
  }

  reasons.push('Participant agreement not yet approved');
  return { confidence: CommercialForecastConfidence.Tentative, reasons };
}

/** Derive confidence for a generic input slice. */
export function deriveForecastConfidence(
  input: ConfidenceDerivationInput
): { confidence: CommercialForecastConfidence; reasons: string[] } {
  if (input.fundingSource) {
    return confidenceFromFundingSource(input.fundingSource);
  }
  if (input.invoice) {
    return confidenceFromInvoiceLifecycle(input.invoice);
  }
  if (input.settlement) {
    return confidenceFromSettlement(input.settlement);
  }

  const releaseLevel = input.releaseConfidence?.level;
  if (releaseLevel === 'HIGH') {
    return {
      confidence: CommercialForecastConfidence.Likely,
      reasons: ['High release confidence from settlement workflow'],
    };
  }
  if (releaseLevel === 'BLOCKED') {
    return {
      confidence: CommercialForecastConfidence.Tentative,
      reasons: ['Settlement blocked — confidence reduced'],
    };
  }

  return {
    confidence: CommercialForecastConfidence.Expected,
    reasons: ['Default confidence from commercial commitments'],
  };
}

/** Derive overall confidence from multiple signals. */
export function deriveOverallForecastConfidence(
  confidences: CommercialForecastConfidence[]
): { confidence: CommercialForecastConfidence; reasons: string[] } {
  if (confidences.length === 0) {
    return {
      confidence: CommercialForecastConfidence.Tentative,
      reasons: ['Insufficient commercial data for confidence'],
    };
  }

  const rank: Record<CommercialForecastConfidence, number> = {
    [CommercialForecastConfidence.Committed]: 4,
    [CommercialForecastConfidence.Likely]: 3,
    [CommercialForecastConfidence.Expected]: 2,
    [CommercialForecastConfidence.Tentative]: 1,
  };

  const minRank = Math.min(...confidences.map((c) => rank[c]));
  const overall = (Object.entries(rank) as [CommercialForecastConfidence, number][]).find(
    ([, r]) => r === minRank
  )?.[0] ?? CommercialForecastConfidence.Tentative;

  return {
    confidence: overall,
    reasons: [`Overall confidence limited by weakest signal (${overall})`],
  };
}
