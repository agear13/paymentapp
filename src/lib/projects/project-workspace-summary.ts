import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  effectiveOnboardingStatus,
  isOnboardingComplete,
} from '@/lib/deal-network-demo/participant-onboarding';
import { getProjectDisplayName } from '@/lib/projects/get-project-display-name';
import { formatOperationalStage } from '@/lib/projects/format-operational-stage';

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
  payoutLabel: string;
  needsAttention: boolean;
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

export function summarizeProject(
  deal: RecentDeal,
  participants: DemoParticipant[]
): ProjectWorkspaceSummary {
  const dealParticipants = participantsForDeal(deal, participants);
  const participantsReady = dealParticipants.filter((p) =>
    isOnboardingComplete(effectiveOnboardingStatus(p))
  ).length;
  const participantCount = dealParticipants.length;
  const participantsPending = Math.max(0, participantCount - participantsReady);

  const fundingLabel =
    deal.paymentStatus === 'Paid'
      ? 'Funded'
      : deal.paymentLink
        ? 'Awaiting payment'
        : 'No funding linked';

  const settlementStatus = deal.status;
  const payoutLabel =
    deal.status === 'Paid'
      ? 'Settled'
      : deal.status === 'Approved'
        ? 'Ready to pay out'
        : deal.status;

  const needsAttention =
    deal.paymentStatus !== 'Paid' ||
    participantsPending > 0 ||
    deal.status === 'Pending' ||
    deal.status === 'In Review';

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
    payoutLabel,
    needsAttention,
  };
}

export function sortProjectsForWorkspace(summaries: ProjectWorkspaceSummary[]): ProjectWorkspaceSummary[] {
  return [...summaries].sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
