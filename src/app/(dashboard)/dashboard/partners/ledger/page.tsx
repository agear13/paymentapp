'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { FileText, ExternalLink } from 'lucide-react';
import { mockLedgerEntries, type LedgerEntry } from '@/lib/data/mock-partners';

export default function PartnerLedgerPage() {
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleRowClick = (entry: LedgerEntry) => {
    setSelectedEntry(entry);
    setDialogOpen(true);
  };

  const totalPending = mockLedgerEntries
    .filter(e => e.status === 'Pending')
    .reduce((sum, e) => sum + e.earningsAmount, 0);

  const totalPaid = mockLedgerEntries
    .filter(e => e.status === 'Paid')
    .reduce((sum, e) => sum + e.earningsAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Earnings Ledger</h1>
        <p className="text-muted-foreground">
          Detailed transaction history of all revenue share allocations
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockLedgerEntries.length}</div>
            <p className="text-xs text-muted-foreground">Allocation records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting payout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Successfully paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Click on any row to view detailed transaction information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Source Type</TableHead>
                <TableHead className="text-right">Gross Amount</TableHead>
                <TableHead className="text-center">Rate</TableHead>
                <TableHead className="text-right">Earnings</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLedgerEntries.map((entry) => (
                <TableRow
                  key={entry.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(entry)}
                >
                  <TableCell>
                    {new Date(entry.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className="font-medium">{entry.source}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{entry.sourceType}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{entry.transactionType}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    ${entry.grossAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-center">{entry.allocationRate}%</TableCell>
                  <TableCell className="text-right font-medium">
                    ${entry.earningsAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        entry.status === 'Paid'
                          ? 'success'
                          : entry.status === 'Pending'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {entry.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transaction Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              Complete information for this ledger entry
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Transaction ID</p>
                  <p className="text-sm font-mono">{selectedEntry.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date</p>
                  <p className="text-sm">
                    {new Date(selectedEntry.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Source Entity</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{selectedEntry.source}</p>
                  <Badge variant="outline">{selectedEntry.sourceType}</Badge>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Transaction Source Type</p>
                <Badge variant="secondary">{selectedEntry.transactionType}</Badge>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Revenue Allocation</p>
                
                <div className="flex items-center justify-between">
                  <p className="text-sm">Gross Payment Amount</p>
                  <p className="text-sm font-medium">
                    ${selectedEntry.grossAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm">Revenue Share Rate</p>
                  <p className="text-sm font-medium">{selectedEntry.allocationRate}%</p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Your Earnings</p>
                  <p className="text-lg font-bold text-primary">
                    ${selectedEntry.earningsAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge
                    variant={
                      selectedEntry.status === 'Paid'
                        ? 'success'
                        : selectedEntry.status === 'Pending'
                        ? 'secondary'
                        : 'outline'
                    }
                    className="mt-1"
                  >
                    {selectedEntry.status}
                  </Badge>
                </div>
                {selectedEntry.payoutId && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Payout ID</p>
                    <p className="text-sm font-mono mt-1">{selectedEntry.payoutId}</p>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <Button variant="outline" className="w-full" asChild>
                  <a href={`/dashboard/partners/payouts?highlight=${selectedEntry.payoutId || ''}`}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Related Payout
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

