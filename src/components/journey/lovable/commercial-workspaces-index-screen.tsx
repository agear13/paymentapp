'use client';

import '@/components/journey/lovable/lovable-journey.css';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CreateDealModal } from '@/components/deal-network-demo/create-deal-modal';
import { GatedButton } from '@/components/entitlements/feature-gate';
import { StarterLimitAlert } from '@/components/entitlements/starter-limit-alert';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { fetchPilotSnapshot, persistPilotSnapshot } from '@/lib/deal-network-demo/pilot-store';
import {
  listCommercialWorkspaces,
  stampManualCommercialWorkspace,
  type CommercialWorkspaceListItem,
} from '@/lib/commercial-os/commercial-workspace-collection';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

function WorkspaceCard({ item }: { item: CommercialWorkspaceListItem }) {
  return (
    <Link
      href={item.href}
      className="block rounded-2xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/40 hover:bg-secondary/20"
      data-testid="commercial-workspace-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[16px] font-semibold text-foreground">{item.name}</h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            {item.participantCount === 1
              ? '1 participant'
              : `${item.participantCount} participants`}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-soft">
          {item.statusLabel}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-soft">
        <span>{item.settlementLabel}</span>
        <span>{item.sourceLabel}</span>
      </div>
    </Link>
  );
}

export function CommercialWorkspacesIndexScreen() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [deals, setDeals] = React.useState<RecentDeal[]>([]);
  const [participants, setParticipants] = React.useState<DemoParticipant[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await fetchPilotSnapshot();
      if (snapshot) {
        setDeals(snapshot.deals);
        setParticipants(snapshot.participants);
      } else {
        setDeals([]);
        setParticipants([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') !== '1') return;
    setCreateOpen(true);
    params.delete('create');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState(null, '', next);
  }, []);

  const items = React.useMemo(
    () => listCommercialWorkspaces(deals, participants),
    [deals, participants]
  );

  const handleCreate = React.useCallback(
    async (deal: RecentDeal) => {
      const latest = await fetchPilotSnapshot();
      if (!latest) {
        toast.error('Could not create the Commercial Workspace. Try again.');
        return false;
      }
      const nextDeal = stampManualCommercialWorkspace(deal);
      const nextDeals = [nextDeal, ...latest.deals.filter((existing) => existing.id !== nextDeal.id)];
      const ok = await persistPilotSnapshot(
        { deals: nextDeals, participants: latest.participants },
        'workspace_import_replace'
      );
      if (!ok) {
        toast.error('Could not create the Commercial Workspace. Try again.');
        return false;
      }
      toast.success('Commercial Workspace created');
      setCreateOpen(false);
      router.push(COMMERCIAL_OS_ROUTES.arrangement(nextDeal.id));
      return true;
    },
    [router]
  );

  return (
    <div className="animate-fade-up space-y-8 pb-16" data-testid="commercial-workspaces-index">
      <Link
        href={COMMERCIAL_OS_ROUTES.workspace}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Workspace
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-purple text-primary-foreground shadow-glow">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Commercial Workspaces</h1>
            <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">
              Operational workspaces for each commercial arrangement — including ones created
              manually, from Agreement Intelligence, or during onboarding.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <StarterLimitAlert feature="create_agreement" className="w-full sm:max-w-lg" />
          <GatedButton
            feature="create_agreement"
            type="button"
            onClick={() => setCreateOpen(true)}
            data-testid="create-commercial-workspace"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Commercial Workspace
          </GatedButton>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-[13px] text-ink-soft">
          Loading Commercial Workspaces…
        </div>
      ) : items.length === 0 ? (
        <div
          className="rounded-3xl border border-dashed border-border bg-card px-8 py-16 text-center shadow-card"
          data-testid="commercial-workspaces-empty-state"
        >
          <Briefcase className="mx-auto h-10 w-10 text-ink-soft" />
          <h2 className="mt-4 text-lg font-semibold">No Commercial Workspaces yet</h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-ink-soft">
            Create one to coordinate participants, obligations, and settlement, or approve an
            agreement in Agreement Intelligence.
          </p>
          <GatedButton
            feature="create_agreement"
            type="button"
            className="mt-6"
            onClick={() => setCreateOpen(true)}
            data-testid="create-first-commercial-workspace"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Commercial Workspace
          </GatedButton>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <WorkspaceCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <CreateDealModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
        experienceMode="project"
        copy="commercial_workspace"
      />
    </div>
  );
}
