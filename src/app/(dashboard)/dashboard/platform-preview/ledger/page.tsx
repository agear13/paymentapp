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
import {
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  CreditCard,
  Package,
  ExternalLink,
} from 'lucide-react';
import { unifiedLedgerRows } from '@/lib/data/mock-platform-preview';

export default function PlatformPreviewLedgerPage() {
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'Payment Received':
        return ArrowDownCircle;
      case 'Payout Settled':
        return ArrowUpCircle;
      case 'Refund':
        return RefreshCw;
      case 'Fee':
        return CreditCard;
      case 'Inventory Adjustment':
        return Package;
      default:
        return CreditCard;
    }
  };

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case 'Payment Received':
        return { variant: 'default' as const, className: 'bg-green-500/10 text-green-700 border-green-500/20' };
      case 'Payout Settled':
        return { variant: 'outline' as const, className: 'bg-blue-500/10 text-blue-700 border-blue-500/20' };
      case 'Refund':
        return { variant: 'secondary' as const, className: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' };
      case 'Fee':
        return { variant: 'outline' as const, className: 'bg-red-500/10 text-red-700 border-red-500/20' };
      case 'Inventory Adjustment':
        return { variant: 'outline' as const, className: 'bg-purple-500/10 text-purple-700 border-purple-500/20' };
      default:
        return { variant: 'outline' as const, className: '' };
    }
  };

  const getSourceBadge = (sourceSystem: string) => {
    const colors: Record<string, string> = {
      POS: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
      Grab: 'bg-green-500/10 text-green-700 border-green-500/20',
      Stripe: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
      Xero: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
      Provvypay: 'bg-primary/10 text-primary border-primary/20',
    };
    return colors[sourceSystem] || 'bg-gray-500/10 text-gray-700 border-gray-500/20';
  };

  const selectedLedger = unifiedLedgerRows.find(row => row.id === selectedLedgerId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">Unified Ledger</h1>
            <Badge variant="secondary">Preview</Badge>
          </div>
          <p className="text-muted-foreground">
            A single audit trail across payments, fees, payouts, and inventory. (Preview)
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-dashed bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <CreditCard className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Unified Event Stream</h3>
              <p className="text-sm text-muted-foreground">
                Every economic event across your connected systems appears here in chronological order. This creates
                a complete audit trail for accounting, reconciliation, and compliance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardHeader>
          <CardTitle>Event Log</CardTitle>
          <CardDescription>
            All economic events from connected systems in unified chronological order
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Source System</TableHead>
                <TableHead>Reference ID</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Related Entity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unifiedLedgerRows.map((row) => {
                const EventIcon = getEventIcon(row.eventType);
                const eventBadge = getEventBadge(row.eventType);
                const sourceBadge = getSourceBadge(row.sourceSystem);

                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedLedgerId(row.id)}
                  >
                    <TableCell className="text-sm">
                      {new Date(row.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={eventBadge.variant} className={`flex items-center gap-1 w-fit ${eventBadge.className}`}>
                        <EventIcon className="h-3 w-3" />
                        {row.eventType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sourceBadge}>
                        {row.sourceSystem}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.referenceId}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.amount !== undefined ? (
                        <span
                          className={
                            row.amount > 0
                              ? 'text-green-600 font-semibold'
                              : row.amount < 0
                              ? 'text-red-600 font-semibold'
                              : ''
                          }
                        >
                          {row.amount > 0 ? '+' : ''}
                          {row.amount.toLocaleString('en-US', {
                            style: 'currency',
                            currency: row.currency,
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.relatedEntity}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLedgerId} onOpenChange={(open) => !open && setSelectedLedgerId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLedger && (() => {
                const EventIcon = getEventIcon(selectedLedger.eventType);
                return <EventIcon className="h-5 w-5" />;
              })()}
              Ledger Entry Details
            </DialogTitle>
            <DialogDescription>
              {selectedLedger && (
                <>
                  {new Date(selectedLedger.timestamp).toLocaleString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedLedger && (
            <div className="space-y-6 py-4">
              {/* Event Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Event Type</p>
                  <Badge variant={getEventBadge(selectedLedger.eventType).variant} className={getEventBadge(selectedLedger.eventType).className}>
                    {selectedLedger.eventType}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Source System</p>
                  <Badge variant="outline" className={getSourceBadge(selectedLedger.sourceSystem)}>
                    {selectedLedger.sourceSystem}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Reference ID</p>
                  <p className="font-mono text-sm">{selectedLedger.referenceId}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Currency</p>
                  <p className="font-semibold text-sm">{selectedLedger.currency}</p>
                </div>
              </div>

              {/* Amount */}
              {selectedLedger.amount !== undefined && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Amount</p>
                  <p
                    className={`text-3xl font-bold ${
                      selectedLedger.amount > 0
                        ? 'text-green-600'
                        : selectedLedger.amount < 0
                        ? 'text-red-600'
                        : ''
                    }`}
                  >
                    {selectedLedger.amount > 0 ? '+' : ''}
                    {selectedLedger.amount.toLocaleString('en-US', {
                      style: 'currency',
                      currency: selectedLedger.currency,
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}

              {/* Related Entity */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Related Entity</p>
                <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                  <span className="text-sm">{selectedLedger.relatedEntity}</span>
                  <Button variant="ghost" size="sm" disabled>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Event Context */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Event Context</p>
                <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
                  {selectedLedger.eventType === 'Payment Received' && (
                    <p>
                      Customer payment received through {selectedLedger.sourceSystem}. Funds will be settled
                      according to the payment processor&apos;s schedule.
                    </p>
                  )}
                  {selectedLedger.eventType === 'Payout Settled' && (
                    <p>
                      Partner payout successfully settled via Provvypay. Revenue share allocation completed and
                      transferred to partner account.
                    </p>
                  )}
                  {selectedLedger.eventType === 'Refund' && (
                    <p>
                      Customer refund processed. Original transaction reversed and funds returned to customer&apos;s
                      payment method.
                    </p>
                  )}
                  {selectedLedger.eventType === 'Fee' && (
                    <p>
                      Platform fee charged by {selectedLedger.sourceSystem}. Fees are deducted from gross sales
                      during settlement.
                    </p>
                  )}
                  {selectedLedger.eventType === 'Inventory Adjustment' && (
                    <p>
                      Inventory quantity adjusted in {selectedLedger.sourceSystem}. This affects on-hand estimates
                      and reorder calculations.
                    </p>
                  )}
                </div>
              </div>

              {/* Related Links */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Related Links (Preview)</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled className="flex-1">
                    View in {selectedLedger.sourceSystem}
                  </Button>
                  {selectedLedger.eventType !== 'Inventory Adjustment' && (
                    <Button variant="outline" size="sm" disabled className="flex-1">
                      View Transaction
                    </Button>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t flex justify-end">
                <Button variant="outline" onClick={() => setSelectedLedgerId(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

