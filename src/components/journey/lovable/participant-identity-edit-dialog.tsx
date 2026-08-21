'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import {
  PARTICIPANT_IDENTITY_EMAIL_MAX,
  PARTICIPANT_IDENTITY_NAME_MAX,
} from '@/lib/participants/participant-identity';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantId: string;
  name: string;
  email: string | null;
  identityBound: boolean;
  onSaved: () => void | Promise<void>;
};

export function ParticipantIdentityEditDialog({
  open,
  onOpenChange,
  participantId,
  name,
  email,
  identityBound,
  onSaved,
}: Props) {
  const emailLocked = identityBound;
  const [saving, setSaving] = React.useState(false);
  const [nextName, setNextName] = React.useState(name);
  const [nextEmail, setNextEmail] = React.useState(email ?? '');

  React.useEffect(() => {
    if (!open) return;
    setNextName(name);
    setNextEmail(email ?? '');
  }, [open, name, email]);

  const save = async () => {
    const trimmedName = nextName.trim();
    const trimmedEmail = nextEmail.trim();
    if (!trimmedName) {
      toast.error('Enter a participant name.');
      return;
    }
    if (!emailLocked && !trimmedEmail) {
      toast.error('Enter a valid email address.');
      return;
    }
    setSaving(true);
    try {
      const body: { name: string; email?: string } = { name: trimmedName };
      if (!emailLocked) body.email = trimmedEmail;
      const res = await csrfAwareFetch(
        `/api/deal-network-pilot/participants/${encodeURIComponent(participantId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        }
      );
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        invitationResendRequired?: boolean;
        message?: string;
      } | null;
      if (!res.ok) {
        toast.error(payload?.error ?? 'Could not update participant details.');
        return;
      }
      if (payload?.invitationResendRequired) {
        toast.success(
          payload.message ?? 'Participant email updated. Send a new invitation to the updated email address.'
        );
      } else {
        toast.success('Participant details updated');
      }
      onOpenChange(false);
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit participant details</DialogTitle>
          <DialogDescription>
            These details identify the person this invitation belongs to.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="participant-identity-name">Name</Label>
            <Input
              id="participant-identity-name"
              value={nextName}
              maxLength={PARTICIPANT_IDENTITY_NAME_MAX}
              onChange={(event) => setNextName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="participant-identity-email">Email</Label>
            <Input
              id="participant-identity-email"
              type="email"
              value={nextEmail}
              maxLength={PARTICIPANT_IDENTITY_EMAIL_MAX}
              disabled={emailLocked}
              onChange={(event) => setNextEmail(event.target.value)}
            />
            {emailLocked ? (
              <p className="text-[13px] text-ink-soft">
                This email is bound to a signed-in participant and cannot be changed. Add a new
                participant to invite a different person.
              </p>
            ) : (
              <p className="text-[13px] text-ink-soft">
                Future invitations and magic links will use this email. The previous email will lose
                access.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
