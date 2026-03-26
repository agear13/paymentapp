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
import { Textarea } from '@/components/ui/textarea';
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
  resolveCommissionWithValidation,
} from '@/lib/deal-network-demo/commission-structure';

export type DemoParticipantRole = 'Introducer' | 'Connector' | 'Closer' | 'Contributor';

export interface DemoParticipant {
  id: string;
  name: string;
  /** Optional in pilot; invite link works without it. */
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
  /** Scope of work / role context shown on the approval page (pilot agreement record). */
  roleDetails?: string;
  /** When this participant becomes entitled to payout (pilot). */
  payoutCondition?: string;
  /** Optional extra context from the inviter. */
  agreementNotes?: string;
  /** Reference to an external doc (URL only in pilot; no upload backend). */
  attachmentUrl?: string;
  /** Short label for the attachment link in UI. */
  attachmentLabel?: string;
}

export interface InviteParticipantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (participant: DemoParticipant) => void;
  /** Featured deal value for commission previews */
  featuredDealValue: number;
  featuredRoleAmounts?: Partial<Record<BaseParticipantSlot, number>>;
}

export function InviteParticipantModal({
  open,
  onOpenChange,
  onInvite,
  featuredDealValue,
  featuredRoleAmounts,
}: InviteParticipantModalProps) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<DemoParticipantRole>('Connector');
  const [commissionKind, setCommissionKind] = React.useState<CommissionStructureKind>('pct_deal_value');
  const [commissionValue, setCommissionValue] = React.useState('10');
  const [baseParticipant, setBaseParticipant] = React.useState<BaseParticipantSlot>('Closer');
  const [formulaExpression, setFormulaExpression] = React.useState('');
  const [roleDetails, setRoleDetails] = React.useState('');
  const [payoutCondition, setPayoutCondition] = React.useState('');
  const [agreementNotes, setAgreementNotes] = React.useState('');
  const [attachmentUrl, setAttachmentUrl] = React.useState('');
  const [attachmentLabel, setAttachmentLabel] = React.useState('');
  const [successLink, setSuccessLink] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  function makeToken() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  React.useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setRole('Connector');
    setCommissionKind('pct_deal_value');
    setCommissionValue('10');
    setBaseParticipant('Closer');
    setFormulaExpression('');
    setRoleDetails('');
    setPayoutCondition('');
    setAgreementNotes('');
    setAttachmentUrl('');
    setAttachmentLabel('');
    setSuccessLink(null);
    setSubmitError(null);
  }, [open]);

  const isInviteDirty = React.useMemo(() => {
    if (successLink) return false;
    return (
      name.trim() !== '' ||
      email.trim() !== '' ||
      role !== 'Connector' ||
      commissionKind !== 'pct_deal_value' ||
      commissionValue !== '10' ||
      baseParticipant !== 'Closer' ||
      formulaExpression.trim() !== '' ||
      roleDetails.trim() !== '' ||
      payoutCondition.trim() !== '' ||
      agreementNotes.trim() !== '' ||
      attachmentUrl.trim() !== '' ||
      attachmentLabel.trim() !== ''
    );
  }, [
    successLink,
    name,
    email,
    role,
    commissionKind,
    commissionValue,
    baseParticipant,
    formulaExpression,
    roleDetails,
    payoutCondition,
    agreementNotes,
    attachmentUrl,
    attachmentLabel,
  ]);

  function requestClose() {
    if (successLink) {
      onOpenChange(false);
      return;
    }
    if (!isInviteDirty) {
      onOpenChange(false);
      return;
    }
    if (window.confirm('Discard changes?')) {
      onOpenChange(false);
    }
  }

  const preview = React.useMemo(() => {
    const v = featuredDealValue > 0 ? featuredDealValue : 100_000;
    return resolveCommissionWithValidation(
      {
        commissionKind,
        commissionValue: parseFloat(commissionValue) || 0,
        baseParticipant,
        formulaExpression,
      },
      { dealValue: v, roleAmounts: featuredRoleAmounts }
    );
  }, [commissionKind, commissionValue, baseParticipant, formulaExpression, featuredDealValue, featuredRoleAmounts]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!roleDetails.trim() || !payoutCondition.trim()) {
      setSubmitError('Role details and payout condition are required for the agreement record.');
      return;
    }
    const num = parseFloat(commissionValue);
    if (commissionKind !== 'formula_advanced' && (Number.isNaN(num) || num < 0)) return;
    if (!preview.valid || preview.total <= 0) {
      setSubmitError(preview.error ?? 'Invalid commission setup. Please fix the inputs.');
      return;
    }
    setSubmitError(null);

    const token = makeToken();
    const trimmedUrl = attachmentUrl.trim();
    const participant: DemoParticipant = {
      id: `part-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      role,
      commissionKind,
      commissionValue: commissionKind === 'formula_advanced' ? num : num,
      baseParticipant:
        commissionKind === 'pct_of_participant' ? baseParticipant : undefined,
      formulaExpression: commissionKind === 'formula_advanced' ? formulaExpression.trim() : undefined,
      status: 'Pending',
      inviteStatus: 'Invited',
      approvalStatus: 'Pending approval',
      inviteToken: token,
      roleDetails: roleDetails.trim(),
      payoutCondition: payoutCondition.trim(),
      agreementNotes: agreementNotes.trim() || undefined,
      attachmentUrl: trimmedUrl || undefined,
      attachmentLabel: attachmentLabel.trim() || undefined,
    };
    onInvite(participant);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setSuccessLink(`${origin}/deal-invites/${token}`);
    toast.success('Participant invited');
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
          return;
        }
        requestClose();
      }}
    >
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] flex flex-col gap-0 overflow-hidden p-0"
        onInteractOutside={(e) => {
          e.preventDefault();
          requestClose();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          requestClose();
        }}
      >
        <div className="max-h-[90vh] overflow-y-auto px-6 pt-6 pb-6">
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
              <Label htmlFor="inv-email">Email (optional)</Label>
              <Input
                id="inv-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="off"
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

            <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium">Agreement details</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Shown on the invite approval page as a lightweight role and payout context (pilot demo).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-role-details">Role details / scope of work</Label>
                <Textarea
                  id="inv-role-details"
                  value={roleDetails}
                  onChange={(e) => setRoleDetails(e.target.value)}
                  placeholder="What this person is responsible for and how it ties to the deal."
                  rows={4}
                  required
                  className="min-h-[88px] resize-y"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-payout-condition">Payout condition</Label>
                <Textarea
                  id="inv-payout-condition"
                  value={payoutCondition}
                  onChange={(e) => setPayoutCondition(e.target.value)}
                  placeholder="e.g. When deal closes and payment is received; subject to partner approval."
                  rows={3}
                  required
                  className="min-h-[72px] resize-y"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-agreement-notes">Notes (optional)</Label>
                <Textarea
                  id="inv-agreement-notes"
                  value={agreementNotes}
                  onChange={(e) => setAgreementNotes(e.target.value)}
                  placeholder="Any extra context for the participant."
                  rows={2}
                  className="resize-y"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="inv-attachment-url">Attachment / reference (URL, optional)</Label>
                  <Input
                    id="inv-attachment-url"
                    type="url"
                    inputMode="url"
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="inv-attachment-label">Link label (optional)</Label>
                  <Input
                    id="inv-attachment-label"
                    value={attachmentLabel}
                    onChange={(e) => setAttachmentLabel(e.target.value)}
                    placeholder="e.g. SOW excerpt, rate card"
                  />
                </div>
              </div>
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
                {preview.error ? (
                  <p className="mt-1 text-xs text-destructive">{preview.error}</p>
                ) : null}
                {submitError ? <p className="mt-1 text-xs text-destructive">{submitError}</p> : null}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!preview.valid || preview.total <= 0}>
                Invite Participant
              </Button>
            </DialogFooter>
          </form>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
