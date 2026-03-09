'use client';

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
} from 'lucide-react';
import {
  dealNetworkSummary,
  featuredDeal,
  recentDeals,
  commissionFunnelStages,
  attributionBreakdown,
  topEarners,
  payoutRails,
} from '@/lib/data/mock-deal-network';
import type { DealStatus } from '@/lib/data/mock-deal-network';

function getStatusVariant(status: DealStatus): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'outline' {
  switch (status) {
    case 'Paid':
      return 'success';
    case 'Pending':
      return 'warning';
    case 'Eligible':
      return 'info';
    case 'Reversed':
      return 'destructive';
    case 'In Review':
      return 'secondary';
    default:
      return 'outline';
  }
}

export default function DealNetworkPage() {
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
      </div>

      {/* Featured Deal — visual centerpiece */}
      <Card className="border-primary/40 bg-gradient-to-b from-primary/5 to-transparent shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
              <CardTitle className="text-xl">Featured Deal</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deal Status</span>
              <Badge variant={getStatusVariant(featuredDeal.status)}>{featuredDeal.status}</Badge>
            </div>
          </div>
          <CardDescription>
            One example deal: who gets credit (roles), who earns what (entitlements), and when payouts run (trigger). Same logic for enterprise and community-style deals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Deal details — grouped */}
          <div className="rounded-lg border bg-background/60 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Deal details</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deal</p>
                <p className="font-semibold text-foreground">{featuredDeal.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deal value</p>
                <p className="font-semibold text-foreground">${featuredDeal.dealValue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payout trigger</p>
                <p className="font-semibold text-foreground">{featuredDeal.payoutTrigger}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Partner</p>
                <p className="font-semibold text-foreground">{featuredDeal.partner}</p>
              </div>
            </div>
          </div>

          {/* Attributed roles — grouped */}
          <div className="rounded-lg border bg-background/60 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Attributed roles</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Introducer</p>
                <p className="font-medium text-foreground">{featuredDeal.introducer}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Closer</p>
                <p className="font-medium text-foreground">{featuredDeal.closer}</p>
              </div>
            </div>
          </div>

          {/* Commission entitlements — grouped */}
          <div className="rounded-lg border bg-background/60 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Commission entitlements</p>
            <div className="flex flex-wrap gap-3">
              {featuredDeal.commissionSplits.map((split) => (
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
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-3">Network summary</h2>
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
              <div className="text-2xl font-bold">
                ${(dealNetworkSummary.commissionsPending / 1000).toFixed(0)}k
              </div>
              <p className="text-xs text-muted-foreground">Awaiting payout trigger</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commissions paid</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(dealNetworkSummary.commissionsPaid / 1_000_000).toFixed(1)}M
              </div>
              <p className="text-xs text-muted-foreground">Settled and paid</p>
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
              <div className="text-2xl font-bold">{dealNetworkSummary.openDeals}</div>
              <p className="text-xs text-muted-foreground">In pipeline</p>
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

      {/* Recent Deals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Deal pipeline</CardTitle>
          <CardDescription>
            Recent deals—enterprise partners and community or membership-style commissions. Each row shows who introduced, who closed, the commission amount, and current payout state.
          </CardDescription>
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
              {recentDeals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell className="font-medium">{deal.dealName}</TableCell>
                  <TableCell>{deal.partner}</TableCell>
                  <TableCell className="text-right">
                    ${deal.value.toLocaleString()}
                  </TableCell>
                  <TableCell>{deal.introducer}</TableCell>
                  <TableCell>{deal.closer}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${deal.commission.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(deal.status)}>{deal.status}</Badge>
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

      {/* Secondary: Settlement funnel, attribution, top earners, payout rails */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Settlement state funnel</CardTitle>
            <CardDescription>
              Where deals sit in the payout lifecycle: pending → eligible → approved → paid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {commissionFunnelStages.map((stage) => (
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
              Role-based share of commission entitlements. Configurable per program.
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
              {topEarners.map((earner) => (
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
                    {rail.count} partners · Last {new Date(rail.lastUsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
