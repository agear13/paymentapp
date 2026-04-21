'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

const PAYOUT_TRIGGER_MANUAL = 'Manual' as const;

export type CreateDealModalProjectProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (deal: RecentDeal) => void;
  editDeal?: RecentDeal | null;
};

export function CreateDealModalProject({
  open,
  onOpenChange,
  onCreate,
  editDeal,
}: CreateDealModalProjectProps) {
  const [dealName, setDealName] = React.useState('');
  const [projectDescription, setProjectDescription] = React.useState('');
  const [partnerName, setPartnerName] = React.useState('');
  const [dealValue, setDealValue] = React.useState('');
  const [linkedPaymentUrl, setLinkedPaymentUrl] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    if (!editDeal) {
      setDealName('');
      setProjectDescription('');
      setPartnerName('');
      setDealValue('');
      setLinkedPaymentUrl('');
      return;
    }
    setDealName(editDeal.dealName);
    setProjectDescription(editDeal.projectDescription ?? editDeal.latestUpdate ?? '');
    setPartnerName(editDeal.partner ?? '');
    setDealValue(String(editDeal.value));
    setLinkedPaymentUrl(editDeal.paymentLink ?? '');
  }, [open, editDeal]);

  const dealValueNum = parseFloat(dealValue.replace(/,/g, ''));
  const valueOk = !Number.isNaN(dealValueNum) && dealValueNum > 0;
  const canSubmit = Boolean(dealName.trim() && partnerName.trim() && valueOk);

  const isDirty = React.useMemo(() => {
    if (!open) return false;
    if (!editDeal) {
      return (
        dealName.trim() !== '' ||
        projectDescription.trim() !== '' ||
        partnerName.trim() !== '' ||
        dealValue.trim() !== '' ||
        linkedPaymentUrl.trim() !== ''
      );
    }
    return (
      dealName.trim() !== (editDeal.dealName ?? '').trim() ||
      projectDescription.trim() !== (editDeal.projectDescription ?? editDeal.latestUpdate ?? '').trim() ||
      partnerName.trim() !== (editDeal.partner ?? '').trim() ||
      dealValue.trim() !== String(editDeal.value) ||
      linkedPaymentUrl.trim() !== (editDeal.paymentLink ?? '').trim()
    );
  }, [open, editDeal, dealName, projectDescription, partnerName, dealValue, linkedPaymentUrl]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const now = new Date().toISOString();
    const next: RecentDeal = editDeal
      ? {
          ...editDeal,
          dealName: dealName.trim(),
          partner: partnerName.trim(),
          value: dealValueNum,
          lastUpdated: now,
          payoutTrigger: PAYOUT_TRIGGER_MANUAL,
          paymentLink: linkedPaymentUrl.trim() || undefined,
          projectDescription: projectDescription.trim() || undefined,
          projectValueCurrency: 'AUD',
          latestUpdate: projectDescription.trim() || undefined,
        }
      : {
          id: `demo-${Date.now()}`,
          dealName: dealName.trim(),
          partner: partnerName.trim(),
          value: dealValueNum,
          introducer: '',
          closer: '',
          status: 'Pending',
          lastUpdated: now,
          payoutTrigger: PAYOUT_TRIGGER_MANUAL,
          paymentLink: linkedPaymentUrl.trim() || undefined,
          paymentStatus: 'Not Paid',
          projectDescription: projectDescription.trim() || undefined,
          projectValueCurrency: 'AUD',
          latestUpdate: projectDescription.trim() || undefined,
        };
    onCreate(next);
    toast.success(editDeal ? 'Project updated' : 'Project created');
    onOpenChange(false);
  }

  function requestClose() {
    if (!isDirty) {
      onOpenChange(false);
      return;
    }
    if (window.confirm('Discard changes?')) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
          return;
        }
        requestClose();
      }}
    >
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] p-0 overflow-hidden flex flex-col gap-0 min-h-0"
        onInteractOutside={(e) => {
          e.preventDefault();
          requestClose();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          requestClose();
        }}
      >
        <DialogHeader className="px-6 pt-6 shrink-0">
          <DialogTitle>{editDeal ? 'Edit project' : 'Create project'}</DialogTitle>
          <DialogDescription>
            Name your project, optionally describe it, and paste a payment link when you have one. Referral roles
            stay stored in the background for compatibility but are not used in this mode.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col max-h-[min(90vh,calc(100vh-2rem))]">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
            <div className="space-y-2">
              <Label htmlFor="dn-proj-name">Project name</Label>
              <Input
                id="dn-proj-name"
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                placeholder="e.g. Strait Experiences — March cohort"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dn-proj-desc">Description (optional)</Label>
              <Textarea
                id="dn-proj-desc"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Scope, deliverables, or internal context."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dn-proj-partner">Counterparty / partner name</Label>
              <Input
                id="dn-proj-partner"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="Who the project is with"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dn-proj-value">Project value (AUD)</Label>
              <Input
                id="dn-proj-value"
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
              <Label htmlFor="dn-proj-pay">Linked payment (optional)</Label>
              <Input
                id="dn-proj-pay"
                type="url"
                inputMode="url"
                value={linkedPaymentUrl}
                onChange={(e) => setLinkedPaymentUrl(e.target.value)}
                placeholder="Paste payment link URL for later funding linkage"
              />
              <p className="text-xs text-muted-foreground">
                Stored on the project for when you connect inbound payments.
              </p>
            </div>
          </div>
          <div className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between gap-3 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {editDeal ? 'Save changes' : 'Create project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
