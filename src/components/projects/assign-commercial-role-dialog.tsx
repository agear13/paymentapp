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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CommercialRole } from '@/lib/projects/commercial-roles/types';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { assignCommercialRoleInDeals } from '@/lib/projects/commercial-roles/commercial-roles-payload';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';

type AssignCommercialRoleDialogProps = {
  projectId: string;
  role: CommercialRole | null;
  allDeals: RecentDeal[];
  participants: DemoParticipant[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (deals: RecentDeal[]) => Promise<boolean>;
  onAssigned?: () => void;
};

export function AssignCommercialRoleDialog({
  projectId,
  role,
  allDeals,
  participants,
  open,
  onOpenChange,
  onSave,
  onAssigned,
}: AssignCommercialRoleDialogProps) {
  const [participantId, setParticipantId] = React.useState<string>('__none__');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && role) {
      setParticipantId(role.participantId ?? '__none__');
      setError(null);
    }
  }, [open, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    const nextId = participantId === '__none__' ? null : participantId;
    if (nextId && !participants.some((p) => p.id === nextId)) {
      setError('Select a participant on this project.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const nextDeals = assignCommercialRoleInDeals(allDeals, projectId, role.id, nextId);
      const ok = await onSave(nextDeals);
      if (!ok) throw new Error('Failed to assign participant');
      onOpenChange(false);
      onAssigned?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Assign participant</DialogTitle>
            <DialogDescription>
              Link {role.title} to a project participant. This does not create a participation agreement,
              obligation, funding entry, or settlement.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Participant</Label>
              <Select value={participantId} onValueChange={setParticipantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select participant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {participants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.role ? ` · ${p.role}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {participants.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Invite a participant first, then return here to assign this {PRODUCT_TERMINOLOGY.budgetedRoleLower}.
              </p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save assignment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
