import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { CompletenessLine } from '@/lib/operations/types/operational-completeness';
import { deriveParticipantCapabilityFlags, normalizeParticipantEntity } from '@/lib/operations/guards/hydration-guards';
import { countParticipantsEarningsConfigured } from '@/lib/operations/selectors/participant-earnings-selectors';

export type { CompletenessLine };

export function deriveProjectCompletenessLines(
  project: RecentDeal | null | undefined,
  participants: DemoParticipant[],
  options?: {
    providerConnected?: boolean;
    revenueConfigured?: boolean;
    obligationCount?: number;
  }
): CompletenessLine[] {
  const normalized = participants.map(normalizeParticipantEntity);
  const configured = countParticipantsEarningsConfigured(normalized);
  const payoutDest = normalized.filter((p) =>
    deriveParticipantCapabilityFlags(p).hasPayoutDestination
  ).length;

  const c = {
    participantsAdded: normalized.length > 0,
    compensationConfigured: normalized.length > 0 && configured === normalized.length,
    revenueConfigured: options?.revenueConfigured ?? false,
    obligationsConfigured: (options?.obligationCount ?? 0) > 0,
    payoutDestinationsConfigured:
      normalized.length > 0 && payoutDest === normalized.length,
    providerConnected: options?.providerConnected ?? false,
  };

  return [
    { id: 'participants', label: 'Participants added', complete: c.participantsAdded },
    {
      id: 'compensation',
      label: 'Earnings configured',
      complete: c.compensationConfigured,
      warning: c.participantsAdded && !c.compensationConfigured,
    },
    {
      id: 'provider',
      label: 'Payment provider connected',
      complete: c.providerConnected,
      warning: c.compensationConfigured && !c.providerConnected,
    },
    {
      id: 'revenue',
      label: 'Revenue sources added',
      complete: c.revenueConfigured,
      warning: c.providerConnected && !c.revenueConfigured,
    },
    {
      id: 'obligations',
      label: 'Obligations recorded',
      complete: c.obligationsConfigured,
      warning: c.revenueConfigured && !c.obligationsConfigured,
    },
    {
      id: 'payout_destinations',
      label: 'Payout destinations configured',
      complete: c.payoutDestinationsConfigured,
      warning: c.participantsAdded && !c.payoutDestinationsConfigured,
    },
  ];
}
