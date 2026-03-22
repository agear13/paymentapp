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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type DemoParticipantRole = 'Introducer' | 'Connector' | 'Closer' | 'Contributor';

export interface DemoParticipant {
  id: string;
  name: string;
  email: string;
  role: DemoParticipantRole;
  commissionType: 'percent' | 'fixed';
  commissionValue: number;
  status: 'Pending' | 'Confirmed';
  /** Set by parent when saving — ties invite to the featured deal (demo). */
  dealName?: string;
  partner?: string;
}

export interface InviteParticipantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (participant: DemoParticipant) => void;
}

export function InviteParticipantModal({ open, onOpenChange, onInvite }: InviteParticipantModalProps) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<DemoParticipantRole>('Connector');
  const [commissionType, setCommissionType] = React.useState<'percent' | 'fixed'>('percent');
  const [commissionValue, setCommissionValue] = React.useState('10');

  React.useEffect(() => {
    if (!open) {
      setName('');
      setEmail('');
      setRole('Connector');
      setCommissionType('percent');
      setCommissionValue('10');
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const num = parseFloat(commissionValue);
    if (Number.isNaN(num) || num < 0) return;

    const participant: DemoParticipant = {
      id: `part-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      role,
      commissionType,
      commissionValue: num,
      status: 'Pending',
    };
    onInvite(participant);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite participant</DialogTitle>
          <DialogDescription>
            Add a participant to the featured deal. Click a row in the list to confirm (demo).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inv-name">Name</Label>
            <Input
              id="inv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-email">Email</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as DemoParticipantRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Introducer">Introducer</SelectItem>
                <SelectItem value="Connector">Connector</SelectItem>
                <SelectItem value="Closer">Closer</SelectItem>
                <SelectItem value="Contributor">Contributor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Commission type</Label>
              <Select
                value={commissionType}
                onValueChange={(v) => setCommissionType(v as 'percent' | 'fixed')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent</SelectItem>
                  <SelectItem value="fixed">Fixed (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-comm">
                {commissionType === 'percent' ? 'Percent' : 'Amount'}
              </Label>
              <Input
                id="inv-comm"
                type="number"
                min={0}
                step={commissionType === 'percent' ? 0.5 : 100}
                value={commissionValue}
                onChange={(e) => setCommissionValue(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add participant</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
