'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import type { DealStatus, RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { resolveParticipantCommissionUsd } from '@/lib/deal-network-demo/commission-structure';

export interface ExportPayoutRow {
  dealName: string;
  partner: string;
  participant: string;
  role: string;
  commissionAmount: number;
  settlementStatus: DealStatus;
  payoutTrigger: string;
  lastUpdated: string;
}

function formatExportDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

function rowsToCsv(rows: ExportPayoutRow[]): string {
  const header = [
    'Deal Name',
    'Partner',
    'Participant',
    'Role',
    'Commission Amount',
    'Settlement Status',
    'Payout Trigger',
    'Last Updated',
  ];
  const lines = [header.join(',')];
  const esc = (s: string) =>
    s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  for (const r of rows) {
    lines.push(
      [
        esc(r.dealName),
        esc(r.partner),
        esc(r.participant),
        esc(r.role),
        String(r.commissionAmount),
        esc(r.settlementStatus),
        esc(r.payoutTrigger),
        esc(r.lastUpdated),
      ].join(',')
    );
  }
  return lines.join('\r\n');
}

export interface ExportPayoutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ExportPayoutRow[];
}

export function ExportPayoutsModal({ open, onOpenChange, rows }: ExportPayoutsModalProps) {
  function downloadCsv() {
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `provvypay-payout-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] lg:max-w-6xl max-h-[85vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Export payouts</DialogTitle>
          <DialogDescription>
            Accounting-ready extract: deal, partner, participant line items, settlement status, and
            payout trigger. Download CSV for CFO / controller review.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto rounded-md border flex-1 min-h-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="whitespace-nowrap">Deal name</TableHead>
                <TableHead className="whitespace-nowrap">Partner</TableHead>
                <TableHead className="whitespace-nowrap">Participant</TableHead>
                <TableHead className="whitespace-nowrap">Role</TableHead>
                <TableHead className="text-right whitespace-nowrap">Commission amount</TableHead>
                <TableHead className="whitespace-nowrap">Settlement status</TableHead>
                <TableHead className="whitespace-nowrap">Payout trigger</TableHead>
                <TableHead className="whitespace-nowrap">Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No rows to export yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={`${r.dealName}-${r.participant}-${r.role}-${i}`}>
                    <TableCell className="font-medium align-top">{r.dealName}</TableCell>
                    <TableCell className="align-top">{r.partner}</TableCell>
                    <TableCell className="align-top">{r.participant}</TableCell>
                    <TableCell className="align-top">{r.role}</TableCell>
                    <TableCell className="text-right font-mono text-sm align-top">
                      ${r.commissionAmount.toLocaleString()}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={getStatusVariant(r.settlementStatus)}>{r.settlementStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-sm align-top">{r.payoutTrigger}</TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap align-top">
                      {r.lastUpdated}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={downloadCsv} disabled={rows.length === 0}>
            Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface FeaturedContext {
  name: string;
  partner: string;
  payoutTrigger: string;
  dealValue: number;
}

/**
 * Builds export rows: introducer/closer split per deal, plus invited participant lines for the featured deal.
 */
export function buildExportPayoutRows(
  deals: RecentDeal[],
  participants: DemoParticipant[],
  featured: FeaturedContext
): ExportPayoutRow[] {
  const out: ExportPayoutRow[] = [];
  const dealByName = new Map(deals.map((d) => [d.dealName, d]));

  for (const d of deals) {
    const half = Math.round(d.commission / 2);
    const rest = d.commission - half;
    const pt = d.payoutTrigger ?? 'Contract Paid';
    const lu = formatExportDate(d.lastUpdated);
    out.push({
      dealName: d.dealName,
      partner: d.partner,
      participant: d.introducer,
      role: 'Introducer',
      commissionAmount: half,
      settlementStatus: d.status,
      payoutTrigger: pt,
      lastUpdated: lu,
    });
    out.push({
      dealName: d.dealName,
      partner: d.partner,
      participant: d.closer,
      role: 'Closer',
      commissionAmount: rest,
      settlementStatus: d.status,
      payoutTrigger: pt,
      lastUpdated: lu,
    });
  }

  for (const p of participants) {
    const dealName = p.dealName ?? featured.name;
    const partner = p.partner ?? featured.partner;
    const deal = dealByName.get(dealName);
    const settlement = deal?.status ?? 'Pending';
    const pt = deal?.payoutTrigger ?? featured.payoutTrigger;
    const lu = deal ? formatExportDate(deal.lastUpdated) : formatExportDate(new Date().toISOString());
    const { total: amt } = resolveParticipantCommissionUsd(
      {
        commissionKind: p.commissionKind,
        commissionValue: p.commissionValue,
        baseParticipant: p.baseParticipant,
        formulaExpression: p.formulaExpression,
      },
      featured.dealValue
    );

    out.push({
      dealName,
      partner,
      participant: p.name,
      role: `${p.role} (invite)`,
      commissionAmount: amt,
      settlementStatus: settlement,
      payoutTrigger: pt,
      lastUpdated: lu,
    });
  }

  return out;
}
