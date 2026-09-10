'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import {
  PROJECT_DETAILS_DESCRIPTION_MAX,
  PROJECT_DETAILS_NAME_MAX,
  PROJECT_DETAILS_PARTNER_MAX,
  type ProjectDetailsCurrency,
} from '@/lib/projects/update-project-details';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Pick<
    RecentDeal,
    'id' | 'dealName' | 'projectDescription' | 'latestUpdate' | 'partner' | 'value' | 'projectValueCurrency'
  >;
  onSaved: (deal: RecentDeal) => void | Promise<void>;
  title?: string;
};

export function EditProjectDetailsDialog({
  open,
  onOpenChange,
  deal,
  onSaved,
  title = 'Edit project details',
}: Props) {
  const [saving, setSaving] = React.useState(false);
  const [dealName, setDealName] = React.useState(deal.dealName);
  const [projectDescription, setProjectDescription] = React.useState(
    deal.projectDescription ?? deal.latestUpdate ?? ''
  );
  const [partner, setPartner] = React.useState(deal.partner ?? '');
  const [value, setValue] = React.useState(deal.value > 0 ? String(deal.value) : '');
  const [currency, setCurrency] = React.useState<ProjectDetailsCurrency>(
    deal.projectValueCurrency === 'USD' ? 'USD' : 'AUD'
  );

  React.useEffect(() => {
    if (!open) return;
    setDealName(deal.dealName);
    setProjectDescription(deal.projectDescription ?? deal.latestUpdate ?? '');
    setPartner(deal.partner ?? '');
    setValue(deal.value > 0 ? String(deal.value) : '');
    setCurrency(deal.projectValueCurrency === 'USD' ? 'USD' : 'AUD');
  }, [open, deal]);

  const save = async () => {
    const name = dealName.trim();
    if (!name) {
      toast.error('Enter a project name.');
      return;
    }
    const parsedValue = value.trim() === '' ? 0 : Number(value.replace(/,/g, ''));
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      toast.error('Enter a valid project value, or leave it blank.');
      return;
    }
    setSaving(true);
    try {
      const res = await csrfAwareFetch(
        `/api/deal-network-pilot/deals/${encodeURIComponent(deal.id)}/details`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            dealName: name,
            projectDescription: projectDescription.trim(),
            partner: partner.trim(),
            value: parsedValue,
            projectValueCurrency: currency,
          }),
        }
      );
      const payload = (await res.json().catch(() => null)) as
        | { error?: string; deal?: RecentDeal }
        | null;
      if (!res.ok || !payload?.deal) {
        toast.error(payload?.error ?? 'Could not update project details.');
        return;
      }
      toast.success('Project details updated');
      onOpenChange(false);
      await onSaved(payload.deal);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            General project information can be corrected after creation. Existing posted earnings
            are not rewritten.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="edit-project-name">Project name</Label>
            <Input
              id="edit-project-name"
              value={dealName}
              maxLength={PROJECT_DETAILS_NAME_MAX}
              onChange={(event) => setDealName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-project-description">Description</Label>
            <Textarea
              id="edit-project-description"
              rows={3}
              value={projectDescription}
              maxLength={PROJECT_DETAILS_DESCRIPTION_MAX}
              onChange={(event) => setProjectDescription(event.target.value)}
              placeholder="Scope, deliverables, or internal context."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-project-partner">Organisation / client</Label>
            <Input
              id="edit-project-partner"
              value={partner}
              maxLength={PROJECT_DETAILS_PARTNER_MAX}
              onChange={(event) => setPartner(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-project-value">Project value</Label>
              <Input
                id="edit-project-value"
                type="number"
                min={0}
                step={1}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Not specified"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-currency">Currency</Label>
              <select
                id="edit-project-currency"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={currency}
                onChange={(event) => setCurrency(event.target.value as ProjectDetailsCurrency)}
              >
                <option value="AUD">AUD</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
