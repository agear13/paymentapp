import type { TreasuryEventStatus, TreasuryLinkType } from '@prisma/client';
import {
  findDepositToConversionCorrelation,
  findDeterministicCorrelation,
  type CorrelationMatchStrategy,
} from '@/lib/treasury/reconciliation/correlation';
import type { LinkEvidence } from '@/lib/treasury/reconciliation/types';

export type TreasuryEventSnapshot = {
  id: string;
  organization_id: string;
  event_type: string;
  status: TreasuryEventStatus;
  transaction_hash: string | null;
  provider_reference: string;
  payment_link_id: string | null;
  source_address: string | null;
  destination_address: string | null;
  amount: { toString(): string } | null;
  asset: string | null;
  metadata?: unknown;
};

export type TreasuryLinkSnapshot = {
  id: string;
  source_event_id: string;
  target_event_id: string;
  link_type: TreasuryLinkType;
  link_status: TreasuryEventStatus;
  evidence: unknown;
  created_by_user_id?: string | null;
};

/** Matching hierarchy rank — lower is stronger evidence. */
export const MATCH_STRATEGY_RANK: Record<string, number> = {
  provider_transaction_id: 1,
  transaction_hash: 2,
  provider_object_id: 3,
  provider_deposit_reference: 4,
  deposit_address_with_hash: 5,
  known_deposit_address_with_hash: 6,
  payment_link: 7,
  wallet_continuity: 8,
  manual: 9,
  none: 99,
};

export function rankMatchStrategy(strategy: string | null | undefined): number {
  if (!strategy) return MATCH_STRATEGY_RANK.none;
  return MATCH_STRATEGY_RANK[strategy] ?? 50;
}

export function evidenceFromLink(link: TreasuryLinkSnapshot): LinkEvidence {
  const evidence = link.evidence as Record<string, unknown> | null;
  const strategy =
    typeof evidence?.strategy === 'string'
      ? evidence.strategy
      : typeof evidence?.deterministic_strategy === 'string'
        ? evidence.deterministic_strategy
        : null;

  return {
    strategy,
    linkId: link.id,
    linkType: link.link_type,
    linkStatus: link.link_status,
    manual: link.link_type === 'MANUAL',
  };
}

export function findLinkBetween(
  links: TreasuryLinkSnapshot[],
  sourceId: string,
  targetId: string
): TreasuryLinkSnapshot | null {
  return (
    links.find((l) => l.source_event_id === sourceId && l.target_event_id === targetId) ?? null
  );
}

export function evaluatePairCorrelation(
  source: TreasuryEventSnapshot,
  target: TreasuryEventSnapshot,
  options?: { knownDepositAddresses?: Set<string> }
): { strategy: CorrelationMatchStrategy; status: TreasuryEventStatus } | null {
  if (
    source.event_type === 'EXCHANGE_DEPOSIT' &&
    target.event_type === 'CONVERSION'
  ) {
    const match = findDepositToConversionCorrelation(source, target);
    return match ? { strategy: match.strategy, status: match.status } : null;
  }

  const match = findDeterministicCorrelation(source, target, options);
  return match ? { strategy: match.strategy, status: match.status } : null;
}

export function countCorrelationCandidates(
  source: TreasuryEventSnapshot,
  targets: TreasuryEventSnapshot[],
  options?: { knownDepositAddresses?: Set<string> }
): TreasuryEventSnapshot[] {
  return targets.filter((target) => evaluatePairCorrelation(source, target, options) !== null);
}

export function linkStatusToNodeStatus(
  link: TreasuryLinkSnapshot | null,
  eventStatus: TreasuryEventStatus
): TreasuryEventStatus | 'NOT_APPLICABLE' {
  if (link?.link_type === 'MANUAL') return link.link_status;
  if (link) return link.link_status;
  return eventStatus;
}
