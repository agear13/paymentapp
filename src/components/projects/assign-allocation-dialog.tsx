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
import type { ProjectAllocationDto } from '@/lib/projects/allocations/types';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

type AssignAllocationDialogProps = {
  projectId: string;
  allocation: ProjectAllocationDto | null;
  participants: DemoParticipant[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: (allocation: ProjectAllocationDto) => void;
};

export function AssignAllocationDialog({
  projectId,
  allocation,
  participants,
  open,
  onOpenChange,
  onAssigned,
}: AssignAllocationDialogProps) {
  const [participantId, setParticipantId] = React.useState<string>('__none__');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && allocation) {
      setParticipantId(allocation.participantId ?? '__none__');
      setError(null);
    }
  }, [open, allocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocation) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/allocations/${encodeURIComponent(allocation.id)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId: participantId === '__none__' ? null : participantId,
          }),
        }
      );
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? 'Failed to assign participant');
      }
      const json = (await res.json()) as { data: ProjectAllocationDto };
      onOpenChange(false);
      onAssigned?.(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (!allocation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Assign participant</DialogTitle>
            <DialogDescription>
              Link {allocation.title} to a project participant. This does not create an agreement
              or obligation.
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
                Invite a participant first, then return here to assign this allocation.
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
