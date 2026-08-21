import type {
  WorkflowNeedsAttentionItem,
  WorkflowOperationalParticipant,
} from '@/lib/workflows/agreement-intelligence/types';

export const REFERRAL_ATTENTION_KINDS = [
  'commission_review',
  'approval_required',
  'payout_details',
  'payout_flagged',
] as const;

export type ReferralAttentionKind = (typeof REFERRAL_ATTENTION_KINDS)[number];

/** Highest operational urgency first. */
export const REFERRAL_ATTENTION_PRIORITY: readonly ReferralAttentionKind[] = REFERRAL_ATTENTION_KINDS;

export const MAX_VISIBLE_ATTENTION_GROUPS = 3;

export type ReferralPromoterFilter =
  | 'all'
  | 'attention'
  | 'ready'
  | 'active'
  | ReferralAttentionKind;

export type ReferralAttentionGroup = {
  kind: ReferralAttentionKind;
  count: number;
  summary: string;
  items: WorkflowNeedsAttentionItem[];
};

const KIND_SET = new Set<string>(REFERRAL_ATTENTION_KINDS);

export function isReferralAttentionKind(value: string | undefined | null): value is ReferralAttentionKind {
  return Boolean(value && KIND_SET.has(value));
}

export function attentionKindOfItem(item: WorkflowNeedsAttentionItem): ReferralAttentionKind | null {
  return isReferralAttentionKind(item.kind) ? item.kind : null;
}

function summaryForKind(kind: ReferralAttentionKind, count: number): string {
  switch (kind) {
    case 'commission_review':
      return count === 1 ? '1 commission ready for review' : `${count} commissions ready for review`;
    case 'approval_required':
      return count === 1 ? '1 referral awaiting approval' : `${count} referrals awaiting approval`;
    case 'payout_details':
      return count === 1 ? '1 promoter needs payout details' : `${count} promoters need payout details`;
    case 'payout_flagged':
      return count === 1 ? '1 payout update required' : `${count} payout updates required`;
  }
}

export function buildReferralAttentionItems(
  promoters: Array<
    Pick<
      WorkflowOperationalParticipant,
      'id' | 'name' | 'manageUrl' | 'agreementStatus' | 'payoutSetupStatus'
    >
  >
): WorkflowNeedsAttentionItem[] {
  const items: WorkflowNeedsAttentionItem[] = [];
  for (const promoter of promoters) {
    if (promoter.payoutSetupStatus === 'submitted') {
      items.push({
        id: `review-${promoter.id}`,
        kind: 'commission_review',
        label: 'Commission ready for review',
        detail: `${promoter.name} submitted payout details`,
        participantId: promoter.id,
        href: promoter.manageUrl,
      });
    }
    if (promoter.agreementStatus !== 'approved') {
      items.push({
        id: `approval-${promoter.id}`,
        kind: 'approval_required',
        label: 'Referral awaiting approval',
        detail: promoter.name,
        participantId: promoter.id,
        href: promoter.manageUrl,
      });
    }
    if (promoter.payoutSetupStatus === 'required' || promoter.payoutSetupStatus === 'requested') {
      items.push({
        id: `payout-${promoter.id}`,
        kind: 'payout_details',
        label: 'Promoter needs payout details',
        detail: promoter.name,
        participantId: promoter.id,
        href: promoter.manageUrl,
      });
    }
    if (promoter.payoutSetupStatus === 'flagged') {
      items.push({
        id: `flagged-${promoter.id}`,
        kind: 'payout_flagged',
        label: 'Payout details need an update',
        detail: promoter.name,
        participantId: promoter.id,
        href: promoter.manageUrl,
      });
    }
  }
  return items.sort((a, b) => {
    const aRank = REFERRAL_ATTENTION_PRIORITY.indexOf(attentionKindOfItem(a) ?? 'payout_flagged');
    const bRank = REFERRAL_ATTENTION_PRIORITY.indexOf(attentionKindOfItem(b) ?? 'payout_flagged');
    return aRank - bRank;
  });
}

export function groupReferralAttention(
  items: WorkflowNeedsAttentionItem[]
): ReferralAttentionGroup[] {
  const byKind = new Map<ReferralAttentionKind, WorkflowNeedsAttentionItem[]>();
  for (const item of items) {
    const kind = attentionKindOfItem(item);
    if (!kind) continue;
    const list = byKind.get(kind) ?? [];
    list.push(item);
    byKind.set(kind, list);
  }

  return REFERRAL_ATTENTION_PRIORITY.flatMap((kind) => {
    const groupItems = byKind.get(kind);
    if (!groupItems?.length) return [];
    return [
      {
        kind,
        count: groupItems.length,
        summary: summaryForKind(kind, groupItems.length),
        items: groupItems,
      },
    ];
  });
}

export function promoterMatchesAttentionKind(
  promoter: Pick<WorkflowOperationalParticipant, 'agreementStatus' | 'payoutSetupStatus'>,
  kind: ReferralAttentionKind
): boolean {
  switch (kind) {
    case 'commission_review':
      return promoter.payoutSetupStatus === 'submitted';
    case 'approval_required':
      return promoter.agreementStatus !== 'approved';
    case 'payout_details':
      return promoter.payoutSetupStatus === 'required' || promoter.payoutSetupStatus === 'requested';
    case 'payout_flagged':
      return promoter.payoutSetupStatus === 'flagged';
  }
}

export function promoterMatchesFilter(
  promoter: WorkflowOperationalParticipant,
  filter: ReferralPromoterFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'attention') return promoter.needsAttention;
  if (filter === 'ready') return promoter.referralStatus === 'ready';
  if (filter === 'active') return promoter.referralStatus === 'active';
  return promoterMatchesAttentionKind(promoter, filter);
}

export function filterCountsForPromoters(promoters: WorkflowOperationalParticipant[]): Record<
  ReferralPromoterFilter,
  number
> {
  const filters: ReferralPromoterFilter[] = [
    'all',
    'attention',
    'commission_review',
    'approval_required',
    'payout_details',
    'payout_flagged',
    'ready',
    'active',
  ];
  return Object.fromEntries(
    filters.map((filter) => [filter, promoters.filter((row) => promoterMatchesFilter(row, filter)).length])
  ) as Record<ReferralPromoterFilter, number>;
}
