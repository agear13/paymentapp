'use client';

import * as React from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';
import { useOrganizationCurrency } from '@/hooks/use-organization-currency';
import { formatPayoutCurrency } from '@/lib/payouts/format-payout-currency';
import { PAYOUT_TRUST_COPY } from '@/lib/payouts/payout-trust-copy';
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
import { toast } from 'sonner';
import {
  PAYOUTS_OBLIGATIONS_HREF,
  PAYOUTS_SETTLEMENTS_HREF,
} from '@/lib/navigation/operator-nav';
import { PayoutEmptyState } from '@/components/payouts/payout-empty-state';
import { OperationalActivitySection } from '@/components/operations/operational-activity-section';
import type { PayoutEmptyIconVariant } from '@/components/payouts/payout-empty-state';
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

type SectionEmphasis = 'primary' | 'caution' | 'muted' | 'default';

type OperationalSection = {
  id: string;
  title: string;
  description: string;
  rows: PilotObligation[];
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
  emptyIcon: PayoutEmptyIconVariant;
  emphasis: SectionEmphasis;
};

function sectionSpacing(emphasis: SectionEmphasis): string {
  switch (emphasis) {
    case 'primary':
      return 'pb-8 mb-2 border-b border-emerald-500/15';
    case 'caution':
      return 'pb-6';
    case 'muted':
      return 'pb-4 opacity-75';
    default:
      return 'pb-6';
  }
}

function OperationalSectionBlock({
  section,
  orgCurrency,
}: {
  section: OperationalSection;
  orgCurrency: string;
}) {
  const titleClass = cn(
    section.emphasis === 'primary' && 'text-xl font-semibold tracking-tight',
    section.emphasis === 'caution' && 'text-base font-semibold',
    section.emphasis === 'muted' && 'text-sm font-medium text-muted-foreground',
    section.emphasis === 'default' && 'text-base font-semibold'
  );

  return (
    <section id={section.id} className={sectionSpacing(section.emphasis)}>
      <div className="mb-3">
        <h2 className={titleClass}>
          {section.title}
          <span className="font-normal ml-2 tabular-nums text-muted-foreground">
            ({section.rows.length})
          </span>
        </h2>
        <p
          className={cn(
            'mt-0.5',
            section.emphasis === 'muted' ? 'text-xs text-muted-foreground/70' : 'text-sm text-muted-foreground'
          )}
        >
          {section.description}
        </p>
        {section.emphasis === 'primary' && section.rows.length > 0 ? (
          <Button size="sm" className="mt-3 h-8" asChild>
            <Link href={PAYOUTS_SETTLEMENTS_HREF}>Create release batch</Link>
          </Button>
        ) : null}
      </div>
      {section.rows.length === 0 ? (
        <PayoutEmptyState
          iconVariant={section.emptyIcon}
          title={section.emptyTitle}
          description={section.emptyDescription}
          action={section.emptyAction}
        />
      ) : (
        <ul className="divide-y divide-border/20">
          {section.rows.slice(0, 12).map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-4 py-3 text-sm transition-colors hover:bg-muted/15 -mx-2 px-2 rounded-md"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {row.participant?.name ?? row.deal?.name ?? '—'}
                </p>
                <p className="text-muted-foreground/80 text-xs truncate">
                  {row.deal?.name ?? row.deal_id}
                </p>
              </div>
              <span className="shrink-0 tabular-nums font-semibold">
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
          {section.rows.length > 12 ? (
            <li className="py-2 text-xs text-muted-foreground">
              +{section.rows.length - 12} more —{' '}
              <Link
                href={PAYOUTS_OBLIGATIONS_HREF}
                className="text-primary underline-offset-2 hover:underline"
              >
                View in Obligations
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </section>
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
      if (!pilotRes.ok) throw new Error(pilotJson.error || 'Failed to load earnings');
      setPilotRows(pilotJson.data ?? []);

      if (orgRes) {
        const orgJson = await orgRes.json();
        if (!orgRes.ok) throw new Error(orgJson.error || 'Failed to load referral earnings');
        setOrgPosted(orgJson.data ?? []);
      } else {
        setOrgPosted([]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load participant earnings');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const reviewObligationsBtn = (
    <Button variant="outline" size="sm" asChild>
      <Link href={PAYOUTS_OBLIGATIONS_HREF}>Review obligations</Link>
    </Button>
  );

  const sections: OperationalSection[] = [
    {
      id: 'ready-for-release',
      title: 'Ready for release',
      description: 'Eligible to include in the next release batch.',
      rows: pilotRows.filter((r) => r.status === 'AVAILABLE_FOR_PAYOUT'),
      emptyTitle: 'No payouts ready for release',
      emptyDescription:
        'Eligible participant payouts will appear here once funding and approvals are complete.',
      emptyAction: reviewObligationsBtn,
      emptyIcon: 'release',
      emphasis: 'primary',
    },
    {
      id: 'needs-funding',
      title: 'Needs funding',
      description: 'Earnings waiting on project funding or payout approval.',
      rows: pilotRows.filter((r) =>
        ['DRAFT', 'UNFUNDED', 'PARTIALLY_FUNDED', 'PENDING_APPROVAL'].includes(r.status)
      ),
      emptyTitle: 'No funding tasks right now',
      emptyDescription:
        'Funding tasks will appear once customer payments or obligations are created.',
      emptyIcon: 'funding',
      emphasis: 'caution',
    },
    {
      id: 'awaiting-onboarding',
      title: 'Awaiting participant setup',
      description: 'Approved participants completing payout setup.',
      rows: pilotRows.filter(
        (r) =>
          r.status === 'APPROVED' &&
          r.participant?.onboardingStatus &&
          r.participant.onboardingStatus !== 'Complete'
      ),
      emptyTitle: 'No participants awaiting setup',
      emptyDescription:
        'Participants who need to finish payout setup will appear here after approval.',
      emptyIcon: 'participant',
      emphasis: 'default',
    },
    {
      id: 'recently-released',
      title: 'Recently released',
      description: 'Participant payouts from completed release batches.',
      rows: pilotRows.filter((r) => r.status === 'PAID').slice(0, 25),
      emptyTitle: 'No recent releases',
      emptyDescription:
        'Released participant payouts will appear here once release batches are completed.',
      emptyIcon: 'history',
      emphasis: 'muted',
    },
  ];

  if (isOrgLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Participant earnings</h1>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Participant earnings</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Track what participants have earned and what is ready for payout release.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            {PAYOUT_TRUST_COPY.traceableAfterRelease}
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
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

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="space-y-2">
          {sections.map((section) => (
            <OperationalSectionBlock
              key={section.id}
              section={section}
              orgCurrency={orgCurrency}
            />
          ))}
        </div>
      )}

      <section className="space-y-3 pt-8 mt-4 border-t border-border/20 opacity-70">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
            Referral earnings history
          </h2>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Archive — recorded referral earnings from customer payments.
          </p>
        </div>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : orgPosted.length === 0 ? (
          <PayoutEmptyState
            iconVariant="earnings"
            title="No referral earnings yet"
            description="Referral earnings will appear here after attributed customer payments are processed."
          />
        ) : (
          <div className="overflow-x-auto -mx-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/15">
                  <TableHead className="text-xs text-muted-foreground">Date</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Referral</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Invoice</TableHead>
                  <TableHead className="text-right text-xs text-muted-foreground">Amount</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgPosted.map((o) => (
                  <TableRow
                    key={o.id}
                    className="border-b border-border/10 [&>td]:py-2.5 text-muted-foreground"
                  >
                    <TableCell className="text-xs">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono text-[11px]">{o.referralCode}</TableCell>
                    <TableCell className="text-xs">
                      {o.shortCode ? `#${o.shortCode}` : o.paymentLinkId.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-foreground/80">
                      {formatPayoutCurrency(
                        o.consultantAmount + o.bdPartnerAmount,
                        o.currency,
                        orgCurrency
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-normal opacity-80">
                        {o.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <OperationalActivitySection
        title="Participant payout activity"
        emptyMessage="Earnings configuration, obligations, and release events appear here."
        defaultOpen={false}
      />
    </div>
  );
}
