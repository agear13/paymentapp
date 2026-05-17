'use client';

import * as React from 'react';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { fetchPilotSnapshot, persistPilotSnapshot } from '@/lib/deal-network-demo/pilot-store';
import { persistPreferredDealIdToSession } from '@/lib/deal-network-demo/active-deal-resolution';
import { participantsForProject } from '@/lib/projects/participants-for-project';
import { summarizeProject } from '@/lib/projects/project-workspace-summary';

export type ProjectContextValue = {
  projectId: string;
  loading: boolean;
  notFound: boolean;
  deal: RecentDeal | null;
  summary: ReturnType<typeof summarizeProject> | null;
  projectParticipants: DemoParticipant[];
  allDeals: RecentDeal[];
  allParticipants: DemoParticipant[];
  reload: () => Promise<void>;
  saveSnapshot: (deals: RecentDeal[], participants: DemoParticipant[]) => Promise<boolean>;
};

export function useProjectContext(projectId: string): ProjectContextValue {
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [deal, setDeal] = React.useState<RecentDeal | null>(null);
  const [allDeals, setAllDeals] = React.useState<RecentDeal[]>([]);
  const [allParticipants, setAllParticipants] = React.useState<DemoParticipant[]>([]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await fetchPilotSnapshot();
      if (!snapshot) {
        setNotFound(true);
        setDeal(null);
        setAllDeals([]);
        setAllParticipants([]);
        return;
      }
      const found = snapshot.deals.find((d) => d.id === projectId) ?? null;
      if (!found) {
        setNotFound(true);
        setDeal(null);
        setAllDeals(snapshot.deals.filter((d) => !d.archived));
        setAllParticipants(snapshot.participants);
        return;
      }
      setNotFound(false);
      setDeal(found);
      setAllDeals(snapshot.deals.filter((d) => !d.archived));
      setAllParticipants(snapshot.participants);
      persistPreferredDealIdToSession(projectId);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const projectParticipants = React.useMemo(() => {
    if (!deal) return [];
    return participantsForProject(allParticipants, deal);
  }, [allParticipants, deal]);

  const summary = React.useMemo(() => {
    if (!deal) return null;
    return summarizeProject(deal, allParticipants);
  }, [deal, allParticipants]);

  const saveSnapshot = React.useCallback(
    async (deals: RecentDeal[], participants: DemoParticipant[]) => {
      const ok = await persistPilotSnapshot({ deals, participants });
      if (ok) {
        setAllDeals(deals.filter((d) => !d.archived));
        setAllParticipants(participants);
        const found = deals.find((d) => d.id === projectId) ?? null;
        setDeal(found);
        setNotFound(!found);
      }
      return ok;
    },
    [projectId]
  );

  return {
    projectId,
    loading,
    notFound,
    deal,
    summary,
    projectParticipants,
    allDeals,
    allParticipants,
    reload,
    saveSnapshot,
  };
}
