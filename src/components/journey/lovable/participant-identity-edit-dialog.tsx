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
  PARTICIPANT_IDENTITY_PHONE_MAX,
  PARTICIPANT_IDENTITY_ROLE_LABEL_MAX,
} from '@/lib/participants/participant-identity';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantId: string;
  name: string;
  email: string | null;
  phone?: string | null;
  roleLabel?: string | null;
  identityBound: boolean;
  issuedAgreement?: boolean;
  onSaved: () => void | Promise<void>;
};

export function ParticipantIdentityEditDialog({
  open,
  onOpenChange,
  participantId,
  name,
  email,
  phone,
  roleLabel,
  identityBound,
  issuedAgreement = false,
  onSaved,
}: Props) {
  const emailLocked = identityBound;
  const [saving, setSaving] = React.useState(false);
  const [nextName, setNextName] = React.useState(name);
  const [nextEmail, setNextEmail] = React.useState(email ?? '');
  const [nextPhone, setNextPhone] = React.useState(phone ?? '');
  const [nextRoleLabel, setNextRoleLabel] = React.useState(roleLabel ?? '');

  React.useEffect(() => {
    if (!open) return;
    setNextName(name);
    setNextEmail(email ?? '');
    setNextPhone(phone ?? '');
    setNextRoleLabel(roleLabel ?? '');
  }, [open, name, email, phone, roleLabel]);

  const save = async () => {
    const trimmedName = nextName.trim();
    const trimmedEmail = nextEmail.trim();
    if (!trimmedName) {
      toast.error('Enter a participant name.');
      return;
    }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error('Enter a valid email address, or leave it blank.');
      return;
    }
    setSaving(true);
    try {
      const body: {
        name: string;
        email?: string;
        phone: string;
        roleLabel: string;
      } = {
        name: trimmedName,
        phone: nextPhone.trim(),
        roleLabel: nextRoleLabel.trim(),
      };
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
          <DialogTitle>Edit participant</DialogTitle>
          <DialogDescription>
            Update this person&apos;s profile. Commission, earning source, and referral terms stay
            on the agreement and are not changed here.
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
              placeholder="Not provided"
              onChange={(event) => setNextEmail(event.target.value)}
            />
            {emailLocked ? (
              <p className="text-[13px] text-ink-soft">
                This email is bound to a signed-in participant and cannot be changed. Add a new
                participant to invite a different person.
              </p>
            ) : (
              <p className="text-[13px] text-ink-soft">
                Optional until you send the agreement. Future invitations use this address.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="participant-identity-phone">Phone</Label>
            <Input
              id="participant-identity-phone"
              value={nextPhone}
              maxLength={PARTICIPANT_IDENTITY_PHONE_MAX}
              placeholder="Optional"
              onChange={(event) => setNextPhone(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="participant-identity-role">Role</Label>
            <Input
              id="participant-identity-role"
              value={nextRoleLabel}
              maxLength={PARTICIPANT_IDENTITY_ROLE_LABEL_MAX}
              placeholder="e.g. Community Organiser"
              onChange={(event) => setNextRoleLabel(event.target.value)}
            />
          </div>
          {issuedAgreement ? (
            <p className="text-[13px] text-ink-soft">
              Issued agreement wording stays on the current version. Profile corrections appear in
              the workspace immediately; contractual changes still need a new agreement version.
            </p>
          ) : null}
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
