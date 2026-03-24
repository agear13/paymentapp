'use client';

import * as React from 'react';
import { Copy, ExternalLink } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  COMMISSION_STRUCTURE_OPTIONS,
  BASE_PARTICIPANT_OPTIONS,
  type BaseParticipantSlot,
  type CommissionStructureKind,
  computeDealCommissionTotal,
} from '@/lib/deal-network-demo/commission-structure';

export type DemoParticipantRole = 'Introducer' | 'Connector' | 'Closer' | 'Contributor';

export interface DemoParticipant {
  id: string;
  name: string;
  email: string;
  role: DemoParticipantRole;
  commissionKind: CommissionStructureKind;
  /** Meaning depends on kind: % of deal, fixed USD, % of base participant, or ignored for formula */
  commissionValue: number;
  baseParticipant?: BaseParticipantSlot;
  formulaExpression?: string;
  status: 'Pending' | 'Confirmed';
  inviteStatus: 'Invited' | 'Opened';
  approvalStatus: 'Pending approval' | 'Approved';
  approvedAt?: string;
  approvalNote?: string;
  inviteToken: string;
  /** Set by parent when saving — ties invite to the featured deal (demo). */
  dealName?: string;
  partner?: string;
  dealId?: string;
  inviteLink?: string;
}

export interface InviteParticipantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (participant: DemoParticipant) => void;
  /** Featured deal value for commission previews */
  featuredDealValue: number;
}

export function InviteParticipantModal({
  open,
  onOpenChange,
  onInvite,
  featuredDealValue,
}: InviteParticipantModalProps) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<DemoParticipantRole>('Connector');
  const [commissionKind, setCommissionKind] = React.useState<CommissionStructureKind>('pct_deal_value');
  const [commissionValue, setCommissionValue] = React.useState('10');
  const [baseParticipant, setBaseParticipant] = React.useState<BaseParticipantSlot>('Closer');
  const [formulaExpression, setFormulaExpression] = React.useState('');
  const [successLink, setSuccessLink] = React.useState<string | null>(null);

  function makeToken() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  React.useEffect(() => {
    if (!open) {
      setName('');
      setEmail('');
      setRole('Connector');
      setCommissionKind('pct_deal_value');
      setCommissionValue('10');
      setBaseParticipant('Closer');
      setFormulaExpression('');
      setSuccessLink(null);
    }
  }, [open]);

  const preview = React.useMemo(() => {
    const v = featuredDealValue > 0 ? featuredDealValue : 100_000;
    return computeDealCommissionTotal(
      commissionKind,
      v,
      commissionKind === 'pct_deal_value' ? parseFloat(commissionValue) || 0 : 20,
      commissionKind === 'fixed_amount' ? parseFloat(commissionValue) || 0 : 0,
      baseParticipant,
      commissionKind === 'pct_of_participant' ? parseFloat(commissionValue) || 0 : 5,
      formulaExpression
    );
  }, [commissionKind, commissionValue, baseParticipant, formulaExpression, featuredDealValue]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const num = parseFloat(commissionValue);
    if (commissionKind !== 'formula_advanced' && (Number.isNaN(num) || num < 0)) return;

    const token = makeToken();
    const participant: DemoParticipant = {
      id: `part-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      role,
      commissionKind,
      commissionValue: commissionKind === 'formula_advanced' ? 0 : num,
      baseParticipant:
        commissionKind === 'pct_of_participant' ? baseParticipant : undefined,
      formulaExpression: commissionKind === 'formula_advanced' ? formulaExpression.trim() : undefined,
      status: 'Pending',
      inviteStatus: 'Invited',
      approvalStatus: 'Pending approval',
      inviteToken: token,
    };
    onInvite(participant);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setSuccessLink(`${origin}/deal-invites/${token}`);
  }

  async function copyLink() {
    if (!successLink) return;
    try {
      await navigator.clipboard.writeText(successLink);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{successLink ? 'Participant invited' : 'Invite participant'}</DialogTitle>
          <DialogDescription>
            {successLink
              ? 'Share this link so they can review and approve their participation (demo).'
              : 'Add a participant to the featured deal. Commission can follow flexible structures (demo).'}
          </DialogDescription>
        </DialogHeader>

        {successLink ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <Label className="text-xs text-muted-foreground">Invite link</Label>
              <div className="flex gap-2">
                <Input readOnly value={successLink} className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copyLink} aria-label="Copy invite link">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => window.open(successLink, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open link
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
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

            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="space-y-2">
                <Label>Commission type</Label>
                <Select
                  value={commissionKind}
                  onValueChange={(v) => setCommissionKind(v as CommissionStructureKind)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMISSION_STRUCTURE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {commissionKind === 'pct_deal_value' ? (
                <div className="space-y-2">
                  <Label htmlFor="inv-pct-deal">Percentage of deal value</Label>
                  <Input
                    id="inv-pct-deal"
                    type="number"
                    min={0}
                    step={0.5}
                    value={commissionValue}
                    onChange={(e) => setCommissionValue(e.target.value)}
                    required
                  />
                </div>
              ) : null}

              {commissionKind === 'fixed_amount' ? (
                <div className="space-y-2">
                  <Label htmlFor="inv-fixed">Fixed amount (USD)</Label>
                  <Input
                    id="inv-fixed"
                    type="number"
                    min={0}
                    step={100}
                    value={commissionValue}
                    onChange={(e) => setCommissionValue(e.target.value)}
                    required
                  />
                </div>
              ) : null}

              {commissionKind === 'pct_of_participant' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Base participant</Label>
                    <Select
                      value={baseParticipant}
                      onValueChange={(v) => setBaseParticipant(v as BaseParticipantSlot)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BASE_PARTICIPANT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-pct-base">Percentage of base</Label>
                    <Input
                      id="inv-pct-base"
                      type="number"
                      min={0}
                      step={0.5}
                      value={commissionValue}
                      onChange={(e) => setCommissionValue(e.target.value)}
                      required
                    />
                  </div>
                </div>
              ) : null}

              {commissionKind === 'formula_advanced' ? (
                <div className="space-y-2">
                  <Label htmlFor="inv-formula">Formula</Label>
                  <Input
                    id="inv-formula"
                    value={formulaExpression}
                    onChange={(e) => setFormulaExpression(e.target.value)}
                    placeholder="e.g. 5% of closer share + $500"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports expressions like % of salary, % of another participant, etc. (Static preview
                    only.)
                  </p>
                </div>
              ) : null}

              <div className="rounded-md border bg-background px-3 py-2 text-sm">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Preview
                </p>
                <p className="text-foreground">{preview.previewLine}</p>
                <p className="mt-1 font-semibold tabular-nums">
                  Resolved (demo): ${preview.total.toLocaleString()}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Invite participant</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
