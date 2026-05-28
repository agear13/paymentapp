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
import {
  FUNDING_SOURCE_STATUS_OPTIONS,
  FUNDING_SOURCE_TYPE_OPTIONS,
} from '@/lib/projects/funding-sources/format-funding-source';
import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';
import {
  applyOperationalSyncRefresh,
  createPostConvergenceVerifier,
  parseOperationalSync,
  type OperationalSyncResponse,
} from '@/lib/operations/orchestration/operational-sync-client';
import type { OperationalSyncHandlers } from '@/lib/operations/orchestration/operational-sync-convergence';
import { logOperationalSyncConvergence } from '@/lib/operations/orchestration/operational-sync-convergence';

type AddFundingSourceDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCurrency?: string;
  onCreated?: (source: ProjectFundingSourceDto) => void;
  operationalSyncHandlers?: OperationalSyncHandlers;
};

export function AddFundingSourceDialog({
  projectId,
  open,
  onOpenChange,
  defaultCurrency = 'USD',
  onCreated,
  operationalSyncHandlers,
}: AddFundingSourceDialogProps) {
  const [name, setName] = React.useState('');
  const [sourceType, setSourceType] =
    React.useState<ProjectFundingSourceDto['sourceType']>('manual_forecast');
  const [amount, setAmount] = React.useState('');
  const [currency, setCurrency] = React.useState(defaultCurrency);
  const [status, setStatus] =
    React.useState<ProjectFundingSourceDto['status']>('forecast');
  const [expectedDate, setExpectedDate] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setCurrency(defaultCurrency);
  }, [open, defaultCurrency]);

  const reset = () => {
    setName('');
    setSourceType('manual_forecast');
    setAmount('');
    setStatus('forecast');
    setExpectedDate('');
    setNotes('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!name.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a name and a valid amount.');
      return;
    }
    setSubmitting(true);
    setError(null);
    logOperationalSyncConvergence('mutation-start', {
      mutation: 'funding_update',
      projectId,
      surface: 'add-funding-source-dialog',
    });
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/funding-sources`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          sourceType,
          amount: parsedAmount,
          currency,
          status,
          expectedSettlementDate: expectedDate
            ? new Date(expectedDate).toISOString()
            : null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? 'Failed to add funding source');
      }
      const json = (await res.json()) as {
        data: ProjectFundingSourceDto;
        operationalSync?: OperationalSyncResponse['operationalSync'];
      };
      if (operationalSyncHandlers) {
        const sync = parseOperationalSync(json);
        await applyOperationalSyncRefresh(
          operationalSyncHandlers,
          sync,
          { mutation: 'funding_update', projectId, surface: 'add-funding-source-dialog' },
          createPostConvergenceVerifier({
            mutation: 'funding_update',
            projectId,
            surface: 'add-funding-source-dialog',
            participants: [],
            sync: sync
              ? {
                  payoutReadyCount: sync.payoutReadyCount,
                  obligationCount: sync.obligationCount,
                  releaseEligibleObligationCount: sync.releaseEligibleObligationCount,
                }
              : undefined,
            treasuryHasFundingSources: true,
          })
        );
      }
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
            <DialogTitle>Add funding source</DialogTitle>
            <DialogDescription>
              Track expected inflows and settlement readiness for this project.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="fs-name">Name</Label>
              <Input
                id="fs-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sponsorship invoice"
              />
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={sourceType}
                onValueChange={(v) => setSourceType(v as ProjectFundingSourceDto['sourceType'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUNDING_SOURCE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="fs-amount">Amount</Label>
                <Input
                  id="fs-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fs-currency">Currency</Label>
                <Input
                  id="fs-currency"
                  maxLength={3}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as ProjectFundingSourceDto['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUNDING_SOURCE_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fs-expected">Expected settlement date</Label>
              <Input
                id="fs-expected"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fs-notes">Notes</Label>
              <Textarea
                id="fs-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional coordination notes"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Add funding source'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
