/**
 * Risk analysis — reusable risk derivation for AI and reporting.
 */

import type {
  CommercialForecastingInput,
  CommercialForecastRisk,
} from '@/lib/commercial-forecasting/types';
import type { CommercialForecastResult } from '@/lib/commercial/commercial-forecast';
import { isFundingPending } from '@/lib/projects/funding-sources/funding-source-status';
import { CustomerInvoiceLifecycleState } from '@/lib/payment-links/customer-invoice-lifecycle';

/** Derive forecast risks from commercial workflow state. */
export function deriveRiskAnalysis(
  input: CommercialForecastingInput,
  dollarForecast?: CommercialForecastResult
): CommercialForecastRisk[] {
  const risks: CommercialForecastRisk[] = [];

  for (const source of input.fundingSources) {
    if (isFundingPending(source.status) && source.expectedSettlementDate) {
      const expected = new Date(source.expectedSettlementDate);
      const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
      if (expected < asOf) {
        risks.push({
          id: `late_payment:${source.id}`,
          category: 'late_customer_payment',
          title: 'Late customer payment',
          description: `${source.name} payment was expected by ${source.expectedSettlementDate}`,
          severity: 'high',
          relatedId: source.id,
        });
      }
    }
  }

  const unfundedObligations = input.obligationRows.filter(
    (r) => r.status !== 'FUNDED' && r.status !== 'SETTLED' && r.status !== 'PAID'
  );
  if (unfundedObligations.length > 0) {
    risks.push({
      id: 'outstanding_obligations',
      category: 'outstanding_obligations',
      title: 'Outstanding obligations',
      description: `${unfundedObligations.length} obligation(s) not yet funded`,
      severity: unfundedObligations.length > 3 ? 'high' : 'medium',
      relatedId: null,
    });
  }

  for (const settlement of input.settlementForecasts ?? []) {
    if (!settlement.settlementReady && settlement.expectedSettlementDate) {
      const expected = new Date(settlement.expectedSettlementDate);
      const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
      if (expected < asOf) {
        risks.push({
          id: `settlement_delay:${settlement.participantId}`,
          category: 'settlement_delay',
          title: 'Settlement delay',
          description: `Settlement to ${settlement.participantName} overdue`,
          severity: 'medium',
          relatedId: settlement.participantId,
        });
      }
    }
  }

  const pendingApprovals = input.settlementForecasts?.filter(
    (s) => !s.agreementApproved
  );
  if (pendingApprovals && pendingApprovals.length > 0) {
    risks.push({
      id: 'approval_bottleneck',
      category: 'approval_bottleneck',
      title: 'Approval bottlenecks',
      description: `${pendingApprovals.length} participant(s) awaiting agreement approval`,
      severity: 'medium',
      relatedId: null,
    });
  }

  if (input.fundingSources.length === 1 && input.fundingSources[0]) {
    const sole = input.fundingSources[0];
    risks.push({
      id: 'revenue_concentration',
      category: 'revenue_concentration',
      title: 'Revenue concentration',
      description: `All expected revenue from ${sole.name}`,
      severity: sole.amount > 50000 ? 'high' : 'medium',
      relatedId: sole.id,
    });
  }

  for (const invoice of input.invoiceForecasts ?? []) {
    if (
      invoice.lifecycleState === CustomerInvoiceLifecycleState.OUTSTANDING &&
      invoice.commercialTiming?.expectedPaymentDate
    ) {
      const expected = new Date(invoice.commercialTiming.expectedPaymentDate);
      const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
      if (expected < asOf) {
        risks.push({
          id: `late_invoice:${invoice.paymentLinkId}`,
          category: 'late_customer_payment',
          title: 'Overdue invoice payment',
          description: `Invoice payment expected by ${invoice.commercialTiming.expectedPaymentDate}`,
          severity: 'high',
          relatedId: invoice.paymentLinkId,
        });
      }
    }
  }

  if (dollarForecast) {
    for (const risk of dollarForecast.commercialRisks) {
      risks.push({
        id: `forecast:${risk.id}`,
        category: 'outstanding_obligations',
        title: risk.title,
        description: risk.explanation,
        severity: risk.severity,
        relatedId: null,
      });
    }
  }

  return risks;
}
