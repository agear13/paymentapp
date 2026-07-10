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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CommercialRoleBudgetType } from '@/lib/projects/commercial-roles/types';
import { commercialRoleBudgetTypeLabel } from '@/lib/projects/commercial-roles/format-commercial-role';
import {
  addCommercialRoleToDeals,
  type CreateCommercialRoleInput,
} from '@/lib/projects/commercial-roles/commercial-roles-payload';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';

const BUDGET_TYPES: CommercialRoleBudgetType[] = [
  'FIXED',
  'REVENUE_SHARE',
  'CUSTOMER_ATTRIBUTION',
];

type AddCommercialRoleDialogProps = {
  projectId: string;
  allDeals: RecentDeal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (deals: RecentDeal[]) => Promise<boolean>;
  onCreated?: () => void;
};

export function AddCommercialRoleDialog({
  projectId,
  allDeals,
  open,
  onOpenChange,
  onSave,
  onCreated,
}: AddCommercialRoleDialogProps) {
  const [title, setTitle] = React.useState('');
  const [budgetType, setBudgetType] = React.useState<CommercialRoleBudgetType>('FIXED');
  const [budgetValue, setBudgetValue] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setBudgetType('FIXED');
    setBudgetValue('');
    setDescription('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedValue = Number(budgetValue);
    if (!title.trim() || !Number.isFinite(parsedValue) || parsedValue < 0) {
      setError('Enter a title and valid budget value.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const input: CreateCommercialRoleInput = {
        title: title.trim(),
        description: description.trim() || null,
        budgetType,
        budgetValue: parsedValue,
      };
      const nextDeals = addCommercialRoleToDeals(allDeals, projectId, input);
      const ok = await onSave(nextDeals);
      if (!ok) throw new Error(PRODUCT_TERMINOLOGY.couldNotSaveBudgetedRole);
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{PRODUCT_TERMINOLOGY.addBudgetedRole}</DialogTitle>
            <DialogDescription>
              Plan a role and budget before inviting a participant.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cr-title">Title</Label>
              <Input
                id="cr-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="DJ"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <Label>Budget type</Label>
                <Select
                  value={budgetType}
                  onValueChange={(v) => setBudgetType(v as CommercialRoleBudgetType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {commercialRoleBudgetTypeLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cr-value">Budget value</Label>
                <Input
                  id="cr-value"
                  type="number"
                  min={0}
                  step={budgetType === 'FIXED' ? '0.01' : '0.1'}
                  value={budgetValue}
                  onChange={(e) => setBudgetValue(e.target.value)}
                  placeholder={budgetType === 'FIXED' ? '500' : '10'}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cr-desc">Description (optional)</Label>
              <Textarea
                id="cr-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : PRODUCT_TERMINOLOGY.addBudgetedRole}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
