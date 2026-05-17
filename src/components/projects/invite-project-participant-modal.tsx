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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  buildOperationalParticipant,
  type OperationalParticipantRole,
} from '@/lib/projects/participants-for-project';

type InviteProjectParticipantModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: RecentDeal;
  onSubmit: (participant: ReturnType<typeof buildOperationalParticipant>) => Promise<void>;
};

const ROLES: OperationalParticipantRole[] = ['Contributor', 'Contractor', 'Referrer', 'Partner'];

export function InviteProjectParticipantModal({
  open,
  onOpenChange,
  project,
  onSubmit,
}: InviteProjectParticipantModalProps) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<OperationalParticipantRole>('Contributor');
  const [payoutDueDate, setPayoutDueDate] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setName('');
      setEmail('');
      setRole('Contributor');
      setPayoutDueDate('');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    setSaving(true);
    try {
      const participant = buildOperationalParticipant({
        name,
        email,
        role,
        project,
        payoutDueDate: payoutDueDate || undefined,
        notes: notes || undefined,
      });
      await onSubmit(participant);
      toast.success(`${participant.name} added to ${project.dealName}`);
      onOpenChange(false);
    } catch {
      toast.error('Could not add participant. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite participant</DialogTitle>
            <DialogDescription>
              Add someone operationally involved in <span className="font-medium">{project.dealName}</span>.
              They can complete onboarding and payout setup separately.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="proj-invite-name">Name</Label>
              <Input
                id="proj-invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                autoComplete="name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proj-invite-email">Email</Label>
              <Input
                id="proj-invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proj-invite-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as OperationalParticipantRole)}>
                <SelectTrigger id="proj-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proj-invite-payout-date">Optional payout date</Label>
              <Input
                id="proj-invite-payout-date"
                type="date"
                value={payoutDueDate}
                onChange={(e) => setPayoutDueDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proj-invite-notes">Optional notes</Label>
              <Textarea
                id="proj-invite-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Scope, deliverables, or internal context"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
