'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ClipboardList, RefreshCw, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ApprovalCentreHeader } from '@/components/projects/approval-centre-header';
import { ApprovalCentreParticipantCard } from '@/components/projects/approval-centre-participant-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { InviteProjectParticipantModal } from '@/components/projects/invite-project-participant-modal';
import { useOrganization } from '@/hooks/use-organization';
import { useEntitlements } from '@/hooks/use-entitlements';
import { PlanUpgradeDialog } from '@/components/entitlements/plan-upgrade-dialog';
import { FEATURE_DISPLAY_NAMES, upgradeBody, upgradeHeadline } from '@/lib/entitlements/feature-labels';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { useProjectWorkspaceSmartPolling } from '@/hooks/use-project-workspace-refresh';
import { ProjectSectionErrorBoundary } from '@/components/projects/project-section-error-boundary';
import { ProjectParticipantTableRow } from '@/components/projects/project-participant-table-row';
import { EditProjectParticipantDialog } from '@/components/projects/edit-project-participant-dialog';
import { ParticipantAgreementShareDialog } from '@/components/projects/participant-agreement-share-dialog';
import { ParticipantPaymentRequestShareDialog } from '@/components/commercial/payment-tax/participant-payment-request-share-dialog';
import { projectPaymentRequestsPath } from '@/lib/projects/project-routes';
import {
  buildParticipantPaymentPortalUrl,
  deriveParticipantOperationalWorkflow,
} from '@/lib/commercial/participant-commercial-lifecycle';
import { ServiceCatalogGuidance } from '@/components/operations/service-catalog-guidance';
import { OperatorPayoutVerificationInfo } from '@/components/projects/operator-payout-verification-info';
import type { DemoParticipantRole } from '@/components/deal-network-demo/invite-participant-modal';
import { participantAgreementPath } from '@/lib/projects/participant-entitlement';
import { persistParticipantAgreementShare } from '@/lib/projects/participant-agreement-share';
import { projectCommercialRolesPath } from '@/lib/projects/project-routes';
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
import { useCommercialBrain } from '@/components/workflow/commercial-brain-context';
import { resolveAgreementDestination } from '@/components/workflow/workflow-navigation';
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
// Lazy-loaded to prevent the entire AI extraction engine from being bundled
// into the participants / Approval Centre route chunk. The extraction engine
// contains internal circular dependencies that cause TDZ errors on first
// navigation if the bundle is evaluated eagerly. Loading it only when the
// operator explicitly clicks "Add from conversation" eliminates this.
const CreateFromConversationButton = React.lazy(
  () =>
    import('@/components/ai-extractor/create-from-conversation-button').then((m) => ({
      default: m.CreateFromConversationButton,
    }))
);
import { logEarningsSelectorAudit } from '@/lib/operations/dev/earnings-selector-audit';
import { ProjectPageCopilot } from '@/components/operations/project-page-copilot';
import { ParticipantOnboardingStatusCard } from '@/components/commercial/supplier-onboarding/participant-onboarding-status-card';
import { AlertCircle } from 'lucide-react';
import {
  reconcileSupplierInvoiceToObligations,
  type AccountingReconciliationResult,
} from '@/lib/commercial/accounting-reconciliation';

const ONBOARDING_CHECKLIST = [
  'Plan allocations (roles and budgets)',
  'Add team members',
  'Configure earnings',
  'Request approvals',
  'Complete payment setup',
] as const;

export function ProjectParticipantsView() {
  const {
    deal,
    summary,
    projectId,
    projectParticipants,
    allParticipants,
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
    workspaceContext,
    activation,
    releaseInteraction,
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
  const { isAllowed, getDecision, entitlements, plan } = useEntitlements();
  const [approvalUpgradeOpen, setApprovalUpgradeOpen] = React.useState(false);
  const searchParams = useSearchParams();
  const focusParticipantId = searchParams?.get('participant') ?? null;
  /** When true, auto-scroll to the first participant needing action. Set via ?focus=approvals. */
  const focusApprovals = searchParams?.get('focus') === 'approvals';
  /** When true, show the Supplier Onboarding panel. Set via ?focus=onboarding. */
  const focusOnboarding = searchParams?.get('focus') === 'onboarding';
  const focusPaymentRequests = searchParams?.get('focus') === 'payment-requests';
  /** When set, auto-open the operator review panel for this participant. Set via ?review=<id>. */
  const reviewParticipantId = searchParams?.get('review') ?? null;
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [editParticipant, setEditParticipant] = React.useState<DemoParticipant | null>(null);
  const [compensationParticipant, setCompensationParticipant] =
    React.useState<DemoParticipant | null>(null);
  const [agreementShareParticipant, setAgreementShareParticipant] =
    React.useState<DemoParticipant | null>(null);
  const [paymentRequestShareParticipant, setPaymentRequestShareParticipant] =
    React.useState<DemoParticipant | null>(null);
  const [paymentRequestPortalUrl, setPaymentRequestPortalUrl] = React.useState<string | null>(null);
  const [paymentRequestEmailSending, setPaymentRequestEmailSending] = React.useState(false);
  const [paymentRequestGenerating, setPaymentRequestGenerating] = React.useState(false);
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

  const releaseReadyByParticipantId = React.useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of graph?.participants ?? []) {
      map.set(
        row.participant.id,
        row.readinessHierarchy.releaseReady === true
      );
    }
    return map;
  }, [graph?.participants]);

  const canCreateParticipantRelease =
    releaseInteraction.canCreateReleaseBatch &&
    releaseInteraction.releaseInteractionEnabled;
  const releaseDisabledReason =
    releaseInteraction.disabledReason ??
    releaseInteraction.interactionGuidance ??
    null;

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
    async (p: DemoParticipant, options?: { showDialog?: boolean }) => {
      if (!isAllowed('approval_workflows')) {
        setApprovalUpgradeOpen(true);
        return;
      }
      const path = p.agreementUrl ?? participantAgreementPath(p.inviteToken);
      const now = new Date().toISOString();

      const optimistic: DemoParticipant = {
        ...p,
        agreementUrl: p.agreementUrl ?? path,
        agreementSharedAt: now,
        inviteSentAt: now,
        agreementLifecycle: 'SHARED',
        participantLifecycle: 'INVITE_SENT',
      };
      patchParticipants((list) => list.map((x) => (x.id === p.id ? optimistic : x)));
      const persisted = await persistParticipantAgreementShare(p);
      patchParticipants((list) => list.map((x) => (x.id === p.id ? persisted : x)));
      if (options?.showDialog !== false) {
        setAgreementShareParticipant(persisted);
      }
    },
    [isAllowed, patchParticipants]
  );

  const openPaymentRequestShare = React.useCallback(
    (p: DemoParticipant, portalUrl: string) => {
      setPaymentRequestShareParticipant(p);
      setPaymentRequestPortalUrl(portalUrl);
    },
    []
  );

  const generatePaymentRequest = React.useCallback(
    async (p: DemoParticipant, options?: { sendEmail?: boolean }) => {
      if (!isAllowed('approval_workflows')) {
        setApprovalUpgradeOpen(true);
        return;
      }
      setPaymentRequestGenerating(true);
      try {
        const res = await fetch(
          `/api/deal-network-pilot/participants/${p.id}/payment-request/generate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sendEmail: options?.sendEmail ?? false }),
          }
        );
        const json = (await res.json()) as {
          error?: string;
          participant?: DemoParticipant;
          portalUrl?: string;
          emailSent?: boolean;
          message?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? 'Failed to generate payment request');
        }
        if (json.participant) {
          patchParticipants((list) =>
            list.map((x) => (x.id === p.id ? json.participant! : x))
          );
        }
        await applyOperationalSyncRefresh(syncHandlers, parseOperationalSync(json), {
          mutation: 'supplier_onboarding',
          projectId,
          participantId: p.id,
          surface: 'project-participants-view',
        });
        const portalUrl =
          json.portalUrl ??
          (json.participant
            ? buildParticipantPaymentPortalUrl(json.participant)
            : null);
        if (portalUrl && json.participant) {
          openPaymentRequestShare(json.participant, portalUrl);
        }
        if (json.emailSent) {
          toast.success(json.message ?? 'Payment request emailed');
        } else if (!options?.sendEmail) {
          toast.success(json.message ?? 'Payment request ready to share');
        }
        return json;
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to generate payment request');
        return null;
      } finally {
        setPaymentRequestGenerating(false);
      }
    },
    [isAllowed, patchParticipants, projectId, syncHandlers, openPaymentRequestShare]
  );

  const handleSendPaymentRequest = React.useCallback(
    (p: DemoParticipant) => {
      void generatePaymentRequest(p);
    },
    [generatePaymentRequest]
  );

  const handleSharePaymentRequest = React.useCallback(
    (p: DemoParticipant) => {
      const existingUrl = buildParticipantPaymentPortalUrl(p);
      if (existingUrl) {
        openPaymentRequestShare(p, existingUrl);
      } else {
        void generatePaymentRequest(p);
      }
    },
    [generatePaymentRequest, openPaymentRequestShare]
  );

  const handleSendPaymentRequestEmail = React.useCallback(async () => {
    if (!paymentRequestShareParticipant) return;
    setPaymentRequestEmailSending(true);
    try {
      await generatePaymentRequest(paymentRequestShareParticipant, { sendEmail: true });
    } finally {
      setPaymentRequestEmailSending(false);
    }
  }, [paymentRequestShareParticipant, generatePaymentRequest]);

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
      patchParticipants((list) => list.map((p) => (p.id === participantId ? optimistic : p)));

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
    [patchParticipants, projectId, projectParticipants, syncHandlers]
  );

  const handleInvite = React.useCallback(
    async (participant: DemoParticipant): Promise<DemoParticipant> => {
      patchParticipants((list) => [...list, participant]);
      const res = await fetch('/api/deal-network-pilot/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant }),
      });
      if (!res.ok) {
        patchParticipants((list) => list.filter((p) => p.id !== participant.id));
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'persist failed');
      }
      const json = (await res.json()) as { participant?: DemoParticipant };
      if (json.participant) {
        patchParticipants((list) => list.map((p) => (p.id === participant.id ? json.participant! : p)));
      }
      return json.participant ?? participant;
    },
    [patchParticipants]
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
        const optimistic = applyCompensationProfileToParticipant(prev, profile);
        patchParticipants((list) =>
          list.map((p) => (p.id === participantId ? optimistic : p))
        );

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
        patchParticipants((list) =>
          list.map((p) => (p.id === participantId ? prev : p))
        );
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

  const accountingReconciliationByParticipantId = React.useMemo(() => {
    const map = new Map<string, AccountingReconciliationResult>();
    const obligationsByParticipant = new Map<
      string,
      Array<{ id: string; amount: number; currency: string }>
    >();

    for (const obligation of graph?.obligations ?? []) {
      if (!obligation.participantId) continue;
      const lines = obligationsByParticipant.get(obligation.participantId) ?? [];
      lines.push({
        id: obligation.id,
        amount: obligation.amount,
        currency: obligation.currency,
      });
      obligationsByParticipant.set(obligation.participantId, lines);
    }

    for (const participant of displayParticipants) {
      const invoice = participant.paymentSetup?.draftInvoice;
      if (!invoice) continue;

      const obligationLines = obligationsByParticipant.get(participant.id) ?? [];
      map.set(
        participant.id,
        reconcileSupplierInvoiceToObligations({
          invoice,
          obligationLines: obligationLines.map((line) => ({
            id: line.id,
            amount: line.amount,
            currency: line.currency,
            invoiceBacked: true,
          })),
        })
      );
    }

    return map;
  }, [displayParticipants, graph?.obligations]);

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

  const { workflowCtx, commercialCapabilities } = useCommercialBrain();

  // Derived from CommercialBrain — single source of truth for earnings completion.
  // earningsConfigured = ALL participants configured; so the inverse means work remains.
  const needsEarningsConfiguration =
    (commercialCapabilities?.participantsInvited ?? false) &&
    !(commercialCapabilities?.earningsConfigured ?? false);

  // Show Approval Centre layout when collecting approvals OR when approvals are
  // complete but the operator may still want to view the approval record.
  const isCollectingApprovals = workflowCtx?.currentStage === 'collecting-approvals';
  const approvalsComplete = React.useMemo(
    () =>
      displayParticipants.length > 0 &&
      displayParticipants.every((p) => {
        const stage = deriveParticipantOperationalWorkflow(p).stage;
        return (
          stage !== 'DRAFT' &&
          stage !== 'EARNINGS_CONFIGURED' &&
          stage !== 'AGREEMENT_SENT'
        );
      }),
    [displayParticipants]
  );
  const showApprovalCentre = isCollectingApprovals || approvalsComplete;

  // Show Supplier Onboarding panel after all approvals complete, when operator
  // navigates via ?focus=onboarding (e.g. from Dashboard CTA or workflow Continue).
  const isPreparingPayments = workflowCtx?.currentStage === 'preparing-payments';
  const showOnboardingPanel = approvalsComplete && (focusOnboarding || isPreparingPayments);

  // All approved participants are shown in the onboarding panel — including those
  // already complete — so the operator can see the full status at a glance.
  const onboardingParticipants = React.useMemo(() => {
    if (!showOnboardingPanel) return [];
    return displayParticipants.filter((p) => {
      const stage = deriveParticipantOperationalWorkflow(p).stage;
      return (
        stage !== 'DRAFT' &&
        stage !== 'EARNINGS_CONFIGURED' &&
        stage !== 'AGREEMENT_SENT'
      );
    });
  }, [showOnboardingPanel, displayParticipants]);

  // When arriving from Dashboard → "Open Approval Centre" (?focus=approvals),
  // scroll to the first participant that still requires action and highlight it.
  const [highlightedApprovalId, setHighlightedApprovalId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!focusApprovals || !showApprovalCentre) return;
    const firstPending = displayParticipants.find((p) => {
      const workflow = deriveParticipantOperationalWorkflow(p);
      return workflow.primaryCta.urgency === 'action_required';
    });
    const targetId = firstPending?.id ?? displayParticipants[0]?.id ?? null;
    if (!targetId) return;
    setHighlightedApprovalId(targetId);
    // Brief delay to allow cards to mount before scrolling
    const t = window.setTimeout(() => {
      const el = document.getElementById(`approval-card-${targetId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    // Clear highlight after 2.5 s
    const clear = window.setTimeout(() => setHighlightedApprovalId(null), 2500);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(clear);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusApprovals, showApprovalCentre]);

  React.useEffect(() => {
    if (!focusPaymentRequests || showApprovalCentre) return;
    const target =
      displayParticipants.find(
        (p) => deriveParticipantOperationalWorkflow(p).stage === 'AGREEMENT_ACCEPTED'
      ) ??
      displayParticipants.find(
        (p) => deriveParticipantOperationalWorkflow(p).stage === 'PAYMENT_INFO_PENDING'
      );
    if (!target) return;
    setRecentlySavedParticipantId(target.id);
    const t = window.setTimeout(() => {
      const el = document.getElementById(`participant-${target.id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    const clear = window.setTimeout(() => setRecentlySavedParticipantId(null), 2500);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(clear);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPaymentRequests, showApprovalCentre]);

  const participantEntities = React.useMemo(
    () => hydratedParticipants.map(participantEntity),
    [hydratedParticipants]
  );

  // Participants requiring action first, then waiting, then complete.
  const pendingApprovalParticipants = React.useMemo(() => {
    if (!showApprovalCentre) return [];
    return displayParticipants.filter((p) => {
      const workflow = deriveParticipantOperationalWorkflow(p);
      return workflow.primaryCta.urgency !== 'none';
    });
  }, [showApprovalCentre, displayParticipants]);

  const approvedParticipants = React.useMemo(
    () =>
      displayParticipants.filter((p) => {
        const workflow = deriveParticipantOperationalWorkflow(p);
        return workflow.primaryCta.urgency === 'none';
      }),
    [displayParticipants]
  );

  // Ordered approval list: pending first (requires action), then approved
  const approvalCentreParticipants = React.useMemo(
    () => [...pendingApprovalParticipants, ...approvedParticipants],
    [pendingApprovalParticipants, approvedParticipants]
  );

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
        {/* Persistent copilot — powered by CommercialBrainContext (no props needed) */}
        <ProjectPageCopilot page="people" />

        {needsEarningsConfiguration && hasParticipants && !showApprovalCentre ? (
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

        {/* ── Page header row ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {/* When in approval centre mode the header is the ApprovalCentreHeader below — keep page title compact */}
            <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
            {hasParticipants && !showApprovalCentre ? (
              <ProjectReadinessBreakdown
                participants={participantEntities}
                projectId={projectId}
                className="mt-2"
                graphParticipants={graph.participants}
                graphSummary={graph.summary}
              />
            ) : !hasParticipants ? (
              <p className="text-muted-foreground mt-1 text-sm">
                Add team members, configure their earnings, and request approvals before payouts can
                be released.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            {!showApprovalCentre && deal && (
              <React.Suspense fallback={null}>
                <CreateFromConversationButton
                  entryPoint="participant_add"
                  existingDeal={deal}
                  existingParticipants={projectParticipants}
                  onComplete={() => void refresh({ scope: 'all', silent: false, force: true })}
                />
              </React.Suspense>
            )}
            {!showApprovalCentre ? (
              /* Standard add buttons when not in Approval Centre mode */
              <>
                <Button asChild>
                  <Link href={projectCommercialRolesPath(projectId)}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    {PRODUCT_TERMINOLOGY.addBudgetedRole}
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add team member
                </Button>
              </>
            ) : (
              /* During Approval Centre mode: roster management is collapsed into a single
                 muted utility button. The operator's eye should land on participant cards,
                 not on roster management actions. */
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground/60 hover:text-muted-foreground"
                onClick={() => setInviteOpen(true)}
              >
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Add member
              </Button>
            )}
          </div>
        </div>

        {sectionError ? (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-4 text-sm text-muted-foreground">
              {sectionError}. Use refresh to retry.
            </CardContent>
          </Card>
        ) : null}

        {stats.primaryLifecycleMessage ? (
          <Card
            className={
              stats.paymentProfilesAwaitingReview > 0 ||
              stats.earningsConfigurationNeeded > 0 ||
              stats.paymentRequestsReadyToSend > 0
                ? 'border-amber-200 bg-amber-50/50'
                : 'border-border'
            }
          >
            <CardContent className="py-4 flex items-start gap-3">
              <AlertCircle
                className={
                  stats.paymentProfilesAwaitingReview > 0 ||
                  stats.earningsConfigurationNeeded > 0 ||
                  stats.paymentRequestsReadyToSend > 0
                    ? 'h-5 w-5 text-amber-600 shrink-0 mt-0.5'
                    : 'h-5 w-5 text-muted-foreground shrink-0 mt-0.5'
                }
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{stats.primaryLifecycleMessage}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  The dashboard shows the next required action in the participant commercial lifecycle.
                </p>
                {(stats.paymentRequestsReadyToSend > 0 ||
                  stats.paymentRequestsAwaitingResponse > 0) && (
                  <Button asChild variant="link" size="sm" className="h-auto p-0 mt-2 text-xs">
                    <Link href={projectPaymentRequestsPath(projectId)}>
                      Review participants
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* ═══════════════════════════════════════════════════════════════
            APPROVAL CENTRE — shown when collecting-approvals stage or after
            all approvals are complete (so operator can review the record).
            Replaces the stats grid and table with action-driven cards.
            ═══════════════════════════════════════════════════════════════ */}
        {showApprovalCentre && hasParticipants ? (
          <div className="space-y-4">
            {/* Progress header */}
            <ApprovalCentreHeader
              participants={displayParticipants}
              agreementName={summary.name}
              commercialCapabilities={commercialCapabilities}
              projectId={projectId}
            />

            {/* Action cards — pending first, approved last */}
            <div
              id="approval-centre-cards"
              className="space-y-2.5"
              aria-label="Approval queue"
            >
              {approvalCentreParticipants.map((p) => (
                <ApprovalCentreParticipantCard
                  key={p.id}
                  id={`approval-card-${p.id}`}
                  participant={p}
                  isHighlighted={highlightedApprovalId === p.id}
                  data-approval-card
                  data-pending={
                    deriveParticipantOperationalWorkflow(p).primaryCta.urgency !== 'none'
                      ? 'true'
                      : 'false'
                  }
                  onShareAgreement={openAgreementShare}
                  onConfigureEarnings={openCompensationConfig}
                  onSendPaymentRequest={handleSendPaymentRequest}
                  projectId={projectId}
                  organizationId={organizationId}
                  workspaceCurrency={workspaceCurrency}
                  releaseReady={releaseReadyByParticipantId.get(p.id) === true}
                  canRelease={canCreateParticipantRelease}
                  releaseDisabledReason={releaseDisabledReason}
                  accountingReconciliation={accountingReconciliationByParticipantId.get(p.id) ?? null}
                  releaseSyncHandlers={syncHandlers}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* ═══════════════════════════════════════════════════════════════════
            SUPPLIER ONBOARDING PANEL — shown after all approvals are complete,
            when the operator navigates via ?focus=onboarding or the workflow
            stage is 'preparing-payments' (= supplier setup required).

            For each approved participant who has not completed onboarding,
            the SupplierOnboardingOperatorView shows:
              - Invoice summary and draft details
              - ABN / GST / bank detail status
              - Verify payout details → pushes supplier bill to Xero

            Replaces the old "Confirm payout details" checkbox pattern.
            ═══════════════════════════════════════════════════════════════════ */}
        {showOnboardingPanel && hasParticipants && onboardingParticipants.length > 0 ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold">Payment Preparation</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Each supplier reviews their draft invoice, provides payment details, ABN, and GST status.
                Approve each submission before exporting to Xero.
              </p>
            </div>
            {onboardingParticipants.map((p) => (
              <ParticipantOnboardingStatusCard
                key={p.id}
                participant={p}
                projectId={projectId}
                onSendPaymentRequest={handleSendPaymentRequest}
                onSharePaymentRequest={handleSharePaymentRequest}
              />
            ))}
          </div>
        ) : null}

        {/* ═══════════════════════════════════════════════════════════
            STATS GRID — shown only when NOT in Approval Centre mode.
            These CRUD-style counts are not relevant during the approval phase.
            ═══════════════════════════════════════════════════════════ */}
        {hasParticipants && !showApprovalCentre ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Earnings configuration needed</CardDescription>
                <CardTitle className="text-2xl">{stats.earningsConfigurationNeeded}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Agreements ready to send</CardDescription>
                <CardTitle className="text-2xl">{stats.agreementsReadyToSend}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Awaiting acceptance</CardDescription>
                <CardTitle className="text-2xl">{stats.awaitingAcceptance}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Payment requests ready to send</CardDescription>
                <CardTitle className="text-2xl">{stats.paymentRequestsReadyToSend}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Awaiting participant response</CardDescription>
                <CardTitle className="text-2xl">{stats.paymentRequestsAwaitingResponse}</CardTitle>
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
                <React.Suspense fallback={null}>
                  <CreateFromConversationButton
                    entryPoint="participant_add"
                    existingDeal={deal}
                    existingParticipants={projectParticipants}
                    onComplete={() => void refresh({ scope: 'all', silent: false, force: true })}
                    size="lg"
                  />
                </React.Suspense>
              )}
              <Button size="lg" asChild>
                <Link href={projectCommercialRolesPath(projectId)}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  {PRODUCT_TERMINOLOGY.addBudgetedRole}
                </Link>
              </Button>
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
          {/*
           * PARTICIPANT TABLE — shown only when NOT in Approval Centre mode.
           * During collecting-approvals stage, the Approval Centre cards above
           * replace this table. The table remains for earnings-configuration stages.
           */}
          {!showApprovalCentre ? (
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>People</CardTitle>
              <CardDescription>
                Team members, earnings, and approvals — one row per person.
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
                                    ? 'Commercial'
                                    : col.key === 'earnings'
                                      ? 'Earnings'
                                      : col.key === 'nextAction'
                                        ? 'Next Action'
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
                          projectId={projectId}
                          onCopyAgreement={openAgreementShare}
                          onShareAgreement={openAgreementShare}
                          onSendPaymentRequest={handleSendPaymentRequest}
                          onSharePaymentRequest={handleSharePaymentRequest}
                          onEdit={setEditParticipant}
                          onConfigureCompensation={openCompensationConfig}
                          organizationId={organizationId}
                          workspaceCurrency={workspaceCurrency}
                          releaseReady={releaseReadyByParticipantId.get(p.id) === true}
                          canRelease={canCreateParticipantRelease}
                          releaseDisabledReason={releaseDisabledReason}
                          accountingReconciliation={accountingReconciliationByParticipantId.get(p.id) ?? null}
                          releaseSyncHandlers={syncHandlers}
                        />
                      </SafeParticipantBoundary>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          ) : null}
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

        <ParticipantPaymentRequestShareDialog
          participant={paymentRequestShareParticipant}
          portalUrl={paymentRequestPortalUrl}
          projectName={deal?.dealName ?? summary.name}
          open={Boolean(paymentRequestShareParticipant)}
          onOpenChange={(open) => {
            if (!open) {
              setPaymentRequestShareParticipant(null);
              setPaymentRequestPortalUrl(null);
            }
          }}
          onSendEmail={handleSendPaymentRequestEmail}
          sendingEmail={paymentRequestEmailSending || paymentRequestGenerating}
        />

        <PlanUpgradeDialog
          open={approvalUpgradeOpen}
          onOpenChange={setApprovalUpgradeOpen}
          requiredPlan={getDecision('approval_workflows')?.requiredPlan ?? 'growth'}
          featureName={FEATURE_DISPLAY_NAMES.approval_workflows}
          currentPlan={plan}
          headline={upgradeHeadline('approval_workflows')}
          body={upgradeBody('approval_workflows', getDecision('approval_workflows')?.requiredPlan ?? 'growth')}
          organizationId={organizationId ?? entitlements?.organizationId}
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
          onAgreementShared={(participant) => {
            patchParticipants((list) =>
              list.map((p) => (p.id === participant.id ? participant : p))
            );
          }}
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
