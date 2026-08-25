'use client';

import '@/components/journey/lovable/lovable-journey.css';
import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Briefcase } from 'lucide-react';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { fetchPilotSnapshot } from '@/lib/deal-network-demo/pilot-store';
import { toCommercialWorkspaceListItem } from '@/lib/commercial-os/commercial-workspace-collection';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

export function CommercialWorkspaceDetailScreen({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = React.useState(true);
  const [deal, setDeal] = React.useState<RecentDeal | null>(null);
  const [participants, setParticipants] = React.useState<DemoParticipant[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const snapshot = await fetchPilotSnapshot();
      if (cancelled) return;
      const match = snapshot?.deals.find((row) => row.id === workspaceId && !row.archived) ?? null;
      setDeal(match);
      setParticipants(snapshot?.participants ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="animate-fade-up py-16 text-center text-[13px] text-ink-soft">
        Loading Commercial Workspace…
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="animate-fade-up space-y-6 pb-16" data-testid="commercial-workspace-not-found">
        <Link
          href={COMMERCIAL_OS_ROUTES.arrangements}
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Commercial Workspaces
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <h1 className="text-xl font-semibold">Commercial Workspace not found</h1>
          <p className="mt-2 max-w-xl text-[14px] text-ink-soft">
            This workspace is not available in your current session. Commercial Workspaces are
            currently listed for the signed-in operator who created them.
          </p>
        </div>
      </div>
    );
  }

  const item = toCommercialWorkspaceListItem(deal, participants);

  return (
    <div className="animate-fade-up space-y-8 pb-16" data-testid="commercial-workspace-detail">
      <Link
        href={COMMERCIAL_OS_ROUTES.arrangements}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Commercial Workspaces
      </Link>

      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-purple text-primary-foreground shadow-glow">
          <Briefcase className="h-6 w-6" />
        </div>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Operational workspace
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{item.name}</h1>
          <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">
            You are in the Commercial Workspace for this arrangement — not the Agreement
            Intelligence extraction. Participants, obligations, funding, and settlement stay on
            this operational graph.
          </p>
          {item.source === 'agreement_intelligence' ? (
            <Link
              href={COMMERCIAL_OS_ROUTES.workflowInstance('agreement-intelligence')}
              className="mt-3 inline-flex text-[13px] font-medium text-primary hover:underline"
              data-testid="source-agreement-intelligence"
            >
              View source in Agreement Intelligence
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Status</div>
          <div className="mt-2 text-[15px] font-semibold">{item.statusLabel}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Participants
          </div>
          <div className="mt-2 text-[15px] font-semibold">{item.participantCount}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Settlement
          </div>
          <div className="mt-2 text-[15px] font-semibold">{item.settlementLabel}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Source</div>
        <p className="mt-2 text-[14px] text-foreground">{item.sourceLabel}</p>
        <p className="mt-3 text-[13px] text-ink-soft">
          Funding, approvals, and payouts continue to use the existing operational graph for this
          workspace. The full operating surface will attach to this route in a later phase.
        </p>
      </div>
    </div>
  );
}
