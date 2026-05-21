import { formatCurrency } from '@/lib/formatters/format-currency';
import { buildReconciliationReport, areHederaRailsBalanced } from '@/lib/reports/reconciliation-report.server';
import { isRailBalanced, type ReconciliationReportData } from '@/lib/reports/reconciliation-types';
import { prisma } from '@/lib/server/prisma';

export type OperationalInsightSeverity = 'success' | 'warning' | 'error' | 'info';

export type OperationalInsight = {
  id: string;
  severity: OperationalInsightSeverity;
  message: string;
  metadata?: string;
};

export type OperationalInsightsSnapshot = {
  insights: OperationalInsight[];
  generatedAt: string;
};

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function buildStripeClearingDiscrepancyInsight(
  stripeDifference: number,
  currencyCode = 'AUD'
): OperationalInsight | null {
  if (isRailBalanced(stripeDifference)) {
    return null;
  }

  const amount = formatCurrency(Math.abs(stripeDifference), currencyCode);
  return {
    id: 'stripe-clearing-discrepancy',
    severity: 'error',
    message: `Stripe clearing balance differs from expected by ${amount}`,
    metadata: 'Reconciliation report',
  };
}

export function buildUnfundedObligationsInsight(unfundedCount: number): OperationalInsight | null {
  if (unfundedCount <= 0) {
    return null;
  }

  return {
    id: 'unfunded-obligations',
    severity: 'warning',
    message: `${unfundedCount} unfunded ${pluralize(unfundedCount, 'obligation requires', 'obligations require')} attention`,
    metadata: 'Deal network obligations',
  };
}

export function buildPayoutReadinessInsight(readyPayoutCount: number): OperationalInsight {
  return {
    id: 'payout-readiness',
    severity: 'info',
    message: `${readyPayoutCount} ${pluralize(readyPayoutCount, 'payout', 'payouts')} ready for release`,
    metadata: 'Settlement batches',
  };
}

export function buildHederaSettlementInsight(
  reconciliation: ReconciliationReportData
): OperationalInsight | null {
  if (!areHederaRailsBalanced(reconciliation.report)) {
    return null;
  }

  return {
    id: 'hedera-settlement-balanced',
    severity: 'success',
    message: 'Digital settlement rails balanced',
    metadata: 'Reconciliation report',
  };
}

export function getOperationalInsightsFromSnapshot(input: {
  reconciliation: ReconciliationReportData;
  unfundedObligationCount: number;
  readyPayoutCount: number;
  currencyCode?: string;
}): OperationalInsight[] {
  const insights: OperationalInsight[] = [];

  const stripeInsight = buildStripeClearingDiscrepancyInsight(
    input.reconciliation.report.stripe.difference,
    input.currencyCode
  );
  if (stripeInsight) insights.push(stripeInsight);

  const unfundedInsight = buildUnfundedObligationsInsight(input.unfundedObligationCount);
  if (unfundedInsight) insights.push(unfundedInsight);

  insights.push(buildPayoutReadinessInsight(input.readyPayoutCount));

  const hederaInsight = buildHederaSettlementInsight(input.reconciliation);
  if (hederaInsight) insights.push(hederaInsight);

  return insights;
}

/**
 * Aggregate operational states from reconciliation, obligations, and settlement data.
 */
export async function getOperationalInsights(
  organizationId: string
): Promise<OperationalInsightsSnapshot> {
  const [reconciliation, unfundedObligationCount, readyPayoutCount, merchantSettings] =
    await Promise.all([
      buildReconciliationReport(organizationId),
      prisma.deal_network_pilot_obligations.count({
        where: {
          organization_id: organizationId,
          status: 'UNFUNDED',
        },
      }),
      prisma.payouts.count({
        where: {
          organization_id: organizationId,
          status: 'DRAFT',
          payout_batches: {
            status: 'DRAFT',
          },
        },
      }),
      prisma.merchant_settings.findFirst({
        where: { organization_id: organizationId },
        select: { default_currency: true },
      }),
    ]);

  const currencyCode = merchantSettings?.default_currency ?? 'AUD';

  const insights = getOperationalInsightsFromSnapshot({
    reconciliation,
    unfundedObligationCount,
    readyPayoutCount,
    currencyCode,
  });

  return {
    insights,
    generatedAt: new Date().toISOString(),
  };
}
