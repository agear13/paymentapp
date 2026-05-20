import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  effectiveOnboardingStatus,
  isOnboardingComplete,
} from '@/lib/deal-network-demo/participant-onboarding';
import { getProjectDisplayName } from '@/lib/projects/get-project-display-name';
import { formatOperationalStage } from '@/lib/projects/format-operational-stage';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';

export type ProjectWorkspaceSummary = {
  id: string;
  name: string;
  description?: string;
  value: number;
  currencyLabel: string;
  operationalStage: string;
  operationalStageLabel: string;
  settlementStatus: string;
  paymentStatus: 'Not Paid' | 'Paid';
  participantCount: number;
  participantsReady: number;
  participantsPending: number;
  fundingLabel: string;
  fundingSubcopy: string;
  payoutLabel: string;
  needsAttention: boolean;
  treasury?: Pick<
    ProjectTreasurySummary,
    | 'totalExpectedInflows'
    | 'confirmedFunding'
    | 'pendingFunding'
    | 'forecastFunding'
    | 'obligationsReady'
    | 'obligationsAwaitingFunding'
    | 'operationalReadiness'
    | 'projectHealth'
    | 'fundingSourceCount'
    | 'hasFundingSources'
  >;
};

function formatValue(deal: RecentDeal): string {
  const amount = deal.value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (deal.projectValueCurrency === 'AUD') return `$${amount} AUD`;
  return `$${amount}`;
}

function participantsForDeal(deal: RecentDeal, participants: DemoParticipant[]): DemoParticipant[] {
  return participants.filter(
    (p) => p.dealId === deal.id || (p.dealId == null && p.dealName === deal.dealName)
  );
}

function legacyFundingLabel(deal: RecentDeal): { fundingLabel: string; fundingSubcopy: string } {
  if (deal.paymentStatus === 'Paid') {
    return {
      fundingLabel: 'Confirmed revenue on file',
      fundingSubcopy: 'Legacy settlement marker on file. Add funding sources for full treasury visibility.',
    };
  }
  if (deal.paymentLink) {
    return {
      fundingLabel: 'Pending revenue',
      fundingSubcopy: 'Invoice or payment link attached. Add it as a funding source for coordination.',
    };
  }
  return {
    fundingLabel: 'No funding sources connected yet',
    fundingSubcopy:
      'Add invoices, payment links, sponsorships, ticketing revenue, or manual forecasts.',
  };
}

export function summarizeProject(
  deal: RecentDeal,
  participants: DemoParticipant[],
  treasury?: ProjectTreasurySummary
): ProjectWorkspaceSummary {
  const dealParticipants = participantsForDeal(deal, participants);
  const participantsReady = dealParticipants.filter((p) =>
    isOnboardingComplete(effectiveOnboardingStatus(p))
  ).length;
  const participantCount = dealParticipants.length;
  const participantsPending = Math.max(0, participantCount - participantsReady);

  const legacy = legacyFundingLabel(deal);
  const fundingLabel = treasury?.fundingLabel ?? legacy.fundingLabel;
  const fundingSubcopy = treasury?.fundingSubcopy ?? legacy.fundingSubcopy;

  const settlementStatus = deal.status;
  const payoutLabel =
    deal.status === 'Paid'
      ? 'Settled'
      : deal.status === 'Approved'
        ? 'Ready to pay out'
        : deal.status;

  const treasuryAttention =
    treasury != null &&
    (treasury.operationalReadiness === 'blocked' ||
      treasury.operationalReadiness === 'awaiting_funding' ||
      treasury.projectHealth === 'settlement_risk');

  const needsAttention =
    treasuryAttention ||
    participantsPending > 0 ||
    deal.status === 'Pending' ||
    deal.status === 'In Review' ||
    (!treasury?.hasFundingSources && deal.paymentStatus !== 'Paid');

  return {
    id: deal.id,
    name: getProjectDisplayName({ dealName: deal.dealName }),
    description: deal.projectDescription,
    value: deal.value,
    currencyLabel: formatValue(deal),
    operationalStage: deal.currentStage ?? 'Introduced',
    operationalStageLabel: formatOperationalStage(deal.currentStage),
    settlementStatus,
    paymentStatus: deal.paymentStatus,
    participantCount,
    participantsReady,
    participantsPending,
    fundingLabel,
    fundingSubcopy,
    payoutLabel,
    needsAttention,
    treasury: treasury
      ? {
          totalExpectedInflows: treasury.totalExpectedInflows,
          confirmedFunding: treasury.confirmedFunding,
          pendingFunding: treasury.pendingFunding,
          forecastFunding: treasury.forecastFunding,
          obligationsReady: treasury.obligationsReady,
          obligationsAwaitingFunding: treasury.obligationsAwaitingFunding,
          operationalReadiness: treasury.operationalReadiness,
          projectHealth: treasury.projectHealth,
          fundingSourceCount: treasury.fundingSourceCount,
          hasFundingSources: treasury.hasFundingSources,
        }
      : undefined,
  };
}

export function sortProjectsForWorkspace(summaries: ProjectWorkspaceSummary[]): ProjectWorkspaceSummary[] {
  return [...summaries].sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
