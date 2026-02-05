'use client';

import { useState, ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface LedgerEntryDialogProps {
  entry: any;
  children: ReactNode;
}

export function LedgerEntryDialog({ entry, children }: LedgerEntryDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ledger Entry Details</DialogTitle>
          <DialogDescription>
            Complete information for this earnings entry
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Entry ID</p>
              <p className="text-sm font-mono truncate">{entry.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Date</p>
              <p className="text-sm">
                {new Date(entry.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
            <p className="text-sm">{entry.description || 'HuntPay conversion approved'}</p>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Source</p>
            <div className="flex items-center justify-between">
              <Badge variant="outline">{entry.source}</Badge>
              <p className="text-sm font-mono text-muted-foreground">Ref: {entry.source_ref}</p>
            </div>
          </div>

          {entry.partner_entities && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Partner Entity</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{entry.partner_entities.name}</p>
                  <Badge variant="secondary">{entry.partner_entities.entity_type}</Badge>
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Earnings Details</p>
            
            {entry.gross_amount && (
              <div className="flex items-center justify-between">
                <p className="text-sm">Gross Amount</p>
                <p className="text-sm font-medium">
                  {entry.currency} ${parseFloat(entry.gross_amount.toString()).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Earnings Amount</p>
              <p className="text-lg font-bold text-primary">
                {entry.currency} ${parseFloat(entry.earnings_amount.toString()).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Status</p>
            <Badge
              variant={
                entry.status === 'paid'
                  ? 'success'
                  : entry.status === 'pending'
                  ? 'secondary'
                  : 'outline'
              }
            >
              {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
            </Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
