'use client';

import * as React from 'react';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { persistPreferredDealIdToSession } from '@/lib/deal-network-demo/active-deal-resolution';
import { participantsForProject } from '@/lib/projects/participants-for-project';
import type { ProjectWorkspaceSummary } from '@/lib/projects/project-workspace-summary';
import {
  ProjectWorkspaceRefreshController,
  type WorkspaceRefreshOptions,
  type WorkspaceRefreshScope,
} from '@/lib/projects/workspace-refresh-controller';
import {
  fetchWorkspaceFullSnapshot,
  persistWorkspaceFullSnapshot,
} from '@/lib/projects/workspace-fetch';
import { invalidateWorkspaceCache } from '@/lib/projects/workspace-query-cache';
import { devRecordWorkspaceMount, devRecordWorkspaceRender } from '@/lib/projects/workspace-dev-diagnostics';
import { setProjectDisplayNameRegistry } from '@/lib/projects/project-display-name-registry';

export type { WorkspaceRefreshOptions, WorkspaceRefreshScope };

export type ProjectSectionKey = 'participants' | 'funding' | 'obligations' | 'payouts' | 'activity';

export type ProjectContextValue = {
  projectId: string;
  loading: boolean;
  isRefreshing: boolean;
  lastRefreshAt: Date | null;
  notFound: boolean;
  deal: RecentDeal | null;
  summary: ProjectWorkspaceSummary | null;
  projectParticipants: DemoParticipant[];
  allDeals: RecentDeal[];
  allParticipants: DemoParticipant[];
  sectionErrors: Partial<Record<ProjectSectionKey, string>>;
  refresh: (options?: WorkspaceRefreshOptions) => Promise<void>;
  refreshSilent: (scope?: WorkspaceRefreshScope) => Promise<void>;
  invalidate: (scope?: WorkspaceRefreshScope | 'all') => void;
  clearSectionError: (section: ProjectSectionKey) => void;
  saveSnapshot: (deals: RecentDeal[], participants: DemoParticipant[]) => Promise<boolean>;
};

export function useProjectContext(projectId: string): ProjectContextValue {
  const [loading, setLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [lastRefreshAt, setLastRefreshAt] = React.useState<Date | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [deal, setDeal] = React.useState<RecentDeal | null>(null);
  const [summary, setSummary] = React.useState<ProjectWorkspaceSummary | null>(null);
  const [allDeals, setAllDeals] = React.useState<RecentDeal[]>([]);
  const [allParticipants, setAllParticipants] = React.useState<DemoParticipant[]>([]);
  const [sectionErrors, setSectionErrors] = React.useState<
    Partial<Record<ProjectSectionKey, string>>
  >({});

  const controllerRef = React.useRef<ProjectWorkspaceRefreshController | null>(null);

  const listeners = React.useMemo(
    () => ({
      onSummary: (
        data: {
          deal: RecentDeal;
          summary: ProjectWorkspaceSummary;
          deals?: RecentDeal[];
        } | null,
        nf: boolean
      ) => {
        if (nf) {
          setNotFound(true);
          setDeal(null);
          setSummary(null);
          return;
        }
        if (!data) return;
        setNotFound(false);
        setDeal(data.deal);
        setSummary(data.summary);
        setProjectDisplayNameRegistry(projectId, {
          dealName: data.deal.dealName,
          name: data.summary.name,
        });
        if (data.deals?.length) setAllDeals(data.deals);
        persistPreferredDealIdToSession(projectId);
        setSectionErrors((prev) => {
          const next = { ...prev };
          delete next.obligations;
          return next;
        });
      },
      onParticipants: (
        data: { participants: DemoParticipant[]; projectParticipants: DemoParticipant[] } | null,
        nf: boolean
      ) => {
        if (nf) return;
        if (!data) return;
        setAllParticipants(data.participants);
        setSectionErrors((prev) => {
          const next = { ...prev };
          delete next.participants;
          return next;
        });
      },
      onRefreshingChange: setIsRefreshing,
      onLoadingChange: setLoading,
      onLastRefresh: setLastRefreshAt,
      onError: (scope: 'summary' | 'participants', error: Error) => {
        const section: ProjectSectionKey =
          scope === 'participants' ? 'participants' : 'obligations';
        setSectionErrors((prev) => ({ ...prev, [section]: error.message }));
      },
    }),
    [projectId]
  );

  React.useEffect(() => {
    devRecordWorkspaceMount(projectId);
    const controller = new ProjectWorkspaceRefreshController(projectId, listeners);
    controllerRef.current = controller;
    void controller.refresh({ scope: 'all', silent: false, force: true });

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  devRecordWorkspaceRender(projectId);

  const refresh = React.useCallback(
    (options?: WorkspaceRefreshOptions) =>
      controllerRef.current?.refresh(options) ?? Promise.resolve(),
    []
  );

  const refreshSilent = React.useCallback(
    (scope: WorkspaceRefreshScope = 'participants') =>
      controllerRef.current?.refreshSilent(scope) ?? Promise.resolve(),
    []
  );

  const invalidate = React.useCallback((scope?: WorkspaceRefreshScope | 'all') => {
    invalidateWorkspaceCache(projectId, scope ?? 'all');
    controllerRef.current?.invalidate(scope);
  }, [projectId]);

  const clearSectionError = React.useCallback((section: ProjectSectionKey) => {
    setSectionErrors((prev) => {
      if (!prev[section]) return prev;
      const next = { ...prev };
      delete next[section];
      return next;
    });
  }, []);

  const projectParticipants = React.useMemo(() => {
    if (!deal) return [];
    return participantsForProject(allParticipants, deal);
  }, [allParticipants, deal]);

  const saveSnapshot = React.useCallback(
    async (deals: RecentDeal[], participants: DemoParticipant[]) => {
      const ok = await persistWorkspaceFullSnapshot({ deals, participants });
      if (ok) {
        invalidate('all');
        await controllerRef.current?.refresh({ scope: 'all', silent: true, force: true });
      }
      return ok;
    },
    [invalidate]
  );

  return React.useMemo(
    () => ({
      projectId,
      loading,
      isRefreshing,
      lastRefreshAt,
      notFound,
      deal,
      summary,
      projectParticipants,
      allDeals,
      allParticipants,
      sectionErrors,
      refresh,
      refreshSilent,
      invalidate,
      clearSectionError,
      saveSnapshot,
    }),
    [
      projectId,
      loading,
      isRefreshing,
      lastRefreshAt,
      notFound,
      deal,
      summary,
      projectParticipants,
      allDeals,
      allParticipants,
      sectionErrors,
      refresh,
      refreshSilent,
      invalidate,
      clearSectionError,
      saveSnapshot,
    ]
  );
}
