'use client';

import * as React from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';
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
import { toast } from 'sonner';
import { PAYOUTS_OBLIGATIONS_HREF } from '@/lib/navigation/operator-nav';

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

function money(amount: string | number, currency: string) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${currency} ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
}

function ObligationSection({
  title,
  description,
  rows,
  emptyLabel,
}: {
  title: string;
  description: string;
  rows: PilotObligation[];
  emptyLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">{emptyLabel}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.deal?.name ?? row.deal_id}
                  </TableCell>
                  <TableCell>{row.participant?.name ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.obligation_type}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {money(row.amount_owed, row.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.status.replace(/_/g, ' ')}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function OperatorCommissionsWorkspace() {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
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
      if (!pilotRes.ok) throw new Error(pilotJson.error || 'Failed to load allocations');
      setPilotRows(pilotJson.data ?? []);

      if (orgRes) {
        const orgJson = await orgRes.json();
        if (!orgRes.ok) throw new Error(orgJson.error || 'Failed to load posted commissions');
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

  const pending = pilotRows.filter((r) =>
    ['DRAFT', 'UNFUNDED', 'PARTIALLY_FUNDED', 'PENDING_APPROVAL'].includes(r.status)
  );
  const awaitingOnboarding = pilotRows.filter(
    (r) =>
      r.status === 'APPROVED' &&
      r.participant?.onboardingStatus &&
      r.participant.onboardingStatus !== 'Complete'
  );
  const ready = pilotRows.filter((r) =>
    ['AVAILABLE_FOR_PAYOUT', 'APPROVED'].includes(r.status)
  );
  const settled = pilotRows.filter((r) => ['PAID', 'REVERSED'].includes(r.status));

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
            Commission allocation and accrual across projects: earned amounts, payout eligibility,
            and attribution-linked obligations.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void fetchAll()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Button variant="outline" size="sm" asChild>
          <Link href={PAYOUTS_OBLIGATIONS_HREF}>Review obligations</Link>
        </Button>
      </div>

      <ObligationSection
        title="Pending allocations"
        description="Accrued commission lines waiting on funding, approval, or project linkage."
        rows={pending}
        emptyLabel="No pending allocations."
      />

      <ObligationSection
        title="Awaiting payout onboarding"
        description="Approved participants who still need payout profile completion before release."
        rows={awaitingOnboarding}
        emptyLabel="No participants awaiting payout onboarding."
      />

      <ObligationSection
        title="Ready for settlement"
        description="Allocations cleared for payout coordination and batch release."
        rows={ready}
        emptyLabel="Nothing ready for settlement yet."
      />

      <ObligationSection
        title="Recently settled"
        description="Paid or reversed commission allocations from recent treasury activity."
        rows={settled.slice(0, 25)}
        emptyLabel="No recent settlements."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attribution activity (posted)</CardTitle>
          <CardDescription>
            Customer payments that posted commission obligations to the organizational ledger.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Loading…</p>
          ) : orgPosted.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No posted attribution commissions yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Referral</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Allocation</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell className="text-right font-medium">
                      {o.currency}{' '}
                      {(o.consultantAmount + o.bdPartnerAmount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{o.status}</Badge>
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
