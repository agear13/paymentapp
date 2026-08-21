'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { WorkflowNeedsAttentionItem } from '@/lib/workflows/agreement-intelligence/types';
import {
  MAX_VISIBLE_ATTENTION_GROUPS,
  groupReferralAttention,
  type ReferralAttentionKind,
  type ReferralAttentionGroup,
} from '@/lib/workflows/referral-management/attention';

const SHORT_KIND_LABEL: Record<ReferralAttentionKind, string> = {
  commission_review: 'Review',
  approval_required: 'Approval',
  payout_details: 'Payout',
  payout_flagged: 'Updates',
};

function GroupRow({
  group,
  onReview,
}: {
  group: ReferralAttentionGroup;
  onReview: (kind: ReferralAttentionKind) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onReview(group.kind)}
        className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left hover:bg-secondary/40"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="min-w-0 flex-1 text-[14px]">{group.summary}</span>
        <span className="text-[13px] font-medium text-primary">Review</span>
      </button>
    </li>
  );
}

export function ReferralAttentionSummary({
  items,
  onReviewKind,
  onSelectParticipant,
}: {
  items: WorkflowNeedsAttentionItem[];
  onReviewKind: (kind: ReferralAttentionKind) => void;
  onSelectParticipant: (participantId: string) => void;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerKind, setDrawerKind] = React.useState<ReferralAttentionKind | 'all'>('all');
  const groups = React.useMemo(() => groupReferralAttention(items), [items]);
  const visible = groups.slice(0, MAX_VISIBLE_ATTENTION_GROUPS);

  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-secondary/10 px-4 py-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <p className="text-[13px] font-semibold">Everything is up to date</p>
            <p className="text-[13px] text-ink-soft">
              No promoters or referrals currently require attention.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const drawerItems =
    drawerKind === 'all' ? items : items.filter((item) => item.kind === drawerKind);

  return (
    <section className="space-y-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">Needs attention</h2>
      <div className="rounded-xl border border-border bg-card px-3 py-1">
        <ul>
          {visible.map((group) => (
            <GroupRow key={group.kind} group={group} onReview={onReviewKind} />
          ))}
        </ul>
        <div className="border-t border-border px-1 py-2">
          <button
            type="button"
            onClick={() => {
              setDrawerKind('all');
              setDrawerOpen(true);
            }}
            className="text-[13px] font-medium text-primary"
          >
            View all attention items ({items.length})
          </button>
        </div>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Needs attention ({items.length})</SheetTitle>
            <SheetDescription>
              Every attention item for this workflow. Use Review or Manage to open that promoter.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-wrap gap-2 px-4">
            <Button
              type="button"
              size="sm"
              variant={drawerKind === 'all' ? 'default' : 'outline'}
              onClick={() => setDrawerKind('all')}
            >
              All
            </Button>
            {groups.map((group) => (
              <Button
                key={group.kind}
                type="button"
                size="sm"
                variant={drawerKind === group.kind ? 'default' : 'outline'}
                onClick={() => setDrawerKind(group.kind)}
              >
                {SHORT_KIND_LABEL[group.kind]} {group.count}
              </Button>
            ))}
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-6">
            {drawerItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    if (item.participantId) onSelectParticipant(item.participantId);
                  }}
                  className="flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left"
                >
                  <span>
                    <span className="block text-[14px] font-medium">{item.label}</span>
                    <span className="text-[13px] text-ink-soft">{item.detail}</span>
                  </span>
                  <span className="shrink-0 text-[13px] font-medium text-primary">
                    {item.kind === 'payout_details' || item.kind === 'payout_flagged'
                      ? 'Manage'
                      : 'Review'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </section>
  );
}
