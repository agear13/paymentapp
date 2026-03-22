'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

const COMMISSION_POOL_PCT = 0.2;

export interface CreateDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (deal: RecentDeal) => void;
}

export function CreateDealModal({ open, onOpenChange, onCreate }: CreateDealModalProps) {
  const [dealName, setDealName] = React.useState('');
  const [partner, setPartner] = React.useState('');
  const [dealValue, setDealValue] = React.useState('');
  const [payoutTrigger, setPayoutTrigger] = React.useState('Contract Signed');
  const [introducer, setIntroducer] = React.useState('');
  const [closer, setCloser] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      setDealName('');
      setPartner('');
      setDealValue('');
      setPayoutTrigger('Contract Signed');
      setIntroducer('');
      setCloser('');
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(dealValue.replace(/,/g, ''));
    if (!dealName.trim() || !partner.trim() || Number.isNaN(value) || value <= 0) return;
    if (!introducer.trim() || !closer.trim()) return;

    const commission = Math.round(value * COMMISSION_POOL_PCT);
    const newDeal: RecentDeal = {
      id: `demo-${Date.now()}`,
      dealName: dealName.trim(),
      partner: partner.trim(),
      value,
      introducer: introducer.trim(),
      closer: closer.trim(),
      commission,
      status: 'Pending',
      lastUpdated: new Date().toISOString(),
      payoutTrigger,
    };
    onCreate(newDeal);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create deal</DialogTitle>
          <DialogDescription>
            Demo only — adds a row to the pipeline. Commission pool defaults to 20% of deal value.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dn-deal-name">Deal name</Label>
            <Input
              id="dn-deal-name"
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
              placeholder="e.g. Enterprise API Package"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dn-partner">Partner</Label>
            <Input
              id="dn-partner"
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
              placeholder="Partner organization"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dn-value">Deal value (USD)</Label>
            <Input
              id="dn-value"
              type="number"
              min={1}
              step={1}
              value={dealValue}
              onChange={(e) => setDealValue(e.target.value)}
              placeholder="100000"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Payout trigger</Label>
            <Select value={payoutTrigger} onValueChange={setPayoutTrigger}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Contract Signed">Contract Signed</SelectItem>
                <SelectItem value="Contract Paid">Contract Paid</SelectItem>
                <SelectItem value="Manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dn-intro">Introducer</Label>
            <Input
              id="dn-intro"
              value={introducer}
              onChange={(e) => setIntroducer(e.target.value)}
              placeholder="Name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dn-closer">Closer</Label>
            <Input
              id="dn-closer"
              value={closer}
              onChange={(e) => setCloser(e.target.value)}
              placeholder="Name"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add to pipeline</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
