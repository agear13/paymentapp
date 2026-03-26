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
  contactPerson: string;
  participant: string;
  email: string;
  role: string;
  commissionStructure: string;
  payoutAmount: number;
  approvalStatus: 'Pending approval' | 'Approved' | 'Not required';
  settlementStatus: DealStatus;
  contractPaidStatus: 'Contract Unpaid' | 'Contract Paid';
  payoutTrigger: string;
  paymentStatus: 'Not Paid' | 'Paid';
  paidAmount?: number;
  paidAt?: string;
  lastUpdated: string;
  approvedAt?: string;
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
    'Contact Person',
    'Participant',
    'Email',
    'Role',
    'Commission Structure',
    'Calculated Payout Amount',
    'Approval Status',
    'Settlement Status',
    'Deal Trigger Status / Contract Paid Status',
    'Payout Trigger',
    'Payment Status',
    'Paid Amount',
    'Paid At',
    'Last Updated',
    'Approved At',
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
        esc(r.contactPerson),
        esc(r.participant),
        esc(r.email),
        esc(r.role),
        esc(r.commissionStructure),
        String(r.payoutAmount),
        esc(r.approvalStatus),
        esc(r.settlementStatus),
        esc(r.contractPaidStatus),
        esc(r.payoutTrigger),
        esc(r.paymentStatus),
        String(r.paidAmount ?? ''),
        esc(r.paidAt ?? ''),
        esc(r.lastUpdated),
        esc(r.approvedAt ?? ''),
      ].join(',')
    );
  }
  return lines.join('\r\n');
}

export interface ExportPayoutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ExportPayoutRow[];
  excludedUnapprovedCount?: number;
}

export function ExportPayoutsModal({
  open,
  onOpenChange,
  rows,
  excludedUnapprovedCount = 0,
}: ExportPayoutsModalProps) {
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
          {excludedUnapprovedCount > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {excludedUnapprovedCount} unapproved participant line item(s) excluded from payout export.
            </p>
          ) : null}
        </DialogHeader>
        <div className="overflow-auto rounded-md border flex-1 min-h-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="whitespace-nowrap">Deal name</TableHead>
                <TableHead className="whitespace-nowrap">Partner</TableHead>
                <TableHead className="whitespace-nowrap">Contact person</TableHead>
                <TableHead className="whitespace-nowrap">Participant</TableHead>
                <TableHead className="whitespace-nowrap">Email</TableHead>
                <TableHead className="whitespace-nowrap">Role</TableHead>
                <TableHead className="whitespace-nowrap">Commission structure</TableHead>
                <TableHead className="text-right whitespace-nowrap">Calculated payout</TableHead>
                <TableHead className="whitespace-nowrap">Approval status</TableHead>
                <TableHead className="whitespace-nowrap">Settlement status</TableHead>
                <TableHead className="whitespace-nowrap">Contract paid status</TableHead>
                <TableHead className="whitespace-nowrap">Payout trigger</TableHead>
                <TableHead className="whitespace-nowrap">Payment status</TableHead>
                <TableHead className="text-right whitespace-nowrap">Paid amount</TableHead>
                <TableHead className="whitespace-nowrap">Paid at</TableHead>
                <TableHead className="whitespace-nowrap">Last updated</TableHead>
                <TableHead className="whitespace-nowrap">Approved at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={17} className="text-center text-muted-foreground py-8">
                    No rows to export yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={`${r.dealName}-${r.participant}-${r.role}-${i}`}>
                    <TableCell className="font-medium align-top">{r.dealName}</TableCell>
                    <TableCell className="align-top">{r.partner}</TableCell>
                    <TableCell className="align-top">{r.contactPerson}</TableCell>
                    <TableCell className="align-top">{r.participant}</TableCell>
                    <TableCell className="align-top text-muted-foreground text-sm">
                      {r.email?.trim() ? r.email : '—'}
                    </TableCell>
                    <TableCell className="align-top">{r.role}</TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">{r.commissionStructure}</TableCell>
                    <TableCell className="text-right font-mono text-sm align-top">
                      ${r.payoutAmount.toLocaleString()}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge
                        variant={
                          r.approvalStatus === 'Approved'
                            ? 'success'
                            : r.approvalStatus === 'Pending approval'
                              ? 'warning'
                              : 'outline'
                        }
                      >
                        {r.approvalStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={getStatusVariant(r.settlementStatus)}>{r.settlementStatus}</Badge>
                    </TableCell>
                    <TableCell className="align-top">{r.contractPaidStatus}</TableCell>
                    <TableCell className="text-sm align-top">{r.payoutTrigger}</TableCell>
                    <TableCell className="align-top">
                      <Badge variant={r.paymentStatus === 'Paid' ? 'success' : 'outline'}>
                        {r.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm align-top">
                      {typeof r.paidAmount === 'number' ? `$${r.paidAmount.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap align-top">
                      {r.paidAt ?? '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap align-top">
                      {r.lastUpdated}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap align-top">
                      {r.approvedAt ?? '-'}
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

export function buildExportPayoutRows(
  deals: RecentDeal[],
  participants: DemoParticipant[]
): { rows: ExportPayoutRow[]; excludedUnapprovedCount: number } {
  const out: ExportPayoutRow[] = [];
  let excludedUnapprovedCount = 0;
  const dealById = new Map(deals.map((d) => [d.id, d]));
  const dealByName = new Map(deals.map((d) => [d.dealName, d]));

  for (const deal of deals) {
    const dealIsPaid = deal.status === 'Approved' || deal.status === 'Paid';
    const settlementStatus = deal.status ?? 'Pending';
    const payoutTrigger = deal.payoutTrigger ?? 'Manual';
    const lu = formatExportDate(deal.lastUpdated);
    const paymentStatus = deal.paymentStatus ?? 'Not Paid';
    const paidAt = deal.paidAt ? formatExportDate(deal.paidAt) : undefined;
    const contractPaidStatus = dealIsPaid ? 'Contract Paid' : 'Contract Unpaid';

    const contactPerson = deal.rhContactLine?.split(' — ')[0] ?? '-';

    const platformFee = deal.platformFee ?? 0;
    out.push({
      dealName: deal.dealName,
      partner: deal.partner,
      contactPerson,
      participant: 'Rabbit Hole Platform',
      email: '',
      role: 'Platform',
      commissionStructure: `Fixed commission pool: $${platformFee.toLocaleString()}`,
      payoutAmount: platformFee,
      approvalStatus: 'Not required',
      settlementStatus,
      contractPaidStatus,
      payoutTrigger,
      paymentStatus,
      paidAmount: deal.paidAmount,
      paidAt,
      lastUpdated: lu,
      approvedAt: undefined,
    });
  }

  for (const p of participants) {
    const deal =
      (p.dealId ? dealById.get(p.dealId) : undefined) ??
      (p.dealName ? dealByName.get(p.dealName) : undefined);
    if (!deal) continue;

    const dealIsPaid = deal.status === 'Approved' || deal.status === 'Paid';
    const settlementStatus = deal.status ?? 'Pending';
    const payoutTrigger = deal.payoutTrigger ?? 'Manual';
    const lu = formatExportDate(deal.lastUpdated);
    const paymentStatus = deal.paymentStatus ?? 'Not Paid';
    const paidAt = deal.paidAt ? formatExportDate(deal.paidAt) : undefined;
    const contractPaidStatus = dealIsPaid ? 'Contract Paid' : 'Contract Unpaid';

    const resolved = resolveParticipantCommissionUsd(
      {
        commissionKind: p.commissionKind,
        commissionValue: p.commissionValue,
        baseParticipant: p.baseParticipant,
        formulaExpression: p.formulaExpression,
      },
      deal.value,
      {
        Introducer: deal.introducerAmount,
        Closer: deal.closerAmount,
        Platform: deal.platformFee,
      }
    );

    out.push({
      dealName: deal.dealName,
      partner: deal.partner,
      contactPerson: deal.rhContactLine?.split(' — ')[0] ?? '-',
      participant: p.name,
      email: p.email?.trim() ?? '',
      role: p.role,
      commissionStructure: resolved.previewLine,
      payoutAmount: resolved.total,
      approvalStatus: p.approvalStatus,
      settlementStatus,
      contractPaidStatus,
      payoutTrigger,
      paymentStatus,
      paidAmount: deal.paidAmount,
      paidAt,
      lastUpdated: lu,
      approvedAt: p.approvedAt ? formatExportDate(p.approvedAt) : undefined,
    });
  }

  return { rows: out, excludedUnapprovedCount };
}
