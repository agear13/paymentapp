import type { ProjectFundingSourceStatus } from '@prisma/client';
import type {
  ObligationOperationalReadiness,
  ProjectFundingSourceDto,
  ProjectTreasuryHealth,
  ProjectTreasurySummary,
} from '@/lib/projects/funding-sources/types';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumByStatus(
  sources: ProjectFundingSourceDto[],
  statuses: ProjectFundingSourceStatus[]
): number {
  const set = new Set(statuses);
  return roundMoney(
    sources.filter((s) => set.has(s.status)).reduce((acc, s) => acc + s.amount, 0)
  );
}

export type TreasuryInputs = {
  fundingSources: ProjectFundingSourceDto[];
  obligationsTotal: number;
  /** Legacy rail-linked funding (payment events), counted toward confirmed settlement readiness. */
  legacyConfirmedFunding?: number;
  defaultCurrency?: string;
  /** Participants with project-scoped compensation (excludes attribution-only rows). */
  projectObligationEligibleParticipantCount?: number;
};

export function computeOperationalReadiness(
  confirmedFunding: number,
  pendingFunding: number,
  forecastFunding: number,
  obligationsTotal: number,
  projectObligationEligibleParticipantCount = 0
): ObligationOperationalReadiness {
  if (obligationsTotal <= 0) {
    if (projectObligationEligibleParticipantCount > 0) return 'obligations_pending';
    return 'ready';
  }
  if (confirmedFunding + 0.005 >= obligationsTotal) return 'ready';
  if (confirmedFunding > 0) return 'partially_funded';
  if (pendingFunding > 0) return 'awaiting_funding';
  if (forecastFunding > 0) return 'forecast_only';
  return 'blocked';
}

export function computeProjectTreasuryHealth(
  confirmedFunding: number,
  pendingFunding: number,
  forecastFunding: number,
  totalExpectedInflows: number,
  obligationsTotal: number,
  readiness: ObligationOperationalReadiness
): ProjectTreasuryHealth {
  if (readiness === 'ready' && obligationsTotal > 0) return 'ready_for_payout';
  if (readiness === 'obligations_pending') return 'settlement_risk';
  if (readiness === 'partially_funded') return 'partially_funded';
  if (readiness === 'forecast_only') return 'forecast_heavy';
  if (obligationsTotal > 0 && confirmedFunding + 0.005 < obligationsTotal && pendingFunding === 0) {
    return 'settlement_risk';
  }
  if (pendingFunding > confirmedFunding && totalExpectedInflows > 0) return 'funding_pending';
  if (
    totalExpectedInflows > 0 &&
    forecastFunding / totalExpectedInflows > 0.5 &&
    confirmedFunding < obligationsTotal
  ) {
    return 'forecast_heavy';
  }
  if (readiness === 'ready' || confirmedFunding > 0) return 'healthy';
  return 'funding_pending';
}

function fundingLabelFromTreasury(
  hasFundingSources: boolean,
  confirmedFunding: number,
  pendingFunding: number,
  forecastFunding: number
): { fundingLabel: string; fundingSubcopy: string } {
  if (!hasFundingSources) {
    return {
      fundingLabel: 'No funding sources connected yet',
      fundingSubcopy:
        'Add invoices, payment links, sponsorships, ticketing revenue, or manual forecasts.',
    };
  }
  if (confirmedFunding > 0 && pendingFunding === 0 && forecastFunding === 0) {
    return {
      fundingLabel: 'Confirmed revenue on file',
      fundingSubcopy: 'Settlement readiness reflects confirmed and cleared inflows.',
    };
  }
  if (confirmedFunding > 0) {
    return {
      fundingLabel: 'Mixed settlement readiness',
      fundingSubcopy: 'Track expected inflows and payout readiness across revenue sources.',
    };
  }
  if (pendingFunding > 0) {
    return {
      fundingLabel: 'Pending revenue',
      fundingSubcopy: 'Coordinate obligations before revenue fully settles.',
    };
  }
  return {
    fundingLabel: 'Projected receivables only',
    fundingSubcopy: 'Forecast sources inform payout readiness before reconciliation completes.',
  };
}

/** Rail-agnostic treasury rollup from funding sources + obligation allocation totals. */
export function buildProjectTreasurySummary(input: TreasuryInputs): ProjectTreasurySummary {
  const sources = input.fundingSources;
  const currency =
    sources[0]?.currency?.toUpperCase() ?? input.defaultCurrency?.toUpperCase() ?? 'USD';
  const legacy = roundMoney(input.legacyConfirmedFunding ?? 0);

  const forecastFunding = sumByStatus(sources, ['forecast']);
  const pendingFunding = sumByStatus(sources, ['pending']);
  const clearedFunding = sumByStatus(sources, ['cleared', 'reconciled']);
  const confirmedFromSources = sumByStatus(sources, ['confirmed', 'cleared', 'reconciled']);
  const confirmedFunding = roundMoney(confirmedFromSources + legacy);
  const totalExpectedInflows = roundMoney(
    sources.reduce((acc, s) => acc + s.amount, 0) + legacy
  );

  const obligationsTotal = roundMoney(input.obligationsTotal);
  const readiness = computeOperationalReadiness(
    confirmedFunding,
    pendingFunding,
    forecastFunding,
    obligationsTotal,
    input.projectObligationEligibleParticipantCount ?? 0
  );

  const obligationsReady =
    readiness === 'ready' ? obligationsTotal : readiness === 'partially_funded' ? confirmedFunding : 0;
  const obligationsAwaitingFunding = roundMoney(
    Math.max(0, obligationsTotal - obligationsReady)
  );

  const projectHealth = computeProjectTreasuryHealth(
    confirmedFunding,
    pendingFunding,
    forecastFunding,
    totalExpectedInflows,
    obligationsTotal,
    readiness
  );

  const hasFundingSources = sources.length > 0 || legacy > 0;
  const { fundingLabel, fundingSubcopy } = fundingLabelFromTreasury(
    hasFundingSources,
    confirmedFunding,
    pendingFunding,
    forecastFunding
  );

  return {
    currency,
    fundingSourceCount: sources.length,
    totalExpectedInflows,
    confirmedFunding,
    pendingFunding,
    forecastFunding,
    clearedFunding,
    obligationsTotal,
    obligationsReady: roundMoney(obligationsReady),
    obligationsAwaitingFunding,
    operationalReadiness: readiness,
    projectHealth,
    hasFundingSources,
    fundingLabel,
    fundingSubcopy,
  };
}
