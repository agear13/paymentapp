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
import type { ProjectAllocationBudgetType, ProjectAllocationDto } from '@/lib/projects/allocations/types';
import { budgetTypeLabel } from '@/lib/projects/allocations/format-allocation';

const BUDGET_TYPES: ProjectAllocationBudgetType[] = [
  'FIXED',
  'PERCENTAGE',
  'REVENUE_SHARE',
  'ATTRIBUTION',
];

type AddAllocationDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCurrency?: string;
  onCreated?: (allocation: ProjectAllocationDto) => void;
};

export function AddAllocationDialog({
  projectId,
  open,
  onOpenChange,
  defaultCurrency = 'USD',
  onCreated,
}: AddAllocationDialogProps) {
  const [title, setTitle] = React.useState('');
  const [role, setRole] = React.useState('');
  const [budgetType, setBudgetType] = React.useState<ProjectAllocationBudgetType>('FIXED');
  const [budgetValue, setBudgetValue] = React.useState('');
  const [currency, setCurrency] = React.useState(defaultCurrency);
  const [description, setDescription] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setCurrency(defaultCurrency);
  }, [open, defaultCurrency]);

  const reset = () => {
    setTitle('');
    setRole('');
    setBudgetType('FIXED');
    setBudgetValue('');
    setDescription('');
    setNotes('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedValue = Number(budgetValue);
    if (!title.trim() || !role.trim() || !Number.isFinite(parsedValue) || parsedValue < 0) {
      setError('Enter a title, role, and valid budget value.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/allocations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          role: role.trim(),
          budgetType,
          budgetValue: parsedValue,
          currency,
          description: description.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? 'Failed to add allocation');
      }
      const json = (await res.json()) as { data: ProjectAllocationDto };
      reset();
      onOpenChange(false);
      onCreated?.(json.data);
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
            <DialogTitle>Add allocation</DialogTitle>
            <DialogDescription>
              Plan a role and budget before inviting a participant or creating agreements.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="alloc-title">Title</Label>
              <Input
                id="alloc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="DJ"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="alloc-role">Role</Label>
              <Input
                id="alloc-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Performer"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <Label>Budget type</Label>
                <Select
                  value={budgetType}
                  onValueChange={(v) => setBudgetType(v as ProjectAllocationBudgetType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {budgetTypeLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="alloc-value">Budget value</Label>
                <Input
                  id="alloc-value"
                  type="number"
                  min={0}
                  step={budgetType === 'FIXED' ? '0.01' : '0.1'}
                  value={budgetValue}
                  onChange={(e) => setBudgetValue(e.target.value)}
                  placeholder={budgetType === 'FIXED' ? '500' : '10'}
                />
              </div>
            </div>
            {budgetType === 'FIXED' ? (
              <div className="grid gap-2">
                <Label htmlFor="alloc-currency">Currency</Label>
                <Input
                  id="alloc-currency"
                  maxLength={3}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="alloc-desc">Description (optional)</Label>
              <Textarea
                id="alloc-desc"
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
              {submitting ? 'Saving…' : 'Add allocation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
