'use client';

import * as React from 'react';
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
import type {
  DemoParticipant,
  DemoParticipantRole,
} from '@/components/deal-network-demo/invite-participant-modal';

const PARTICIPANT_ROLES: DemoParticipantRole[] = [
  'Introducer',
  'Connector',
  'Closer',
  'Contributor',
];

type EditProjectParticipantDialogProps = {
  participant: DemoParticipant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: {
    name: string;
    email: string;
    role: DemoParticipantRole;
    roleDetails?: string;
    agreementNotes?: string;
  }) => Promise<void>;
};

export function EditProjectParticipantDialog({
  participant,
  open,
  onOpenChange,
  onSave,
}: EditProjectParticipantDialogProps) {
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState({
    name: '',
    email: '',
    role: 'Contributor' as DemoParticipantRole,
    roleDetails: '',
    agreementNotes: '',
  });

  React.useEffect(() => {
    if (!participant) return;
    setDraft({
      name: participant.name,
      email: participant.email ?? '',
      role: participant.role,
      roleDetails: participant.roleDetails ?? '',
      agreementNotes: participant.agreementNotes ?? '',
    });
  }, [participant]);

  async function handleSave() {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: draft.name.trim(),
        email: draft.email.trim(),
        role: draft.role,
        roleDetails: draft.roleDetails.trim() || undefined,
        agreementNotes: draft.agreementNotes.trim() || undefined,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit participant</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="participant-name">Name</Label>
            <Input
              id="participant-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="participant-email">Email</Label>
            <Input
              id="participant-email"
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select
              value={draft.role}
              onValueChange={(v) => setDraft({ ...draft, role: v as DemoParticipantRole })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARTICIPANT_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="participant-role-details">Payout / role details</Label>
            <Textarea
              id="participant-role-details"
              rows={2}
              value={draft.roleDetails}
              onChange={(e) => setDraft({ ...draft, roleDetails: e.target.value })}
              placeholder="Scope of work or payout context"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="participant-notes">Notes</Label>
            <Textarea
              id="participant-notes"
              rows={2}
              value={draft.agreementNotes}
              onChange={(e) => setDraft({ ...draft, agreementNotes: e.target.value })}
              placeholder="Internal notes (optional)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || !draft.name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
