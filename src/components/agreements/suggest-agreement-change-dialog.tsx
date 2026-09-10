'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  AGREEMENT_CHANGE_FIELDS,
  type AgreementChangeFieldKey,
  type AgreementChangeRequest,
} from '@/lib/agreements/agreement-change-request';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  currentValues: Record<AgreementChangeFieldKey, string>;
  onSubmitted?: (request: AgreementChangeRequest) => void;
};

export function SuggestAgreementChangeDialog({
  open,
  onOpenChange,
  token,
  currentValues,
  onSubmitted,
}: Props) {
  const [fieldKey, setFieldKey] = React.useState<AgreementChangeFieldKey>('legal_name');
  const [suggestedValue, setSuggestedValue] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSuggestedValue('');
    setReason('');
  }, [open, fieldKey]);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await csrfAwareFetch(
        `/api/deal-network-pilot/invites/${encodeURIComponent(token)}/change-requests`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ fieldKey, suggestedValue, reason }),
        }
      );
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        request?: AgreementChangeRequest;
        duplicate?: boolean;
      };
      if (!res.ok || !payload.request) {
        throw new Error(payload.error || 'Could not submit suggestion');
      }
      toast.success(
        payload.duplicate
          ? 'This suggestion is already waiting for review.'
          : 'Suggestion sent. The organiser will review it.'
      );
      onSubmitted?.(payload.request);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit suggestion');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Suggest a change to this agreement</DialogTitle>
          <DialogDescription>
            This does not change the agreement. The organiser reviews your suggestion before
            anything is updated.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="change-field">
              What needs changing?
            </label>
            <select
              id="change-field"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={fieldKey}
              onChange={(event) => setFieldKey(event.target.value as AgreementChangeFieldKey)}
            >
              {AGREEMENT_CHANGE_FIELDS.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Current value</p>
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {currentValues[fieldKey] || '—'}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="suggested-value">
              Suggested value
            </label>
            <Input
              id="suggested-value"
              value={suggestedValue}
              onChange={(event) => setSuggestedValue(event.target.value)}
              placeholder="Enter the correct value"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="change-reason">
              Reason / note
            </label>
            <Textarea
              id="change-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain what is incorrect"
              required
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit suggestion'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
