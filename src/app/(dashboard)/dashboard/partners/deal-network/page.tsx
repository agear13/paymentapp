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
  Download,
  CreditCard,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  dealNetworkSummary,
  featuredDeal as featuredDealSeed,
  recentDeals as recentDealsSeed,
  commissionFunnelStages,
  attributionBreakdown,
  topEarners as topEarnersSeed,
  payoutRails,
} from '@/lib/data/mock-deal-network';
import type { DealStatus, FeaturedDeal, RecentDeal, TopEarner } from '@/lib/data/mock-deal-network';
import {
  adjustFunnelCounts,
  getNextSettlementStatus,
  statusToFunnelLabel,
} from '@/lib/deal-network-demo/demo-helpers';
import { computePipelineMetrics, formatUsdCompact } from '@/lib/deal-network-demo/pipeline-metrics';
import {
  COMMISSION_STRUCTURE_OPTIONS,
  resolveParticipantCommissionUsd,
} from '@/lib/deal-network-demo/commission-structure';
import { CreateDealModal } from '@/components/deal-network-demo/create-deal-modal';
import {
  InviteParticipantModal,
  type DemoParticipant,
} from '@/components/deal-network-demo/invite-participant-modal';
import {
  ExportPayoutsModal,
  buildExportPayoutRows,
} from '@/components/deal-network-demo/export-payouts-modal';
import { loadPilotStore, savePilotStore } from '@/lib/deal-network-demo/pilot-store';

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

function bumpEarnersOnPaid(prev: TopEarner[], commission: number): TopEarner[] {
  return prev.map((e) => {
    if (e.name !== 'Charlie') return e;
    return {
      ...e,
      amount: e.amount + Math.min(5000, Math.round(commission * 0.1)),
      type: 'paid' as const,
    };
  });
}

export default function DealNetworkPage() {
  const [deals, setDeals] = React.useState<RecentDeal[]>(() => [...recentDealsSeed]);
  const [featured, setFeatured] = React.useState<FeaturedDeal>(() => ({ ...featuredDealSeed }));
  const [funnel, setFunnel] = React.useState(() =>
    commissionFunnelStages.map((s) => ({ ...s }))
  );
  const [participants, setParticipants] = React.useState<DemoParticipant[]>([]);
  const [topEarnersState, setTopEarnersState] = React.useState<TopEarner[]>(() => [...topEarnersSeed]);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);

  const pipelineMetrics = React.useMemo(() => computePipelineMetrics(deals), [deals]);

  const exportData = React.useMemo(
    () =>
      buildExportPayoutRows(deals, participants, {
        dealValue: featured.dealValue,
      }),
    [deals, participants, featured.dealValue]
  );

  React.useEffect(() => {
    const stored = loadPilotStore();
    if (!stored) return;
    if (stored.deals.length) setDeals(stored.deals);
    setParticipants(stored.participants);
  }, []);

  React.useEffect(() => {
    savePilotStore({ deals, participants });
  }, [deals, participants]);

  const handleCreateDeal = React.useCallback((deal: RecentDeal) => {
    setDeals((prev) => [deal, ...prev]);
    setFunnel((prev) => adjustFunnelCounts(prev, null, 'Pending'));
  }, []);

  const handleInviteParticipant = React.useCallback(
    (p: DemoParticipant) => {
      const linkedDeal = deals.find((d) => d.dealName === featured.name);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setParticipants((prev) => [
        ...prev,
        {
          ...p,
          dealId: linkedDeal?.id,
          dealName: linkedDeal?.dealName ?? featured.name,
          partner: linkedDeal?.partner ?? featured.partner,
          inviteLink: `${origin}/deal-invites/${p.inviteToken}`,
        },
      ]);
    },
    [featured.name, featured.partner, deals]
  );

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
    if (featured.status !== 'Pending' && featured.status !== 'Eligible') return;
    const from = statusToFunnelLabel(featured.status);
    const to = statusToFunnelLabel('Approved');
    setFeatured((f) => ({ ...f, status: 'Approved' }));
    setFunnel((prev) => adjustFunnelCounts(prev, from, to));
    setDeals((prev) =>
      prev.map((d) =>
        d.dealName === featured.name
          ? { ...d, status: 'Approved', lastUpdated: new Date().toISOString() }
          : d
      )
    );
  }, [featured.name, featured.status]);

  const advanceDealStatus = React.useCallback((dealId: string) => {
    setDeals((prev) => {
      const d = prev.find((row) => row.id === dealId);
      if (!d) return prev;
      const next = getNextSettlementStatus(d.status);
      if (next === d.status) return prev;
      const fromLabel = statusToFunnelLabel(d.status);
      const toLabel = statusToFunnelLabel(next);
      setFunnel((f) => adjustFunnelCounts(f, fromLabel, toLabel));
      if (next === 'Paid' && d.status !== 'Paid') {
        setTopEarnersState((te) => bumpEarnersOnPaid(te, d.commission));
      }
      setFeatured((f) => (d.dealName === f.name ? { ...f, status: next } : f));
      return prev.map((row) =>
        row.id === dealId
          ? { ...row, status: next, lastUpdated: new Date().toISOString() }
          : row
      );
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold tracking-tight">Commission Operations</h1>
          <Badge variant="secondary">Demo</Badge>
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
      <Card className="border-primary/40 bg-gradient-to-b from-primary/5 to-transparent shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" aria-hidden />
                <CardTitle className="text-xl">Featured Deal</CardTitle>
              </div>
              <CardDescription className="mt-2">
                One example deal: who gets credit (roles), who earns what (entitlements), and when payouts run (trigger). Same logic for enterprise and community-style deals.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deal Status</span>
              <Badge variant={getStatusVariant(featured.status)}>{featured.status}</Badge>
              <Button type="button" variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Invite participant
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={markContractPaid}
                disabled={featured.status === 'Approved' || featured.status === 'Paid'}
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
          </div>

          <div className="rounded-lg border bg-background/60 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Attributed roles</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Introducer</p>
                <p className="font-medium text-foreground">{featured.introducer}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Closer</p>
                <p className="font-medium text-foreground">{featured.closer}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-background/60 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Commission entitlements</p>
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
          </div>

          {participants.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Invited participants
                  </span>
                  <Badge variant="outline" className="font-medium border-primary/40 bg-background">
                    {featured.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Partner: {featured.partner}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Enrollment for this deal only. Participants approve through their invite link.
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
                    <TableHead>Approved at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/60"
                      onClick={() => toggleParticipant(p.id)}
                      title="Manual fallback toggle for demo"
                    >
                      <TableCell className="font-medium text-muted-foreground text-sm">
                        {p.dealName ?? featured.name}
                      </TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.email}</TableCell>
                      <TableCell>{p.role}</TableCell>
                      <TableCell>
                        {(() => {
                          const kindLabel =
                            COMMISSION_STRUCTURE_OPTIONS.find((o) => o.value === p.commissionKind)?.label ??
                            p.commissionKind;
                          const resolved = resolveParticipantCommissionUsd(
                            {
                              commissionKind: p.commissionKind,
                              commissionValue: p.commissionValue,
                              baseParticipant: p.baseParticipant,
                              formulaExpression: p.formulaExpression,
                            },
                            featured.dealValue
                          );
                          return (
                            <div className="space-y-0.5">
                              <span className="text-xs text-muted-foreground block">{kindLabel}</span>
                              <span className="font-medium tabular-nums">
                                ${resolved.total.toLocaleString()}
                              </span>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary KPIs — baseline + pipeline-derived where noted */}
      <div>
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
              Recent deals—enterprise partners and community or membership-style commissions. Click a settlement badge to advance{' '}
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
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal name</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Introducer</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Settlement state</TableHead>
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => (
                <TableRow key={deal.id}>
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
                  <TableCell>{deal.introducer}</TableCell>
                  <TableCell>{deal.closer}</TableCell>
                  <TableCell className="text-right font-medium">${deal.commission.toLocaleString()}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="inline-flex cursor-pointer rounded-full border-0 bg-transparent p-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      onClick={() => advanceDealStatus(deal.id)}
                      title="Advance: Pending → Eligible → Approved → Paid"
                    >
                      <Badge variant={getStatusVariant(deal.status)}>{deal.status}</Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(deal.lastUpdated).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
            <CardTitle className="text-base">Attributed roles (default split)</CardTitle>
            <CardDescription>
              Who gets what share of each commission—introducer, connector, closer, platform. Configurable per program.
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

      <CreateDealModal open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreateDeal} />
      <InviteParticipantModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={handleInviteParticipant}
        featuredDealValue={featured.dealValue}
      />
      <ExportPayoutsModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        rows={exportData.rows}
        excludedUnapprovedCount={exportData.excludedUnapprovedCount}
      />
    </div>
  );
}
