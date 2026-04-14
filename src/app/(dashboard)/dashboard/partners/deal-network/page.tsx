'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DollarSign,
  Users,
  FileCheck,
  FileSignature,
  TrendingUp,
  Briefcase,
  Percent,
  Banknote,
  ArrowRight,
  Sparkles,
  Handshake,
  Plus,
  UserPlus,
  Pencil,
  Download,
  CreditCard,
  Shield,
  Eye,
  Archive,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  dealNetworkSummary,
  recentDeals as recentDealsSeed,
  attributionBreakdown,
  topEarners as topEarnersSeed,
  payoutRails,
} from '@/lib/data/mock-deal-network';
import type { DealStatus, RecentDeal, TopEarner } from '@/lib/data/mock-deal-network';
import {
  buildFunnelFromDeals,
  getDealCommissionTotal,
  getNextSettlementStatus,
  recentDealToFeatured,
} from '@/lib/deal-network-demo/demo-helpers';
import {
  getPreferredDealIdFromSession,
  persistPreferredDealIdToSession,
  resolveActiveDealId,
  resolvePreviewDeal,
} from '@/lib/deal-network-demo/active-deal-resolution';
import { computePipelineMetrics, formatUsdCompact } from '@/lib/deal-network-demo/pipeline-metrics';
import { resolveParticipantCommissionUsd } from '@/lib/deal-network-demo/commission-structure';
import { CreateDealModal } from '@/components/deal-network-demo/create-deal-modal';
import {
  InviteParticipantModal,
  type DemoParticipant,
} from '@/components/deal-network-demo/invite-participant-modal';
import {
  ExportPayoutsModal,
  buildExportPayoutRows,
} from '@/components/deal-network-demo/export-payouts-modal';
import type { DashboardProductProfile } from '@/lib/auth/admin-shared';
import { DealNetworkCopilotPanel } from '@/components/deal-network-copilot/deal-network-copilot-panel';
import { fetchPilotSnapshot, persistPilotSnapshot } from '@/lib/deal-network-demo/pilot-store';
import {
  dedupeParticipantsForDisplay,
  mergePilotInvite,
  normParticipantName,
  stripDuplicateRoleInvites,
} from '@/lib/deal-network-demo/participant-merge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  effectiveParticipantPayoutStatus,
  type ParticipantPayoutSettlementStatus,
} from '@/lib/deal-network-demo/participant-payout-status';

function getStatusVariant(
  status: DealStatus
): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'outline' {
  switch (status) {
    case 'Paid':
      return 'success';
    case 'Pending':
      return 'warning';
    case 'Eligible':
      return 'info';
    case 'Approved':
      return 'secondary';
    case 'Reversed':
      return 'destructive';
    case 'In Review':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getPaymentVariant(
  status: 'Not Paid' | 'Paid'
): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'outline' {
  return status === 'Paid' ? 'success' : 'outline';
}

function bumpEarnersOnPaid(prev: TopEarner[], commissionTotal: number): TopEarner[] {
  return prev.map((e) => {
    if (e.name !== 'Charlie') return e;
    return {
      ...e,
      amount: e.amount + Math.min(5000, Math.round(commissionTotal * 0.1)),
      type: 'paid' as const,
    };
  });
}

export default function DealNetworkPage() {
  const [pilotHydrated, setPilotHydrated] = React.useState(false);
  const [deals, setDeals] = React.useState<RecentDeal[]>([]);
  /** User preference + session-restored id; may be invalid until synced with `deals`. */
  const [preferredDealId, setPreferredDealId] = React.useState('');
  const [showArchived, setShowArchived] = React.useState(false);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [removeParticipantTargetId, setRemoveParticipantTargetId] = React.useState<string | null>(null);
  const [participants, setParticipants] = React.useState<DemoParticipant[]>([]);
  const [payoutStatusChangePending, setPayoutStatusChangePending] = React.useState<{
    participantId: string;
    fromStatus: ParticipantPayoutSettlementStatus;
    toStatus: ParticipantPayoutSettlementStatus;
  } | null>(null);
  const [payoutStatusChangeNote, setPayoutStatusChangeNote] = React.useState('');

  const activePipelineDeals = React.useMemo(
    () => deals.filter((d) => !d.archived),
    [deals]
  );
  const archivedDeals = React.useMemo(
    () => deals.filter((d) => d.archived),
    [deals]
  );
  const funnel = React.useMemo(
    () => buildFunnelFromDeals(activePipelineDeals),
    [activePipelineDeals]
  );
  const [topEarnersState, setTopEarnersState] = React.useState<TopEarner[]>(() => [...topEarnersSeed]);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [dashboardProfile, setDashboardProfile] = React.useState<DashboardProductProfile | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetch('/api/copilot/session')
      .then((r) => r.json())
      .then((d: { profile: DashboardProductProfile }) => {
        if (!cancelled) setDashboardProfile(d.profile);
      })
      .catch(() => {
        if (!cancelled) setDashboardProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedActiveDealId = React.useMemo(
    () => resolveActiveDealId(deals, preferredDealId),
    [deals, preferredDealId]
  );

  /** Always defined when `deals.length > 0` (preview + pipeline scope). */
  const activeDeal = React.useMemo(
    () => resolvePreviewDeal(deals, resolvedActiveDealId),
    [deals, resolvedActiveDealId]
  );

  const featured = React.useMemo(() => {
    if (activeDeal) return recentDealToFeatured(activeDeal);
    if (!pilotHydrated) return recentDealToFeatured(recentDealsSeed[0]);
    return recentDealToFeatured({
      id: '__placeholder__',
      dealName: 'No deal yet',
      partner: '—',
      value: 0,
      introducer: '',
      closer: '',
      status: 'Pending',
      lastUpdated: new Date().toISOString(),
      paymentStatus: 'Not Paid',
    });
  }, [activeDeal, pilotHydrated]);

  const activeParticipants = React.useMemo(() => {
    const raw = participants.filter(
      (p) =>
        p.dealId === activeDeal?.id ||
        (p.dealId == null && p.dealName === activeDeal?.dealName)
    );
    if (!activeDeal) return [];
    return dedupeParticipantsForDisplay(raw);
  }, [participants, activeDeal]);

  const participantsForActiveDealForInviteCheck = React.useMemo(() => {
    if (!activeDeal) return [];
    return participants.filter(
      (p) =>
        p.dealId === activeDeal.id ||
        (p.dealId == null && p.dealName === activeDeal.dealName)
    );
  }, [participants, activeDeal]);

  const duplicateParticipantWarnings = React.useMemo(() => {
    if (!activeDeal) return [];
    const keys = new Map<string, number>();
    const dups: string[] = [];
    for (const p of activeParticipants) {
      const k = `${p.role}|${normParticipantName(p.name)}`;
      keys.set(k, (keys.get(k) ?? 0) + 1);
    }
    for (const [k, c] of keys) {
      if (c > 1) dups.push(k);
    }
    return dups;
  }, [activeParticipants, activeDeal]);

  const removeTargetParticipant = React.useMemo(() => {
    if (!removeParticipantTargetId) return null;
    return participants.find((p) => p.id === removeParticipantTargetId) ?? null;
  }, [participants, removeParticipantTargetId]);

  /** Keep stored preference aligned with pipeline (invalid id / archived selection). */
  React.useEffect(() => {
    if (deals.length === 0) {
      if (preferredDealId) setPreferredDealId('');
      return;
    }
    const resolved = resolveActiveDealId(deals, preferredDealId);
    if (resolved && resolved !== preferredDealId) {
      setPreferredDealId(resolved);
      persistPreferredDealIdToSession(resolved);
    }
  }, [deals, preferredDealId]);

  const pipelineMetrics = React.useMemo(
    () => computePipelineMetrics(activePipelineDeals),
    [activePipelineDeals]
  );

  const exportData = React.useMemo(
    () => buildExportPayoutRows(activePipelineDeals, participants),
    [activePipelineDeals, participants]
  );

  const applyParticipantPayoutStatus = React.useCallback(
    (
      id: string,
      status: ParticipantPayoutSettlementStatus,
      options?: { paidAt?: string; note?: string }
    ) => {
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          return {
            ...p,
            payoutSettlementStatus: status,
            payoutPaidAt:
              status === 'Paid' ? options?.paidAt ?? new Date().toISOString() : undefined,
            // Note always comes from the latest status-change dialog; blank clears prior text.
            payoutStatusNote:
              options?.note !== undefined ? options.note.trim() || undefined : p.payoutStatusNote,
          };
        })
      );
    },
    []
  );

  const handleParticipantPayoutStatusSelect = React.useCallback(
    (p: DemoParticipant, value: string) => {
      if (!activeDeal) return;
      const next = value as ParticipantPayoutSettlementStatus;
      const current = effectiveParticipantPayoutStatus(p, activeDeal);
      if (next === current) return;
      setPayoutStatusChangePending({
        participantId: p.id,
        fromStatus: current,
        toStatus: next,
      });
      setPayoutStatusChangeNote('');
    },
    [activeDeal]
  );

  const payoutStatusChangeParticipant = React.useMemo(() => {
    if (!payoutStatusChangePending) return null;
    return participants.find((x) => x.id === payoutStatusChangePending.participantId) ?? null;
  }, [participants, payoutStatusChangePending]);

  const syncInternalRoleParticipants = React.useCallback(
    (existingParticipants: DemoParticipant[], dealsToSync: RecentDeal[]) => {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const next = [...existingParticipants];

      const upsertRoleParticipant = (deal: RecentDeal, role: 'Introducer' | 'Closer') => {
        const roleKey = role.toLowerCase();
        const participantId = `internal-${roleKey}-${deal.id}`;
        const inviteToken = `internal-${roleKey}-${deal.id}`;
        const amountValue = role === 'Introducer' ? deal.introducerAmount : deal.closerAmount;

        const idx = next.findIndex((p) => p.id === participantId || p.inviteToken === inviteToken);

        if (amountValue == null) {
          if (idx >= 0) next.splice(idx, 1);
          return;
        }

        const nameValue = (role === 'Introducer' ? deal.introducer : deal.closer).trim();
        const displayName = nameValue || role;
        const prev = idx >= 0 ? next[idx] : undefined;

        const roleDetails =
          role === 'Introducer' ? deal.introducerRoleDetails : deal.closerRoleDetails;
        const payoutCondition =
          role === 'Introducer' ? deal.introducerPayoutCondition : deal.closerPayoutCondition;
        const agreementNotes =
          role === 'Introducer' ? deal.introducerAgreementNotes : deal.closerAgreementNotes;
        const attachmentUrl =
          role === 'Introducer' ? deal.introducerAttachmentUrl : deal.closerAttachmentUrl;
        const attachmentLabel =
          role === 'Introducer' ? deal.introducerAttachmentLabel : deal.closerAttachmentLabel;

        const inviteLink = origin ? `${origin}/deal-invites/${inviteToken}` : undefined;

        const updated: DemoParticipant = {
          id: participantId,
          name: displayName,
          email: prev?.email ?? '',
          role,
          commissionKind: 'fixed_amount',
          commissionValue: amountValue,
          baseParticipant: undefined,
          formulaExpression: undefined,
          status: prev?.status ?? 'Pending',
          inviteStatus: prev?.inviteStatus ?? 'Invited',
          approvalStatus: prev?.approvalStatus ?? 'Pending approval',
          approvedAt: prev?.approvedAt,
          approvalNote: prev?.approvalNote,
          inviteToken,
          dealName: deal.dealName,
          partner: deal.partner,
          dealId: deal.id,
          inviteLink,
          roleDetails: roleDetails || undefined,
          payoutCondition: payoutCondition || undefined,
          agreementNotes: agreementNotes || undefined,
          attachmentUrl: attachmentUrl || undefined,
          attachmentLabel: attachmentLabel || undefined,
          payoutSettlementStatus: prev?.payoutSettlementStatus,
          payoutPaidAt: prev?.payoutPaidAt,
          payoutStatusNote: prev?.payoutStatusNote,
        };

        if (idx >= 0) {
          next[idx] = { ...next[idx], ...updated };
        } else {
          next.push(updated);
        }
      };

      for (const d of dealsToSync) {
        upsertRoleParticipant(d, 'Introducer');
        upsertRoleParticipant(d, 'Closer');
      }

      return stripDuplicateRoleInvites(next, dealsToSync);
    },
    []
  );

  React.useEffect(() => {
    let cancelled = false;
    void fetchPilotSnapshot().then((stored) => {
      if (cancelled) return;
      if (stored === null) {
        setPilotHydrated(true);
        return;
      }
      if (stored.deals.length > 0) {
        setDeals(stored.deals);
        const activeFirst = stored.deals.filter((d) => !d.archived);
        const fromSession = getPreferredDealIdFromSession();
        const initialPreferred =
          fromSession ?? (activeFirst[0] ?? stored.deals[0]).id;
        const resolved = resolveActiveDealId(stored.deals, initialPreferred);
        setPreferredDealId(resolved ?? '');
        if (resolved) persistPreferredDealIdToSession(resolved);
        setParticipants(syncInternalRoleParticipants(stored.participants, stored.deals));
      } else {
        setDeals([]);
        setPreferredDealId('');
        persistPreferredDealIdToSession('');
        setParticipants([]);
      }
      setPilotHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [syncInternalRoleParticipants]);

  React.useEffect(() => {
    setParticipants((prev) => syncInternalRoleParticipants(prev, deals));
  }, [deals, syncInternalRoleParticipants]);

  React.useEffect(() => {
    if (!pilotHydrated) return;
    const t = setTimeout(() => {
      void persistPilotSnapshot({ deals, participants });
    }, 600);
    return () => clearTimeout(t);
  }, [deals, participants, pilotHydrated]);

  const handleCreateDeal = React.useCallback((deal: RecentDeal) => {
    setDeals((prev) => {
      const exists = prev.some((d) => d.id === deal.id);
      return exists
        ? prev.map((d) => (d.id === deal.id ? deal : d))
        : [deal, ...prev];
    });
    setPreferredDealId(deal.id);
    persistPreferredDealIdToSession(deal.id);

    setParticipants((prev) => syncInternalRoleParticipants(prev, [deal]));
  }, [syncInternalRoleParticipants]);

  const handleInviteParticipant = React.useCallback(
    async (p: DemoParticipant, duplicateAction: 'use_existing' | 'create_duplicate_anyway') => {
      if (!activeDeal) throw new Error('No active deal selected');

      if (duplicateAction === 'use_existing') {
        const next = mergePilotInvite(participants, p, activeDeal);
        setParticipants(next);
        const n = normParticipantName(p.name);
        const candidates = next.filter(
          (x) =>
            x.dealId === activeDeal.id &&
            x.role === p.role &&
            normParticipantName(x.name) === n
        );
        return (
          candidates.find((x) => !x.id.startsWith('internal-')) ??
          candidates[0] ??
          next.find((x) => x.dealId === activeDeal.id && x.role === p.role && normParticipantName(x.name) === n) ??
          p
        );
      }

      // Intentionally allow duplicates: bypass merge logic and keep this row separate.
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const withMeta: DemoParticipant = {
        ...p,
        dealId: activeDeal.id,
        dealName: activeDeal.dealName,
        partner: activeDeal.partner,
        userRequestedDuplicate: true,
        inviteLink: p.inviteLink ?? (origin ? `${origin}/deal-invites/${p.inviteToken}` : undefined),
      };
      setParticipants((prev) => [...prev, withMeta]);
      return withMeta;
    },
    [activeDeal, participants]
  );

  const archiveDealById = React.useCallback((id: string) => {
    const now = new Date().toISOString();
    setDeals((prev) =>
      prev.map((d) => (d.id === id ? { ...d, archived: true, lastUpdated: now } : d))
    );
  }, []);

  const runDeleteDeal = React.useCallback((id: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== id));
    setParticipants((prev) => prev.filter((p) => p.dealId !== id));
    setPreferredDealId((cur) => (cur === id ? '' : cur));
  }, []);

  const runRemoveParticipant = React.useCallback((id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    setRemoveParticipantTargetId(null);
  }, []);

  const restoreDealById = React.useCallback((id: string) => {
    const now = new Date().toISOString();
    setDeals((prev) =>
      prev.map((d) => (d.id === id ? { ...d, archived: false, lastUpdated: now } : d))
    );
  }, []);

  const toggleParticipant = React.useCallback((id: string) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: p.status === 'Pending' ? 'Confirmed' : 'Pending',
              approvalStatus: p.approvalStatus === 'Approved' ? 'Pending approval' : 'Approved',
              approvedAt:
                p.approvalStatus === 'Approved' ? undefined : new Date().toISOString(),
            }
          : p
      )
    );
  }, []);

  const markContractPaid = React.useCallback(() => {
    if (!activeDeal) return;
    if (activeDeal.status !== 'Pending' && activeDeal.status !== 'Eligible') return;
    const paidAt = new Date().toISOString();
    setDeals((prev) =>
      prev.map((d) =>
        d.id === activeDeal.id
          ? {
              ...d,
              status: 'Approved',
              paymentStatus: 'Paid',
              paidAt,
              lastUpdated: paidAt,
            }
          : d
      )
    );
  }, [activeDeal]);

  const advanceDealStatus = React.useCallback((dealId: string) => {
    setDeals((prev) => {
      const d = prev.find((row) => row.id === dealId);
      if (!d) return prev;
      const next = getNextSettlementStatus(d.status);
      if (next === d.status) return prev;
      if (next === 'Paid' && d.status !== 'Paid') {
        const total = getDealCommissionTotal(d);
        if (total != null) {
          setTopEarnersState((te) => bumpEarnersOnPaid(te, total));
        }
      }
      return prev.map((row) =>
        row.id === dealId
          ? { ...row, status: next, lastUpdated: new Date().toISOString() }
          : row
      );
    });
  }, []);

  const selectDeal = React.useCallback((dealId: string) => {
    setPreferredDealId(dealId);
    persistPreferredDealIdToSession(dealId);
  }, []);

  const prevDealCountRef = React.useRef(0);
  /** After pilot data hydrates, reset dashboard main scroll so sections 1–2 aren’t “missing” below the fold. */
  React.useLayoutEffect(() => {
    if (!pilotHydrated || deals.length === 0) {
      prevDealCountRef.current = deals.length;
      return;
    }
    const prev = prevDealCountRef.current;
    prevDealCountRef.current = deals.length;
    if (prev === 0 && deals.length > 0) {
      const main = document.querySelector('main.flex-1.overflow-y-auto');
      if (main) main.scrollTop = 0;
    }
  }, [pilotHydrated, deals.length]);

  return (
    <div className="space-y-6">
      <div className="min-w-0 space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Commission Operations</h1>
            <Badge variant="secondary">Demo</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/dashboard/payment-links">Invoice dashboard</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEditOpen(false);
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Deal
            </Button>
          </div>
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          Attribution, commission entitlements, and payout state across your deal network—in one place.
        </p>
        <p className="text-muted-foreground text-sm">
          Multi-party deal tracking and payout transparency for high-trust networks. Provvypay powers BD and referral commission ops end-to-end.
        </p>
        <Alert className="mt-4 border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50">
          <Shield className="text-amber-700 dark:text-amber-500" aria-hidden />
          <AlertTitle className="text-amber-900 dark:text-amber-100">Governance & controls</AlertTitle>
          <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
            <span className="font-medium">Admin approval required before payout release.</span>{' '}
            Settlement advances as Pending → Eligible → Approved → Paid; only approved payouts can move to Paid in this demo.
          </AlertDescription>
        </Alert>
      </div>

      {/* Featured Deal — visual centerpiece */}
      <Card
        id="deal-network-active-deal"
        className="scroll-mt-6 border-primary/40 bg-gradient-to-b from-primary/5 to-transparent shadow-sm"
      >
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" aria-hidden />
                <CardTitle className="text-xl">Active deal</CardTitle>
              </div>
              <CardDescription className="mt-2">
                Active deal from your pipeline: attribution, commission pool preview, invites, and payout actions stay scoped to this selection.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deal Status</span>
              <Badge variant={getStatusVariant(featured.status)}>{featured.status}</Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInviteOpen(true)}
                disabled={!activeDeal || activeDeal.archived || activeDeal.id === '__placeholder__'}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Invite participant
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
                disabled={!activeDeal || activeDeal.id === '__placeholder__'}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit deal
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => activeDeal && activeDeal.id !== '__placeholder__' && archiveDealById(activeDeal.id)}
                disabled={!activeDeal || activeDeal.id === '__placeholder__' || activeDeal.archived}
              >
                <Archive className="h-4 w-4 mr-1" />
                Archive
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => activeDeal && activeDeal.id !== '__placeholder__' && setDeleteTargetId(activeDeal.id)}
                disabled={!activeDeal || activeDeal.id === '__placeholder__'}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={markContractPaid}
                disabled={
                  !activeDeal ||
                  activeDeal.archived ||
                  featured.status === 'Approved' ||
                  featured.status === 'Paid'
                }
              >
                <CreditCard className="h-4 w-4 mr-1" />
                Mark contract as paid
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-background/60 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Deal details</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deal</p>
                <p className="font-semibold text-foreground">{featured.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deal value</p>
                <p className="font-semibold text-foreground">${featured.dealValue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payout trigger</p>
                <p className="font-semibold text-foreground">{featured.payoutTrigger}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Partner</p>
                <p className="font-semibold text-foreground">{featured.partner}</p>
              </div>
            </div>
            {activeDeal?.rhContactLine ? (
              <div className="mt-4 pt-4 border-t border-border/60">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact</p>
                <p className="font-semibold text-foreground mt-1">{activeDeal.rhContactLine}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border bg-background/60 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Deal progress</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operating stage</p>
                <Badge variant="secondary" className="mt-1">
                  {activeDeal?.currentStage ?? '—'}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last contact</p>
                <p className="text-sm font-medium mt-1">
                  {activeDeal?.lastContactedAt
                    ? new Date(activeDeal.lastContactedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Next step</p>
                <p className="text-sm font-medium mt-1 whitespace-pre-wrap">
                  {activeDeal?.nextStep?.trim() ? activeDeal.nextStep : '—'}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Latest update</p>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {activeDeal?.latestUpdate?.trim() ? activeDeal.latestUpdate : '—'}
                </p>
              </div>
              {activeDeal?.activityLog && activeDeal.activityLog.length > 0 ? (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Activity</p>
                  <ul className="text-xs space-y-1 max-h-32 overflow-y-auto rounded border bg-muted/30 p-2">
                    {activeDeal.activityLog.map((e, i) => (
                      <li key={`${e.at}-${i}`} className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {new Date(e.at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>{' '}
                        {e.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border bg-background/60 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Attributed roles</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Introducer</p>
                <p className="font-medium text-foreground">
                  {featured.introducer?.trim() ? featured.introducer : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Closer</p>
                <p className="font-medium text-foreground">
                  {featured.closer?.trim() ? featured.closer : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-background/60 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Commission entitlements</p>
            {featured.commissionSplits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No commission structure defined yet.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {featured.commissionSplits.map((split) => (
                  <div
                    key={split.role}
                    className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2"
                  >
                    <span className="text-sm font-medium">{split.name}</span>
                    <span className="text-muted-foreground">({split.role})</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
                    <span className="font-semibold">${split.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-background/60 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Payment</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment status</span>
                <Badge variant={getPaymentVariant(activeDeal?.paymentStatus ?? 'Not Paid')}>
                  {activeDeal?.paymentStatus ?? 'Not Paid'}
                </Badge>
              </div>
              {activeDeal?.paymentLink ? (
                <p className="text-sm">
                  <a href={activeDeal.paymentLink} target="_blank" rel="noreferrer" className="text-primary underline">
                    {activeDeal.paymentLink}
                  </a>
                </p>
              ) : null}
              {typeof activeDeal?.paidAmount === 'number' ? (
                <p className="text-sm text-muted-foreground">
                  Amount paid: ${activeDeal.paidAmount.toLocaleString()}
                </p>
              ) : null}
              {activeDeal?.paidAt ? (
                <p className="text-sm text-muted-foreground">
                  Paid at:{' '}
                  {new Date(activeDeal.paidAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              ) : null}
            </div>
          </div>

          {duplicateParticipantWarnings.length > 0 ? (
            <Alert className="border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20">
              <AlertTitle className="text-amber-900 dark:text-amber-100">Possible duplicate payout parties</AlertTitle>
              <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
                The same name appears more than once for a role on this deal (
                {duplicateParticipantWarnings.join('; ')}). New invites for Introducer/Closer now merge with the deal
                role when the name matches. Use Edit deal to fix attribution, or remove stray invites from the list
                by adjusting roles.
              </AlertDescription>
            </Alert>
          ) : null}

          {(activeParticipants.length > 0 || typeof activeDeal?.platformFee === 'number') && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Deal payout parties
                  </span>
                  <Badge variant="outline" className="font-medium border-primary/40 bg-background">
                    {featured.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Partner: {featured.partner}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Introducer/Closer roles and invited participants approve through their invite link.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Invite</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead>Payout status</TableHead>
                    <TableHead>Payout settled</TableHead>
                    <TableHead>Approved at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeParticipants.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/60"
                      onClick={() => toggleParticipant(p.id)}
                      title="Manual fallback toggle for demo"
                    >
                      <TableCell className="font-medium text-muted-foreground text-sm">
                        {p.dealName ?? activeDeal?.dealName ?? featured.name}
                      </TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.email?.trim() ? p.email : '—'}
                      </TableCell>
                      <TableCell>{p.role}</TableCell>
                      <TableCell>
                        {(() => {
                          if (!activeDeal) {
                            return <span className="text-sm text-muted-foreground">No deal selected</span>;
                          }
                          const payout = resolveParticipantCommissionUsd(
                            {
                              commissionKind: p.commissionKind,
                              commissionValue: p.commissionValue,
                              baseParticipant: p.baseParticipant,
                              formulaExpression: p.formulaExpression,
                            },
                            activeDeal.value,
                            {
                              Introducer: activeDeal.introducerAmount,
                              Closer: activeDeal.closerAmount,
                              Platform: activeDeal.platformFee,
                            }
                          );
                          if (payout.total <= 0) {
                            return <span className="text-sm text-muted-foreground">No commission structure defined</span>;
                          }
                          return (
                            <div className="space-y-0.5">
                              <span className="text-xs text-muted-foreground block">{payout.previewLine}</span>
                              <span className="font-medium tabular-nums">${payout.total.toLocaleString()}</span>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.inviteStatus === 'Opened' ? 'info' : 'outline'}>
                          {p.inviteStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.approvalStatus === 'Approved' ? 'success' : 'warning'}>
                          {p.approvalStatus}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="min-w-[140px]"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {activeDeal ? (
                          <div className="space-y-1">
                            <Select
                              value={effectiveParticipantPayoutStatus(p, activeDeal)}
                              onValueChange={(v) => handleParticipantPayoutStatusSelect(p, v)}
                            >
                              <SelectTrigger className="h-8 text-xs" aria-label={`Payout status for ${p.name}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Eligible">Eligible</SelectItem>
                                <SelectItem value="Approved">Approved</SelectItem>
                                <SelectItem value="Paid">Paid</SelectItem>
                              </SelectContent>
                            </Select>
                            {p.payoutStatusNote ? (
                              <div className="space-y-0.5">
                                <p className="text-[10px] font-medium text-muted-foreground">Status note</p>
                                <p className="text-[10px] text-muted-foreground leading-tight">{p.payoutStatusNote}</p>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground whitespace-nowrap"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {activeDeal &&
                        effectiveParticipantPayoutStatus(p, activeDeal) === 'Paid' &&
                        p.payoutPaidAt
                          ? new Date(p.payoutPaidAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.approvedAt
                          ? new Date(p.approvedAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                        {p.inviteLink ? (
                          <a
                            href={p.inviteLink}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 underline text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open link
                          </a>
                        ) : null}
                        {!p.id.startsWith('internal-') ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 ml-2 text-destructive hover:text-destructive"
                            title="Remove invited participant"
                            aria-label={`Remove ${p.name} from this deal`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemoveParticipantTargetId(p.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {typeof activeDeal?.platformFee === 'number' ? (
                    <TableRow className="hover:bg-muted/60">
                      <TableCell className="font-medium text-muted-foreground text-sm">
                        {activeDeal?.dealName ?? featured.name}
                      </TableCell>
                      <TableCell className="font-medium">Rabbit Hole Platform</TableCell>
                      <TableCell className="text-muted-foreground text-sm">—</TableCell>
                      <TableCell>Platform</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="text-xs text-muted-foreground block">
                            Fixed commission pool: $
                            {activeDeal.platformFee.toLocaleString()}
                          </span>
                          <span className="font-medium tabular-nums">
                            ${activeDeal.platformFee.toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">Internal</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">Not required</Badge>
                      </TableCell>
                      <TableCell>
                        {activeDeal ? (
                          <Badge variant={getStatusVariant(activeDeal.status)}>{activeDeal.status}</Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {activeDeal?.paidAt
                          ? new Date(activeDeal.paidAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">-</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary KPIs — baseline + pipeline-derived where noted */}
      <div id="deal-network-summary" className="scroll-mt-6">
        <h2 className="text-lg font-semibold tracking-tight mb-1">Network summary</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Open deals, commissions pending, and commissions paid reflect the live demo pipeline below.
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total deal value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(dealNetworkSummary.totalDealsGenerated / 1_000_000).toFixed(1)}M
              </div>
              <p className="text-xs text-muted-foreground">Cumulative attributed deal value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contracts signed</CardTitle>
              <FileSignature className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dealNetworkSummary.contractsSigned}</div>
              <p className="text-xs text-muted-foreground">Contract-driven deals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commission entitlements (pending)</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatUsdCompact(pipelineMetrics.commissionsPending)}</div>
              <p className="text-xs text-muted-foreground">From pipeline (pre-Paid)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commissions paid</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatUsdCompact(pipelineMetrics.commissionsPaid)}</div>
              <p className="text-xs text-muted-foreground">From pipeline (Paid)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Referral revenue generated</CardTitle>
              <Handshake className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(dealNetworkSummary.referralRevenueGenerated / 1000).toFixed(0)}k
              </div>
              <p className="text-xs text-muted-foreground">From referral-attributed deals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active partners</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dealNetworkSummary.activePartners}</div>
              <p className="text-xs text-muted-foreground">In deal network</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open deals</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pipelineMetrics.openDeals}</div>
              <p className="text-xs text-muted-foreground">Not Paid / Reversed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg commission rate</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dealNetworkSummary.avgCommissionRate}%</div>
              <p className="text-xs text-muted-foreground">Blended rate</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Deal pipeline */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Deal pipeline</CardTitle>
            <CardDescription>
              Recent deals—enterprise partners and community or membership-style commissions. Click a row or{' '}
              <span className="font-medium">View</span> to open it in the detail panel above. Click a settlement badge to advance{' '}
              <span className="font-medium">Pending → Eligible → Approved → Paid</span> (admin approval step before Paid in production).
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create deal
            </Button>
            <Button type="button" variant="outline" onClick={() => setExportOpen(true)}>
              <Download className="h-4 w-4 mr-1" />
              Export payouts
            </Button>
            {archivedDeals.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? 'Hide archived' : `Archived (${archivedDeals.length})`}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal name</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="max-w-[160px]">Next step</TableHead>
                <TableHead>Introducer</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Settlement state</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead className="w-[1%] text-right">Actions</TableHead>
                <TableHead className="w-[1%] text-right">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activePipelineDeals.map((deal) => (
                <TableRow
                  key={deal.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'cursor-pointer',
                    deal.id === resolvedActiveDealId && 'bg-muted/50 border-l-2 border-l-primary'
                  )}
                  onClick={() => selectDeal(deal.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectDeal(deal.id);
                    }
                  }}
                >
                  <TableCell className="font-medium">{deal.dealName}</TableCell>
                  <TableCell>
                    <span className="font-medium">{deal.partner}</span>
                    {deal.rhContactLine ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{deal.rhContactLine}</span>
                    ) : null}
                    {deal.rhGraphIntroducer &&
                    deal.introducer.trim() !== deal.rhGraphIntroducer.trim() ? (
                      <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
                        Introducer override — graph: {deal.rhGraphIntroducer}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">${deal.value.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {deal.currentStage ?? '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[160px]">
                    <span className="line-clamp-2 text-sm text-muted-foreground" title={deal.nextStep ?? ''}>
                      {deal.nextStep?.trim() ? deal.nextStep : '—'}
                    </span>
                  </TableCell>
                  <TableCell>{deal.introducer}</TableCell>
                  <TableCell>{deal.closer}</TableCell>
                  <TableCell className="text-right font-medium">
                    {(() => {
                      const total = getDealCommissionTotal(deal);
                      return total == null ? '—' : `$${total.toLocaleString()}`;
                    })()}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="inline-flex cursor-pointer rounded-full border-0 bg-transparent p-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        advanceDealStatus(deal.id);
                      }}
                      title="Advance: Pending → Eligible → Approved → Paid"
                    >
                      <Badge variant={getStatusVariant(deal.status)}>{deal.status}</Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPaymentVariant(deal.paymentStatus ?? 'Not Paid')}>
                      {deal.paymentStatus ?? 'Not Paid'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(deal.lastUpdated).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Archive deal"
                        onClick={() => archiveDealById(deal.id)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        title="Delete deal"
                        onClick={() => setDeleteTargetId(deal.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectDeal(deal.id);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {showArchived && archivedDeals.length > 0 ? (
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Archived deals</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal name</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="w-[1%] text-right">Restore</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedDeals.map((deal) => (
                    <TableRow key={`arch-${deal.id}`}>
                      <TableCell className="font-medium">{deal.dealName}</TableCell>
                      <TableCell>{deal.partner}</TableCell>
                      <TableCell className="text-right">${deal.value.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => restoreDealById(deal.id)}>
                          Restore
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Secondary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Settlement state funnel</CardTitle>
            <CardDescription>
              Where deals sit in the payout lifecycle: pending → eligible → approved → paid. Approved is the control gate before funds release.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {funnel.map((stage) => (
                <div key={stage.label} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{stage.label}</span>
                  <span className="text-sm text-muted-foreground">{stage.count} deals</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attributed roles</CardTitle>
            <CardDescription>
              Role definitions used by the pilot. Actual payout amounts come from each deal&apos;s explicit commission structure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {attributionBreakdown.map((item) => (
                <div key={item.role} className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium">{item.role}</span>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">{item.sharePct}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top earners (demo)</CardTitle>
            <CardDescription>
              Partner totals: how much is already paid vs still pending. For illustration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topEarnersState.map((earner) => (
                <div key={earner.name} className="flex items-center justify-between">
                  <span className="font-medium">{earner.name}</span>
                  <span className="text-sm">
                    ${(earner.amount / 1000).toFixed(0)}k{' '}
                    <Badge variant={earner.type === 'paid' ? 'success' : 'warning'} className="text-xs">
                      {earner.type}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payout rail snapshot</CardTitle>
            <CardDescription>
              How partners get paid: bank, USDC, wallet, or Stripe. Counts and last use per rail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payoutRails.map((rail) => (
                <div key={rail.method} className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Banknote className="h-3.5 w-3 text-muted-foreground" />
                    {rail.method}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {rail.count} partners · Last{' '}
                    {new Date(rail.lastUsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this deal?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the deal and its payout party rows from your pilot workspace. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTargetId) runDeleteDeal(deleteTargetId);
                setDeleteTargetId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={payoutStatusChangePending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPayoutStatusChangePending(null);
            setPayoutStatusChangeNote('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm payout status change</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Current:</span> {payoutStatusChangePending?.fromStatus}{' '}
                  <span className="font-medium text-foreground">→ New:</span> {payoutStatusChangePending?.toStatus}
                </p>
                {payoutStatusChangePending?.toStatus === 'Paid' ? (
                  <p>
                    Marking as Paid should only be used once settlement has actually occurred.
                  </p>
                ) : null}
                {payoutStatusChangeParticipant ? (
                  <p className="font-medium text-foreground">
                    {payoutStatusChangeParticipant.name} · {payoutStatusChangeParticipant.role}
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="payout-status-note" className="text-sm">
              Status note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Saved with this change only. Leave blank to clear any previous note for this payout line.
            </p>
            <Input
              id="payout-status-note"
              value={payoutStatusChangeNote}
              onChange={(e) => setPayoutStatusChangeNote(e.target.value)}
              placeholder="e.g. reference, batch, or correction"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const pending = payoutStatusChangePending;
                if (!pending) return;
                applyParticipantPayoutStatus(pending.participantId, pending.toStatus, {
                  paidAt: pending.toStatus === 'Paid' ? new Date().toISOString() : undefined,
                  note: payoutStatusChangeNote,
                });
                setPayoutStatusChangePending(null);
                setPayoutStatusChangeNote('');
              }}
            >
              Confirm change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={removeParticipantTargetId !== null}
        onOpenChange={(open) => !open && setRemoveParticipantTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove participant?</AlertDialogTitle>
            {removeTargetParticipant ? (
              <AlertDialogDescription>
                {removeTargetParticipant.approvalStatus === 'Approved' ? (
                  <>
                    {removeTargetParticipant.name} has already approved this role. Removing them will
                    invalidate their invite link and exclude them from payout exports.
                    <span className="block mt-1 font-medium">Do you still want to remove them?</span>
                  </>
                ) : (
                  <>
                    Removing {removeTargetParticipant.name} will invalidate their invite link. If they
                    have not approved yet, they will not be able to approve after removal.
                  </>
                )}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removeParticipantTargetId) runRemoveParticipant(removeParticipantTargetId);
              }}
            >
              Remove participant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateDealModal open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreateDeal} />
      <CreateDealModal
        open={editOpen}
        onOpenChange={setEditOpen}
        onCreate={handleCreateDeal}
        editDeal={activeDeal ?? null}
      />
      <InviteParticipantModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={handleInviteParticipant}
        existingParticipantsForDuplicateCheck={participantsForActiveDealForInviteCheck}
        featuredDealValue={featured.dealValue}
        featuredRoleAmounts={{
          Introducer: activeDeal?.introducerAmount,
          Closer: activeDeal?.closerAmount,
          Platform: activeDeal?.platformFee,
        }}
      />
      <ExportPayoutsModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        rows={exportData.rows}
        excludedUnapprovedCount={exportData.excludedUnapprovedCount}
      />
      </div>
      <DealNetworkCopilotPanel
        profile={dashboardProfile}
        activeDeal={
          activeDeal
            ? {
                id: activeDeal.id,
                dealName: activeDeal.dealName,
                status: activeDeal.status,
                paymentStatus: activeDeal.paymentStatus,
                archived: activeDeal.archived,
              }
            : null
        }
        participants={activeParticipants}
      />
    </div>
  );
}
