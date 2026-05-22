'use client';

import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  ONBOARDING_PARTICIPANT_ROLES,
  type OnboardingParticipantRole,
} from '@/lib/onboarding/operator-onboarding-types';

export type OnboardingDraftParticipant = {
  name: string;
  email: string;
  role: OnboardingParticipantRole;
  notes?: string;
};

type OnboardingParticipantCardProps = {
  participant: OnboardingDraftParticipant;
  onUpdate: (next: OnboardingDraftParticipant) => void;
  onRemove: () => void;
};

export function OnboardingParticipantCard({
  participant,
  onUpdate,
  onRemove,
}: OnboardingParticipantCardProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(participant);

  React.useEffect(() => {
    setDraft(participant);
  }, [participant]);

  function saveEdit() {
    if (!draft.name.trim()) return;
    onUpdate({ ...draft, name: draft.name.trim() });
    setEditOpen(false);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 rounded-md border border-border/30 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{participant.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {participant.role}
            {participant.email ? ` · ${participant.email}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setEditOpen(true)}
            aria-label={`Edit ${participant.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={`Remove ${participant.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit participant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select
                value={draft.role}
                onValueChange={(v) =>
                  setDraft({ ...draft, role: v as OnboardingParticipantRole })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ONBOARDING_PARTICIPANT_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                rows={2}
                value={draft.notes ?? ''}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Payout details or context (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveEdit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Compact badge variant for legacy inline lists */
export function OnboardingParticipantBadge({
  participant,
  onEdit,
  onRemove,
}: {
  participant: OnboardingDraftParticipant;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <Badge variant="secondary" className="gap-1 py-1.5 pl-3 pr-1">
      <span>
        {participant.name} · {participant.role}
      </span>
      <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={onEdit}>
        <Pencil className="h-3 w-3" />
      </Button>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground px-1"
        onClick={onRemove}
        aria-label={`Remove ${participant.name}`}
      >
        ×
      </button>
    </Badge>
  );
}
