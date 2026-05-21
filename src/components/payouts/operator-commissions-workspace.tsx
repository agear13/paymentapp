'use client';

import * as React from 'react';
import Link from 'next/link';
import { RefreshCw, ChevronDown, ArrowRight } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';
import { useOrganizationCurrency } from '@/hooks/use-organization-currency';
import { formatPayoutCurrency } from '@/lib/payouts/format-payout-currency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { PAYOUTS_OBLIGATIONS_HREF } from '@/lib/navigation/operator-nav';
import { cn } from '@/lib/utils';

type PilotObligation = {
  id: string;
  deal_id: string;
  participant_id: string | null;
  amount_owed: string | number;
  currency: string;
  status: string;
  obligation_type: string;
  deal?: { id: string; name: string; partner: string | null } | null;
  participant?: {
    id: string;
    name: string;
    role: string;
    onboardingStatus?: string;
    approvalStatus?: string;
  } | null;
};

type OrgCommission = {
  id: string;
  paymentLinkId: string;
  referralCode: string;
  consultantAmount: number;
  bdPartnerAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  shortCode?: string;
};

type PipelineStage = {
  id: string;
  title: string;
  description: string;
  rows: PilotObligation[];
  emptyLabel: string;
};

function PipelineStageCard({
  stage,
  orgCurrency,
  defaultOpen,
}: {
  stage: PipelineStage;
  orgCurrency: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen ?? stage.rows.length > 0);

  return (
    <Card className="flex flex-col h-full">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex w-full items-start justify-between gap-2 text-left">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold">{stage.title}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{stage.description}</CardDescription>
              <p className="text-muted-foreground text-xs mt-1 tabular-nums">
                {stage.rows.length} obligation{stage.rows.length === 1 ? '' : 's'}
              </p>
            </div>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
            />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {stage.rows.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-xs leading-relaxed">
                {stage.emptyLabel}
              </p>
            ) : (
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {stage.rows.slice(0, 8).map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs"
                  >
                    <span className="truncate font-medium">
                      {row.participant?.name ?? row.deal?.name ?? '—'}
                    </span>
                    <span className="shrink-0 tabular-nums font-medium">
                      {formatPayoutCurrency(
                        typeof row.amount_owed === 'string'
                          ? parseFloat(row.amount_owed)
                          : row.amount_owed,
                        row.currency,
                        orgCurrency
                      )}
                    </span>
                  </li>
                ))}
                {stage.rows.length > 8 ? (
                  <li className="text-muted-foreground text-center text-xs pt-1">
                    +{stage.rows.length - 8} more
                  </li>
                ) : null}
              </ul>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function OperatorCommissionsWorkspace() {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const { currency: orgCurrency } = useOrganizationCurrency();
  const [pilotRows, setPilotRows] = React.useState<PilotObligation[]>([]);
  const [orgPosted, setOrgPosted] = React.useState<OrgCommission[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const [pilotRes, orgRes] = await Promise.all([
        fetch('/api/deal-network-pilot/obligations'),
        organizationId
          ? fetch(
              `/api/commissions/obligations?organizationId=${organizationId}&status=POSTED`
            )
          : Promise.resolve(null),
      ]);
      const pilotJson = await pilotRes.json();
      if (!pilotRes.ok) throw new Error(pilotJson.error || 'Failed to load commissions');
      setPilotRows(pilotJson.data ?? []);

      if (orgRes) {
        const orgJson = await orgRes.json();
        if (!orgRes.ok) throw new Error(orgJson.error || 'Failed to load referral commissions');
        setOrgPosted(orgJson.data ?? []);
      } else {
        setOrgPosted([]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load commissions');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const stages: PipelineStage[] = [
    {
      id: 'pending',
      title: 'Pending allocations',
      description: 'Waiting on funding, approval, or project linkage.',
      rows: pilotRows.filter((r) =>
        ['DRAFT', 'UNFUNDED', 'PARTIALLY_FUNDED', 'PENDING_APPROVAL'].includes(r.status)
      ),
      emptyLabel:
        'Pending allocations will appear when customer payments create commission obligations.',
    },
    {
      id: 'onboarding',
      title: 'Awaiting onboarding',
      description: 'Approved participants completing payout setup.',
      rows: pilotRows.filter(
        (r) =>
          r.status === 'APPROVED' &&
          r.participant?.onboardingStatus &&
          r.participant.onboardingStatus !== 'Complete'
      ),
      emptyLabel:
        'Participants who need to finish payout onboarding will appear here after approval.',
    },
    {
      id: 'ready',
      title: 'Ready for payout',
      description: 'Cleared for inclusion in a release batch.',
      rows: pilotRows.filter((r) =>
        ['AVAILABLE_FOR_PAYOUT', 'APPROVED'].includes(r.status)
      ),
      emptyLabel:
        'Payout-ready obligations will appear here once funding and approvals are complete.',
    },
    {
      id: 'released',
      title: 'Released payouts',
      description: 'Recently settled participant payouts.',
      rows: pilotRows.filter((r) => ['PAID', 'REVERSED'].includes(r.status)).slice(0, 25),
      emptyLabel: 'Released payouts will appear here after settlement batches are completed.',
    },
  ];

  if (isOrgLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Commissions</h1>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Commissions</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Track participant earnings and payout readiness across your projects.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void fetchAll()}
                  disabled={loading}
                  aria-label="Refresh payout data"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh payout data</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Button variant="outline" size="sm" asChild>
          <Link href={PAYOUTS_OBLIGATIONS_HREF}>Review obligations</Link>
        </Button>
      </div>

      <div className="hidden lg:flex items-center justify-center gap-1 text-muted-foreground px-2">
        {stages.map((stage, i) => (
          <React.Fragment key={stage.id}>
            <span className="text-xs font-medium text-foreground">{stage.title}</span>
            {i < stages.length - 1 ? <ArrowRight className="h-3.5 w-3.5 mx-1" /> : null}
          </React.Fragment>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage, index) => (
          <PipelineStageCard
            key={stage.id}
            stage={stage}
            orgCurrency={orgCurrency}
            defaultOpen={index === 2}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referral commission activity</CardTitle>
          <CardDescription>
            Recorded referral commissions from attributed customer payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Loading…</p>
          ) : orgPosted.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-8 text-center text-sm">
              <p className="font-medium">No referral commissions yet</p>
              <p className="mt-1 text-muted-foreground">
                Referral commissions will appear here after customer payments are attributed.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Referral</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payout status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgPosted.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-xs">{o.referralCode}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.shortCode ? `#${o.shortCode}` : o.paymentLinkId.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatPayoutCurrency(
                        o.consultantAmount + o.bdPartnerAmount,
                        o.currency,
                        orgCurrency
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{o.status.replace(/_/g, ' ')}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
