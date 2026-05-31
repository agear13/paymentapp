'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { RefreshCw, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { InviteProjectParticipantModal } from '@/components/projects/invite-project-participant-modal';
import { useOrganization } from '@/hooks/use-organization';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { useProjectWorkspaceSmartPolling } from '@/hooks/use-project-workspace-refresh';
import { ProjectSectionErrorBoundary } from '@/components/projects/project-section-error-boundary';
import { ProjectParticipantTableRow } from '@/components/projects/project-participant-table-row';
import { EditProjectParticipantDialog } from '@/components/projects/edit-project-participant-dialog';
import { ParticipantAgreementShareDialog } from '@/components/projects/participant-agreement-share-dialog';
import { ServiceCatalogGuidance } from '@/components/operations/service-catalog-guidance';
import { OperatorPayoutVerificationInfo } from '@/components/projects/operator-payout-verification-info';
import type { DemoParticipantRole } from '@/components/deal-network-demo/invite-participant-modal';
import { participantAgreementPath } from '@/lib/projects/participant-entitlement';
import {
  applyParticipantAgreementGenerated,
  applyParticipantAgreementShared,
} from '@/lib/operations/lifecycle/participant-lifecycle';
import { ProjectReadinessBreakdown } from '@/components/projects/project-readiness-breakdown';
import { ProjectOperationalLoadingState } from '@/components/projects/project-operational-loading-state';
import { ParticipantCompensationDialog } from '@/components/projects/participant-compensation-dialog';
import {
  PARTICIPANT_TABLE_COLUMNS,
  PARTICIPANT_TABLE_MIN_WIDTH,
  participantTableHeadClass,
} from '@/components/projects/participant-table-layout';
import {
  applyCompensationProfileToParticipant,
} from '@/lib/participants/participant-compensation';
import { isParticipantEarningsConfigured } from '@/lib/operations/selectors/participant-earnings-selectors';
import { deriveParticipantViewStats } from '@/lib/operations/selectors/derive-participant-view-stats';
import type { ParticipantCompensationProfile } from '@/lib/participants/participant-compensation-types';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import { appendOperationalAuditEntry } from '@/hooks/use-operational-audit-store';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { assertParticipantKpiConvergenceInvariants } from '@/lib/operations/dev/operational-invariants';
import { useOrganizationCurrency } from '@/hooks/use-organization-currency';
import { OperationalActivitySection } from '@/components/operations/operational-activity-section';
import {
  applyOperationalSyncRefresh,
  parseOperationalSync,
  toOperationalSyncHandlers,
  type OperationalSyncResponse,
} from '@/lib/operations/orchestration/operational-sync-client';
import { createPostConvergenceVerifier } from '@/lib/operations/dev/post-convergence-verifier';
import {
  logOperationalSyncConvergence,
  type OperationalSyncMutationKind,
} from '@/lib/operations/orchestration/operational-sync-convergence';
import { ProgressiveOperationalPanel } from '@/components/operations/progressive-operational-panel';
import { SafeParticipantBoundary } from '@/components/operations/safe-participant-boundary';
import { hydrateParticipants, participantEntity } from '@/lib/operations/hydration/hydrate-participant';
import {
  logCompensationConfigDiagnostic,
  prepareParticipantForCompensationEdit,
} from '@/lib/participants/initialize-compensation-draft';
import {
  logCompensationPersistenceTrace,
  traceCompensationConfiguredState,
  traceCompensationSavePayload,
} from '@/lib/participants/compensation-persistence-trace';
import { EMPTY_STATE_COPY } from '@/lib/operations/design-language';
import { opSurface } from '@/lib/design/operational-surfaces';
import { OperatorEmptyState } from '@/components/operations/operator-empty-state';
import { cn } from '@/lib/utils';
import { OperationalDiagnosticsPanel } from '@/components/operations/operational-diagnostics-panel';
import { CreateFromConversationButton } from '@/components/ai-extractor/create-from-conversation-button';
import { logEarningsSelectorAudit } from '@/lib/operations/dev/earnings-selector-audit';

const ONBOARDING_CHECKLIST = [
  'Add participants',
  'Configure compensation structures',
  'Send agreements',
  'Confirm payout details externally',
] as const;

export function ProjectParticipantsView() {
  const {
    deal,
    summary,
    projectId,
    projectParticipants,
    allDeals,
    allParticipants,
    saveSnapshot,
    patchParticipants,
    refresh,
    isRefreshing,
    loading,
    sectionErrors,
    refreshSilent,
    invalidate,
    clearSectionError,
  } = useProjectWorkspace();
  const {
    graph,
    kpis: canonicalKpis,
    guidance,
    reloadCoordinationSnapshot,
  } = useOperationalCoordinationState({
    scope: 'project',
    project: deal ?? undefined,
    participants: projectParticipants,
    enabled: Boolean(deal),
    traceSurface: 'project-participants-view',
  });
  const { currency: workspaceCurrency } = useOrganizationCurrency();
  const syncHandlers = React.useMemo(
    () =>
      toOperationalSyncHandlers({
        invalidate,
        refreshSilent: (scope) =>
          refresh({ scope: scope ?? 'all', silent: true, force: true }),
        reloadCoordinationSnapshot,
        notifyActivation: notifyWorkspaceActivationRefresh,
        onAudit: appendOperationalAuditEntry,
      }),
    [invalidate, refresh, reloadCoordinationSnapshot]
  );

  const buildConvergenceVerify = React.useCallback(
    (
      mutation: OperationalSyncMutationKind,
      surface: string,
      participants: DemoParticipant[],
      sync?: OperationalSyncResponse['operationalSync']
    ) => {
      const base = createPostConvergenceVerifier({
        mutation,
        projectId,
        surface,
        participants,
        sync: sync
          ? {
              payoutReadyCount: sync.payoutReadyCount,
              obligationCount: sync.obligationCount,
              releaseEligibleObligationCount: sync.releaseEligibleObligationCount,
            }
          : undefined,
      });
      if (mutation !== 'participant_earnings_save' || sync?.obligationCount == null) {
        return base;
      }
      const obligationVerify = createPostConvergenceVerifier({
        mutation: 'obligation_generation',
        projectId,
        surface,
        participants,
        sync: {
          payoutReadyCount: sync.payoutReadyCount,
          obligationCount: sync.obligationCount,
          releaseEligibleObligationCount: sync.releaseEligibleObligationCount,
        },
      });
      return async () => {
        await base();
        await obligationVerify();
      };
    },
    [projectId]
  );
  const { organizationId } = useOrganization();
  const searchParams = useSearchParams();
  const focusParticipantId = searchParams.get('participant');
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [editParticipant, setEditParticipant] = React.useState<DemoParticipant | null>(null);
  const [compensationParticipant, setCompensationParticipant] =
    React.useState<DemoParticipant | null>(null);
  const [agreementShareParticipant, setAgreementShareParticipant] =
    React.useState<DemoParticipant | null>(null);
  const [recentlySavedParticipantId, setRecentlySavedParticipantId] = React.useState<
    string | null
  >(null);
  const [pinnedOrder, setPinnedOrder] = React.useState<string[] | null>(null);
  const [catalogItems, setCatalogItems] = React.useState<Array<{ id: string; name: string }>>([]);
  const tableScrollRef = React.useRef<HTMLDivElement>(null);
  const savedScrollTop = React.useRef(0);
  const catalogContext = React.useMemo(
    () => ({ catalogItems, workspaceCurrency }),
    [catalogItems, workspaceCurrency]
  );

  useProjectWorkspaceSmartPolling({ enabled: Boolean(deal?.id), scope: 'participants' });

  React.useEffect(() => {
    if (!organizationId) {
      setCatalogItems([]);
      return;
    }
    let cancelled = false;
    void fetch(
      `/api/organization-services?organizationId=${encodeURIComponent(organizationId)}&status=active`
    )
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json: { data?: Array<{ id: string; name: string }> }) => {
        if (!cancelled) {
          setCatalogItems(
            Array.isArray(json.data)
              ? json.data.map((s) => ({ id: s.id, name: s.name }))
              : []
          );
        }
      })
      .catch(() => {
        if (!cancelled) setCatalogItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  React.useEffect(() => {
    if (!recentlySavedParticipantId) return;
    const timer = window.setTimeout(() => {
      setRecentlySavedParticipantId(null);
      setPinnedOrder(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [recentlySavedParticipantId]);

  const openCompensationConfig = React.useCallback(
    (participant: DemoParticipant) => {
      try {
        const prepared = prepareParticipantForCompensationEdit(participant);
        logCompensationConfigDiagnostic('open', {
          participantId: prepared.id,
          projectId,
          reason: 'participant-table-action',
        });
        setCompensationParticipant(prepared);
      } catch (err) {
        logCompensationConfigDiagnostic(
          'init-failure',
          { participantId: participant.id, projectId },
          err
        );
        toast.error('Unable to open compensation settings right now.', {
          action: {
            label: 'Retry',
            onClick: () => openCompensationConfig(participant),
          },
        });
      }
    },
    [projectId]
  );

  const handleRefresh = React.useCallback(() => {
    invalidate('participants');
    void refreshSilent('participants');
  }, [invalidate, refreshSilent]);

  const openAgreementShare = React.useCallback(
    async (p: DemoParticipant) => {
      const path = p.agreementUrl ?? participantAgreementPath(p.inviteToken);
      const url =
        typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;

      let updated = p;
      if (!p.agreementUrl) {
        updated = applyParticipantAgreementGenerated(p, path);
      }
      updated = applyParticipantAgreementShared(updated);

      const nextParticipants = allParticipants.map((x) => (x.id === p.id ? updated : x));
      void saveSnapshot(allDeals, nextParticipants);
      setAgreementShareParticipant(updated);
    },
    [allDeals, allParticipants, saveSnapshot]
  );

  const updatePayoutVerification = React.useCallback(
    async (participantId: string, confirmed: boolean) => {
      logOperationalSyncConvergence('mutation-start', {
        mutation: 'payout_verification',
        projectId,
        participantId,
        surface: 'project-participants-view',
      });
      try {
        const res = await fetch(`/api/deal-network-pilot/participants/${participantId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payoutVerificationConfirmed: confirmed }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || 'Update failed');
        }
        const json = (await res.json()) as { participant?: DemoParticipant };
        if (json.participant) {
          patchParticipants((list) =>
            list.map((p) => (p.id === participantId ? json.participant! : p))
          );
        }
        const sync = parseOperationalSync(json);
        const nextParticipants = json.participant
          ? allParticipants.map((p) => (p.id === participantId ? json.participant! : p))
          : allParticipants;
        await applyOperationalSyncRefresh(
          syncHandlers,
          sync,
          {
            mutation: 'payout_verification',
            projectId,
            participantId,
            surface: 'project-participants-view',
          },
          buildConvergenceVerify(
            'payout_verification',
            'project-participants-view',
            nextParticipants,
            sync
          )
        );
        toast.success(
          confirmed ? 'Payout details confirmed externally' : 'Payout confirmation cleared'
        );
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Update failed');
      }
    },
    [allParticipants, buildConvergenceVerify, patchParticipants, projectId, syncHandlers]
  );

  const updateParticipantDetails = React.useCallback(
    async (
      participantId: string,
      patch: {
        name: string;
        email: string;
        role: DemoParticipantRole;
        roleDetails?: string;
        agreementNotes?: string;
      }
    ) => {
      const prev = projectParticipants.find((p) => p.id === participantId);
      if (!prev) return;

      const optimistic: DemoParticipant = {
        ...prev,
        name: patch.name,
        email: patch.email,
        role: patch.role,
        roleDetails: patch.roleDetails,
        agreementNotes: patch.agreementNotes,
      };
      const nextParticipants = allParticipants.map((p) =>
        p.id === participantId ? optimistic : p
      );
      void saveSnapshot(allDeals, nextParticipants);

      try {
        const res = await fetch(`/api/deal-network-pilot/participants/${participantId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || 'Update failed');
        }
        const json = (await res.json()) as { participant?: DemoParticipant };
        if (json.participant) {
          patchParticipants((list) =>
            list.map((p) => (p.id === participantId ? json.participant! : p))
          );
        }
        await applyOperationalSyncRefresh(syncHandlers, parseOperationalSync(json), {
          mutation: 'snapshot_persist',
          projectId,
          participantId,
          surface: 'project-participants-view',
        });
        toast.success('Participant updated');
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Update failed');
      }
    },
    [patchParticipants, projectId, syncHandlers]
  );

  const handleInvite = React.useCallback(
    async (participant: DemoParticipant): Promise<DemoParticipant> => {
      const next = [...allParticipants, participant];
      const ok = await saveSnapshot(allDeals, next);
      if (!ok) throw new Error('persist failed');
      return participant;
    },
    [allDeals, allParticipants, saveSnapshot]
  );

  const saveCompensation = React.useCallback(
    async (participantId: string, profile: ParticipantCompensationProfile) => {
      const prev = projectParticipants.find((p) => p.id === participantId);
      if (!prev) return;

      const traceCtx = {
        participantId,
        projectId,
        surface: 'project-participants-view',
      };
      traceCompensationConfiguredState(prev, traceCtx, 'before-save');
      traceCompensationSavePayload(profile, traceCtx);

      if (tableScrollRef.current) {
        savedScrollTop.current = tableScrollRef.current.scrollTop;
      }

      logOperationalSyncConvergence('mutation-start', {
        mutation: 'participant_earnings_save',
        projectId,
        participantId,
        surface: 'project-participants-view',
      });

      try {
        const res = await fetch(`/api/deal-network-pilot/participants/${participantId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ compensationProfile: profile }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || 'Update failed');
        }
        const json = (await res.json()) as {
          participant?: DemoParticipant;
        };
        const persisted = json.participant;
        if (!persisted) {
          throw new Error('Server did not return persisted participant');
        }
        patchParticipants((list) =>
          list.map((p) => (p.id === participantId ? persisted : p))
        );
        traceCompensationConfiguredState(persisted, traceCtx, 'api-response');
        logCompensationPersistenceTrace('save-success', traceCtx, {
          persistedConfigured: persisted.compensationProfile?.configured ?? null,
          inferConfigured: isParticipantEarningsConfigured(persisted),
        });
        const sync = parseOperationalSync(json);
        const nextParticipants = allParticipants.map((p) =>
          p.id === participantId ? persisted : p
        );
        await applyOperationalSyncRefresh(
          syncHandlers,
          sync,
          {
            mutation: 'participant_earnings_save',
            projectId,
            participantId,
            surface: 'project-participants-view',
          },
          buildConvergenceVerify(
            'participant_earnings_save',
            'project-participants-view',
            nextParticipants,
            sync
          )
        );
        toast.success('Compensation structure saved', {
          description: 'Agreement terms updated successfully.',
        });
        setRecentlySavedParticipantId(participantId);
        setPinnedOrder(projectParticipants.map((p) => p.id));
        requestAnimationFrame(() => {
          if (tableScrollRef.current) {
            tableScrollRef.current.scrollTop = savedScrollTop.current;
          }
        });
      } catch (e: unknown) {
        logCompensationPersistenceTrace('save-failure', traceCtx, {
          error: e instanceof Error ? e.message : String(e),
        });
        toast.error(e instanceof Error ? e.message : 'Update failed');
        throw e;
      }
    },
    [allParticipants, buildConvergenceVerify, patchParticipants, projectId, projectParticipants, syncHandlers]
  );

  const hydratedParticipants = React.useMemo(
    () => hydrateParticipants(projectParticipants, catalogContext),
    [projectParticipants, catalogContext]
  );

  const displayParticipants = React.useMemo(() => {
    const entities = hydratedParticipants.map(participantEntity);
    if (!pinnedOrder) return entities;
    const order = new Map(pinnedOrder.map((id, i) => [id, i]));
    return [...entities].sort(
      (a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999)
    );
  }, [hydratedParticipants, pinnedOrder]);

  const stats = React.useMemo(
    () =>
      deriveParticipantViewStats({
        canonicalKpis,
        graphParticipants: graph.participants ?? [],
      }),
    [canonicalKpis, graph.participants]
  );

  React.useEffect(() => {
    if (!canonicalKpis || !recentlySavedParticipantId) return;
    const saved = projectParticipants.find((p) => p.id === recentlySavedParticipantId);
    if (saved) {
      traceCompensationConfiguredState(saved, {
        participantId: recentlySavedParticipantId,
        projectId,
        surface: 'project-participants-view',
      }, 'post-coordination-refresh');
      logCompensationPersistenceTrace('configured-transition', {
        participantId: recentlySavedParticipantId,
        projectId,
        surface: 'project-participants-view',
      }, {
        inferConfigured: isParticipantEarningsConfigured(saved),
        canonicalEarningsConfigured: canonicalKpis.earningsConfiguredCount,
        canonicalPayoutReady: canonicalKpis.payoutReadyCount,
        phase: 'coordination-hook-refresh',
      });
    }
  }, [canonicalKpis, recentlySavedParticipantId, projectParticipants, projectId]);

  React.useEffect(() => {
    if (!canonicalKpis) return;
    const rowsWithCompensation = hydratedParticipants.filter((p) =>
      isParticipantEarningsConfigured(participantEntity(p))
    ).length;
    if (hydratedParticipants[0]) {
      logEarningsSelectorAudit({
        surface: 'project-participants-view',
        participant: participantEntity(hydratedParticipants[0]),
        canonicalKpis,
      });
    }
    try {
      assertParticipantKpiConvergenceInvariants({
        participantRowsWithCompensation: rowsWithCompensation,
        workspaceEarningsConfiguredCount: canonicalKpis.earningsConfiguredCount,
        graphEarningsConfiguredCount: graph.summary?.earningsConfiguredCount,
        payoutReadyCount: canonicalKpis.payoutReadyCount,
        graphPayoutReadyCount: graph.summary?.payoutReadyCount,
      });
    } catch (invariantError) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[project-participants-view] KPI convergence check (non-fatal)', invariantError);
      }
    }
  }, [canonicalKpis, graph.summary, hydratedParticipants]);

  const attributionEnabled = React.useMemo(
    () => hydratedParticipants.some((p) => p.compensation.attributionEnabled),
    [hydratedParticipants]
  );

  React.useEffect(() => {
    if (!focusParticipantId) return;
    const el = document.getElementById(`participant-${focusParticipantId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusParticipantId, displayParticipants.length]);

  const participantEntities = React.useMemo(
    () => hydratedParticipants.map(participantEntity),
    [hydratedParticipants]
  );

  const needsEarningsConfiguration =
    (canonicalKpis?.participantCount ?? 0) > 0 &&
    (canonicalKpis?.earningsConfiguredCount ?? 0) < (canonicalKpis?.participantCount ?? 0);

  if (loading && !deal) {
    return <ProjectOperationalLoadingState variant="loading" />;
  }

  if (!deal || !summary) {
    return (
      <ProjectOperationalLoadingState
        variant="configuring"
        message={
          guidance.explanation.explainability.headline ??
          'This project is still being configured.'
        }
        onRetry={handleRefresh}
      />
    );
  }

  const hasParticipants = participantEntities.length > 0;
  const sectionError = sectionErrors.participants;

  const focusFirstEarnings = () => {
    const needsConfig = hydratedParticipants.find(
      (p) => !isParticipantEarningsConfigured(participantEntity(p))
    );
    if (needsConfig) openCompensationConfig(participantEntity(needsConfig));
    else if (participantEntities[0]) openCompensationConfig(participantEntities[0]);
  };

  return (
    <>
    <ProjectSectionErrorBoundary
      sectionTitle="Participant earnings"
      boundaryScope="default"
      onRetry={() => {
        clearSectionError('participants');
        handleRefresh();
      }}
      fallbackMessage={
        sectionError ??
        "We couldn't load this setup step yet. Your project information is still safe."
      }
    >
      <div className="space-y-6">
        {needsEarningsConfiguration && hasParticipants ? (
          <ProgressiveOperationalPanel
            title="Configure how each participant gets paid"
            summary={guidance.explanation.explainability.headline}
            missingItems={
              canonicalKpis
                ? [
                    `${canonicalKpis.participantCount - canonicalKpis.earningsConfiguredCount} earnings not configured`,
                  ]
                : undefined
            }
            detailLabel="Why does this matter?"
          >
            <p className="text-sm text-foreground/80">
              {guidance.explanation.explainability.bullets[0] ??
                'Configure earnings for each participant.'}{' '}
              This unlocks obligations and payout release when funding is ready.
            </p>
            {needsEarningsConfiguration ? (
              <button
                type="button"
                className="text-sm font-medium text-primary underline-offset-2 hover:underline mt-2"
                onClick={focusFirstEarnings}
              >
                Configure participant earnings
              </button>
            ) : null}
          </ProgressiveOperationalPanel>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
            {hasParticipants ? (
              <ProjectReadinessBreakdown
                participants={participantEntities}
                projectId={projectId}
                className="mt-2"
                graphParticipants={graph.participants}
                graphSummary={graph.summary}
              />
            ) : (
              <p className="text-muted-foreground mt-1 text-sm">
                Add participants, then configure how each earns before obligations or payout release.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            {deal && (
              <CreateFromConversationButton
                entryPoint="participant_add"
                existingDeal={deal}
                existingParticipants={projectParticipants}
                onComplete={() => void refresh({ scope: 'participants', silent: false, force: true })}
              />
            )}
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite participant
            </Button>
          </div>
        </div>

        {sectionError ? (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-4 text-sm text-muted-foreground">
              {sectionError}. Use refresh to retry.
            </CardContent>
          </Card>
        ) : null}

        {hasParticipants ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending agreements</CardDescription>
                <CardTitle className="text-2xl">{stats.pendingAgreements}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Missing confirmation</CardDescription>
                <CardTitle className="text-2xl">{stats.missingConfirmation}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Ready for payout</CardDescription>
                <CardTitle className="text-2xl">{stats.readyForPayout}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active attribution</CardDescription>
                <CardTitle className="text-2xl">{stats.activeAttribution}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        ) : null}

        {!hasParticipants ? (
          <div className="space-y-4">
            <OperatorEmptyState
              title={EMPTY_STATE_COPY.participantEarnings.title}
              body={EMPTY_STATE_COPY.participantEarnings.body}
            />
            <div className="flex flex-wrap justify-center gap-2 -mt-2">
              {deal && (
                <CreateFromConversationButton
                  entryPoint="participant_add"
                  existingDeal={deal}
                  existingParticipants={projectParticipants}
                  onComplete={() => void refresh({ scope: 'participants', silent: false, force: true })}
                  size="lg"
                />
              )}
              <Button variant="outline" size="lg" onClick={() => setInviteOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                {EMPTY_STATE_COPY.participantEarnings.cta}
              </Button>
            </div>
            <div className={opSurface('inset')}>
              <ol className="grid gap-2 sm:grid-cols-2 text-sm text-foreground/75">
                {ONBOARDING_CHECKLIST.map((step, index) => (
                  <li key={step} className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/80 text-xs font-medium text-foreground/80">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <>
            <ServiceCatalogGuidance
              organizationId={organizationId}
              attributionEnabled={attributionEnabled}
            />
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Project participants</CardTitle>
              <CardDescription>
                Agreement, attribution, payout confirmation, and earnings — one row per participant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-6 pt-0">
              <OperatorPayoutVerificationInfo />
              <div
                ref={tableScrollRef}
                className="max-h-[70vh] overflow-x-auto overflow-y-auto -mx-1 px-1"
              >
                <Table
                  className="table-fixed w-full"
                  style={{ minWidth: PARTICIPANT_TABLE_MIN_WIDTH }}
                >
                  <colgroup>
                    {PARTICIPANT_TABLE_COLUMNS.map((col) => (
                      <col
                        key={col.key}
                        style={{ width: col.width, minWidth: col.minWidth }}
                      />
                    ))}
                  </colgroup>
                  <TableHeader>
                    <TableRow className="align-top">
                      {PARTICIPANT_TABLE_COLUMNS.map((col, index) => (
                        <TableHead
                          key={col.key}
                          className={cn(
                            'align-top py-3 whitespace-nowrap',
                            participantTableHeadClass(index)
                          )}
                        >
                          {col.key === 'participant'
                            ? 'Participant'
                            : col.key === 'role'
                              ? 'Role'
                              : col.key === 'agreement'
                                ? 'Agreement'
                                : col.key === 'attribution'
                                  ? 'Attribution'
                                  : col.key === 'payout'
                                    ? 'Payout'
                                    : col.key === 'earnings'
                                      ? 'Earnings'
                                      : 'Actions'}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayParticipants.map((p) => (
                      <SafeParticipantBoundary
                        key={p.id}
                        participantId={p.id}
                        participantName={p.name}
                        onRetry={handleRefresh}
                      >
                        <ProjectParticipantTableRow
                          participant={p}
                          catalogContext={catalogContext}
                          highlighted={recentlySavedParticipantId === p.id}
                          onCopyAgreement={openAgreementShare}
                          onShareAgreement={openAgreementShare}
                          onPayoutVerificationChange={updatePayoutVerification}
                          onEdit={setEditParticipant}
                          onConfigureCompensation={openCompensationConfig}
                        />
                      </SafeParticipantBoundary>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          </>
        )}
      </div>
    </ProjectSectionErrorBoundary>

        <ParticipantCompensationDialog
          participant={compensationParticipant}
          projectId={projectId}
          organizationId={organizationId}
          workspaceCurrency={workspaceCurrency}
          open={Boolean(compensationParticipant)}
          onOpenChange={(open) => {
            if (!open) setCompensationParticipant(null);
          }}
          onSave={async (profile) => {
            if (!compensationParticipant) return;
            await saveCompensation(compensationParticipant.id, profile);
          }}
        />

        <ParticipantAgreementShareDialog
          participant={agreementShareParticipant}
          agreementUrl={
            agreementShareParticipant
              ? `${typeof window !== 'undefined' ? window.location.origin : ''}${
                  agreementShareParticipant.agreementUrl ??
                  participantAgreementPath(agreementShareParticipant.inviteToken)
                }`
              : null
          }
          open={Boolean(agreementShareParticipant)}
          onOpenChange={(open) => {
            if (!open) setAgreementShareParticipant(null);
          }}
        />

        <EditProjectParticipantDialog
          participant={editParticipant}
          open={Boolean(editParticipant)}
          onOpenChange={(open) => {
            if (!open) setEditParticipant(null);
          }}
          onSave={async (patch) => {
            if (!editParticipant) return;
            await updateParticipantDetails(editParticipant.id, patch);
          }}
        />

        <OperationalActivitySection projectId={projectId} participantId={focusParticipantId ?? undefined} />

        <InviteProjectParticipantModal
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          project={deal}
          organizationId={organizationId}
          onSubmit={handleInvite}
        />

        <OperationalDiagnosticsPanel
          projectId={projectId}
          participants={projectParticipants}
          invalidate={invalidate}
          refreshSilent={(scope) => refresh({ scope: scope ?? 'all', silent: true, force: true })}
          reloadCoordinationSnapshot={reloadCoordinationSnapshot}
        />
    </>
  );
}
