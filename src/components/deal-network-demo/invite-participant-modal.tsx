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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  BASE_PARTICIPANT_OPTIONS,
  COMMISSION_STRUCTURE_OPTIONS,
  type BaseParticipantSlot,
  type CommissionStructureKind,
  resolveCommissionWithValidation,
  computeParticipantCommissionTotalsForDeal,
  type PilotParticipantCommissionRow,
} from '@/lib/deal-network-demo/commission-structure';
import { normParticipantName } from '@/lib/deal-network-demo/participant-merge';
import type { ParticipantPayoutSettlementStatus } from '@/lib/deal-network-demo/participant-payout-status';
import type { PilotParticipantOnboardingStatus } from '@/lib/deal-network-demo/participant-onboarding';

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
  /** When commissionKind is pct_of_participant: base allocation comes from this invitee row id. */
  commissionBaseParticipantId?: string;
  formulaExpression?: string;
  status: 'Pending' | 'Confirmed';
  inviteStatus: 'Invited' | 'Opened';
  approvalStatus: 'Pending approval' | 'Approved';
  /** KYC / payout profile readiness — payout must not execute until COMPLETE. */
  onboardingStatus?: PilotParticipantOnboardingStatus;
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
  /**
   * If true, this row was intentionally created as a duplicate by the operator.
   * Used to prevent the pilot UI from silently merging/deduping it.
   */
  userRequestedDuplicate?: boolean;
  /** Optional extra context from the inviter. */
  agreementNotes?: string;
  /** Reference to an external doc (URL only in pilot; no upload backend). */
  attachmentUrl?: string;
  /** Short label for the attachment link in UI. */
  attachmentLabel?: string;
  /** Override deal settlement for this payout line (pilot). */
  payoutSettlementStatus?: ParticipantPayoutSettlementStatus;
  /** When payout line is Paid, optional timestamp (pilot). */
  payoutPaidAt?: string;
  payoutStatusNote?: string;
  /** Project coordination mode */
  payoutDueDate?: string;
  participantNotes?: string;
  companyName?: string;
}

export interface InviteParticipantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (
    participant: DemoParticipant,
    duplicateAction: 'use_existing' | 'create_duplicate_anyway'
  ) => Promise<DemoParticipant>;
  existingParticipantsForDuplicateCheck: DemoParticipant[];
  /** Featured deal value for commission previews */
  featuredDealValue: number;
  featuredRoleAmounts?: Partial<Record<BaseParticipantSlot, number>>;
  /** Referral/Rabbit Hole pilot (default) vs project coordination UI. */
  experienceMode?: 'referral' | 'project';
  /** Invitees on this deal eligible as %-of-participant base (excludes internal deal-role rows). */
  commissionBaseParticipantOptions?: { id: string; name: string; companyName?: string }[];
}

const INVITE_PREVIEW_PARTICIPANT_ID = '__invite_preview__';

function demoParticipantToPilotRow(p: DemoParticipant): PilotParticipantCommissionRow {
  return {
    id: p.id,
    name: p.name,
    companyName: p.companyName,
    commissionKind: p.commissionKind,
    commissionValue: p.commissionValue,
    baseParticipant: p.baseParticipant,
    commissionBaseParticipantId: p.commissionBaseParticipantId,
    formulaExpression: p.formulaExpression,
  };
}

export function InviteParticipantModal({
  open,
  onOpenChange,
  onInvite,
  existingParticipantsForDuplicateCheck,
  featuredDealValue,
  featuredRoleAmounts,
  experienceMode = 'referral',
  commissionBaseParticipantOptions = [],
}: InviteParticipantModalProps) {
  const isProjectMode = experienceMode === 'project';
  /** Strait / project: simplify invite UX; engine still supports all kinds for existing rows. */
  const commissionStructureSelectOptions = React.useMemo(
    () =>
      isProjectMode
        ? COMMISSION_STRUCTURE_OPTIONS.filter((o) => o.value !== 'pct_of_participant')
        : COMMISSION_STRUCTURE_OPTIONS,
    [isProjectMode]
  );
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<DemoParticipantRole>('Connector');
  const [commissionKind, setCommissionKind] = React.useState<CommissionStructureKind>('pct_deal_value');
  const [commissionValue, setCommissionValue] = React.useState('10');
  const [baseParticipant, setBaseParticipant] = React.useState<BaseParticipantSlot>('Introducer');
  const [commissionBaseParticipantId, setCommissionBaseParticipantId] = React.useState('');
  const [formulaExpression, setFormulaExpression] = React.useState('');
  const [roleDetails, setRoleDetails] = React.useState('');
  const [payoutCondition, setPayoutCondition] = React.useState('');
  const [agreementNotes, setAgreementNotes] = React.useState('');
  const [attachmentUrl, setAttachmentUrl] = React.useState('');
  const [attachmentLabel, setAttachmentLabel] = React.useState('');
  const [payoutDueDate, setPayoutDueDate] = React.useState('');
  const [participantNotes, setParticipantNotes] = React.useState('');
  const [companyName, setCompanyName] = React.useState('');
  const [successLink, setSuccessLink] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = React.useState(false);
  const [pendingDuplicateParticipant, setPendingDuplicateParticipant] = React.useState<
    DemoParticipant | null
  >(null);
  const [duplicateCandidates, setDuplicateCandidates] = React.useState<DemoParticipant[]>([]);
  const [duplicateSubmitting, setDuplicateSubmitting] = React.useState(false);

  function makeToken() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  React.useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setFormulaExpression('');
    setRoleDetails('');
    setPayoutCondition('');
    setAgreementNotes('');
    setAttachmentUrl('');
    setAttachmentLabel('');
    setPayoutDueDate('');
    setParticipantNotes('');
    setCompanyName('');
    setSuccessLink(null);
    setSubmitError(null);
    setDuplicateDialogOpen(false);
    setPendingDuplicateParticipant(null);
    setDuplicateCandidates([]);
    setDuplicateSubmitting(false);
    setCommissionBaseParticipantId('');
    if (isProjectMode) {
      setRole('Contributor');
      setCommissionKind('fixed_amount');
      setCommissionValue('0');
      setBaseParticipant('Closer');
    } else {
      setRole('Connector');
      setCommissionKind('pct_deal_value');
      setCommissionValue('10');
      setBaseParticipant('Introducer');
    }
  }, [open, isProjectMode]);

  React.useEffect(() => {
    if (!open || !isProjectMode) return;
    if (commissionKind !== 'pct_of_participant') return;
    setCommissionKind('fixed_amount');
  }, [open, isProjectMode, commissionKind]);

  const isInviteDirty = React.useMemo(() => {
    if (successLink) return false;
    if (isProjectMode) {
      return (
        name.trim() !== '' ||
        email.trim() !== '' ||
        role !== 'Contributor' ||
        commissionKind !== 'fixed_amount' ||
        commissionValue !== '0' ||
        baseParticipant !== 'Closer' ||
        formulaExpression.trim() !== '' ||
        roleDetails.trim() !== '' ||
        payoutCondition.trim() !== '' ||
        agreementNotes.trim() !== '' ||
        attachmentUrl.trim() !== '' ||
        attachmentLabel.trim() !== '' ||
        payoutDueDate.trim() !== '' ||
        participantNotes.trim() !== '' ||
        companyName.trim() !== ''
      );
    }
    return (
      name.trim() !== '' ||
      email.trim() !== '' ||
      role !== 'Connector' ||
      commissionKind !== 'pct_deal_value' ||
      commissionValue !== '10' ||
      baseParticipant !== 'Introducer' ||
      formulaExpression.trim() !== '' ||
      roleDetails.trim() !== '' ||
      payoutCondition.trim() !== '' ||
      agreementNotes.trim() !== '' ||
      attachmentUrl.trim() !== '' ||
      attachmentLabel.trim() !== ''
    );
  }, [
    successLink,
    isProjectMode,
    name,
    email,
    role,
    commissionKind,
    commissionValue,
    baseParticipant,
    commissionBaseParticipantId,
    commissionBaseParticipantOptions,
    formulaExpression,
    roleDetails,
    payoutCondition,
    agreementNotes,
    attachmentUrl,
    attachmentLabel,
    payoutDueDate,
    participantNotes,
    companyName,
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
    const existingRows = existingParticipantsForDuplicateCheck.map(demoParticipantToPilotRow);
    const useParticipantCommissionBase =
      isProjectMode &&
      commissionKind === 'pct_of_participant' &&
      commissionBaseParticipantOptions.length > 0;
    const trimmedCommissionBaseId = commissionBaseParticipantId.trim();
    const previewCommissionBaseParticipantId =
      useParticipantCommissionBase && trimmedCommissionBaseId
        ? trimmedCommissionBaseId
        : undefined;
    const previewBaseParticipant: BaseParticipantSlot | undefined =
      commissionKind === 'pct_of_participant'
        ? previewCommissionBaseParticipantId
          ? undefined
          : baseParticipant
        : baseParticipant;
    const draftRow: PilotParticipantCommissionRow = {
      id: INVITE_PREVIEW_PARTICIPANT_ID,
      name: name.trim() || 'New participant',
      companyName: companyName.trim() || undefined,
      commissionKind,
      commissionValue: parseFloat(commissionValue) || 0,
      baseParticipant: previewBaseParticipant,
      commissionBaseParticipantId: previewCommissionBaseParticipantId,
      formulaExpression: formulaExpression.trim() || undefined,
    };
    const joint = computeParticipantCommissionTotalsForDeal(v, featuredRoleAmounts, [
      ...existingRows,
      draftRow,
    ]);
    return resolveCommissionWithValidation(
      {
        commissionKind,
        commissionValue: draftRow.commissionValue,
        baseParticipant: previewBaseParticipant,
        commissionBaseParticipantId: previewCommissionBaseParticipantId,
        formulaExpression: draftRow.formulaExpression,
      },
      {
        dealValue: v,
        roleAmounts: featuredRoleAmounts,
        participantBaseTotals: joint.totals,
        participantLabels: joint.labels,
        resolvingParticipantId: INVITE_PREVIEW_PARTICIPANT_ID,
      }
    );
  }, [
    isProjectMode,
    commissionKind,
    commissionValue,
    baseParticipant,
    commissionBaseParticipantId,
    formulaExpression,
    featuredDealValue,
    featuredRoleAmounts,
    existingParticipantsForDuplicateCheck,
    commissionBaseParticipantOptions,
    name,
    companyName,
  ]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    if (isProjectMode) {
      if (
        commissionKind === 'pct_of_participant' &&
        commissionBaseParticipantOptions.length > 0 &&
        !commissionBaseParticipantId.trim()
      ) {
        setSubmitError('Choose a participant to base this percentage on.');
        return;
      }
      if (!preview.valid) {
        setSubmitError(preview.error ?? 'Invalid payout setup. Please fix the inputs.');
        return;
      }
      const num = parseFloat(commissionValue);
      const commissionNum =
        commissionKind === 'formula_advanced'
          ? num
          : Number.isFinite(num) && num >= 0
            ? num
            : 0;
      setSubmitError(null);
      const token = makeToken();
      const trimmedUrl = attachmentUrl.trim();
      const participant: DemoParticipant = {
        id: `part-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        role,
        commissionKind,
        commissionValue: commissionKind === 'formula_advanced' ? commissionNum : commissionNum,
        baseParticipant:
          commissionKind === 'pct_of_participant' &&
          (!isProjectMode || !commissionBaseParticipantId.trim())
            ? baseParticipant
            : undefined,
        commissionBaseParticipantId:
          isProjectMode &&
          commissionKind === 'pct_of_participant' &&
          commissionBaseParticipantId.trim()
            ? commissionBaseParticipantId.trim()
            : undefined,
        formulaExpression: commissionKind === 'formula_advanced' ? formulaExpression.trim() : undefined,
        status: 'Pending',
        inviteStatus: 'Invited',
        approvalStatus: 'Pending approval',
        onboardingStatus: 'NOT_STARTED',
        inviteToken: token,
        roleDetails: roleDetails.trim() || undefined,
        payoutCondition: payoutCondition.trim() || undefined,
        agreementNotes: agreementNotes.trim() || undefined,
        attachmentUrl: trimmedUrl || undefined,
        attachmentLabel: attachmentLabel.trim() || undefined,
        payoutDueDate: payoutDueDate.trim() || undefined,
        participantNotes: participantNotes.trim() || undefined,
        companyName: companyName.trim() || undefined,
      };
      const incomingNameKey = normParticipantName(participant.name);
      const existingDupes = existingParticipantsForDuplicateCheck.filter(
        (p) =>
          p.role === participant.role &&
          normParticipantName(p.name) === incomingNameKey
      );
      if (existingDupes.length > 0) {
        setDuplicateCandidates(existingDupes);
        setPendingDuplicateParticipant(participant);
        setDuplicateDialogOpen(true);
        return;
      }
      void (async () => {
        try {
          setSubmitError(null);
          const shared = await onInvite(participant, 'create_duplicate_anyway');
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const inviteLink =
            shared.inviteLink ??
            (origin ? `${origin}/deal-invites/${shared.inviteToken}` : '');
          setSuccessLink(inviteLink);
          toast.success('Participant invited');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to invite participant';
          setSubmitError(msg);
        }
      })();
      return;
    }

    if (!roleDetails.trim() || !payoutCondition.trim()) {
      setSubmitError('Role details and payout condition are required for the agreement record.');
      return;
    }
    const num = parseFloat(commissionValue);
    if (commissionKind !== 'formula_advanced' && (Number.isNaN(num) || num < 0)) return;
    if (
      isProjectMode &&
      commissionKind === 'pct_of_participant' &&
      commissionBaseParticipantOptions.length > 0 &&
      !commissionBaseParticipantId.trim()
    ) {
      setSubmitError('Choose a participant to base this percentage on.');
      return;
    }
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
        commissionKind === 'pct_of_participant' &&
        (!isProjectMode || !commissionBaseParticipantId.trim())
          ? baseParticipant
          : undefined,
      commissionBaseParticipantId:
        isProjectMode &&
        commissionKind === 'pct_of_participant' &&
        commissionBaseParticipantId.trim()
          ? commissionBaseParticipantId.trim()
          : undefined,
      formulaExpression: commissionKind === 'formula_advanced' ? formulaExpression.trim() : undefined,
      status: 'Pending',
      inviteStatus: 'Invited',
      approvalStatus: 'Pending approval',
      onboardingStatus: 'NOT_STARTED',
      inviteToken: token,
      roleDetails: roleDetails.trim(),
      payoutCondition: payoutCondition.trim(),
      agreementNotes: agreementNotes.trim() || undefined,
      attachmentUrl: trimmedUrl || undefined,
      attachmentLabel: attachmentLabel.trim() || undefined,
    };

    const incomingNameKey = normParticipantName(participant.name);
    const existingDupes = existingParticipantsForDuplicateCheck.filter(
      (p) =>
        p.role === participant.role &&
        normParticipantName(p.name) === incomingNameKey
    );

    if (existingDupes.length > 0) {
      setDuplicateCandidates(existingDupes);
      setPendingDuplicateParticipant(participant);
      setDuplicateDialogOpen(true);
      return;
    }

    void (async () => {
      try {
        setSubmitError(null);
        const shared = await onInvite(participant, 'create_duplicate_anyway');
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const inviteLink =
          shared.inviteLink ??
          (origin ? `${origin}/deal-invites/${shared.inviteToken}` : '');
        setSuccessLink(inviteLink);
        toast.success('Participant invited');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to invite participant';
        setSubmitError(msg);
      }
    })();
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
    <>
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
              : isProjectMode
                ? 'Add a participant to the active project. Payout details can stay high-level until funding is linked.'
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
            {isProjectMode ? (
              <div className="space-y-2">
                <Label htmlFor="inv-co">Company (optional)</Label>
                <Input
                  id="inv-co"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Trading or legal name"
                  autoComplete="organization"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>{isProjectMode ? 'Role (optional)' : 'Role'}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as DemoParticipantRole)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isProjectMode ? (
                    <>
                      <SelectItem value="Contributor">Participant</SelectItem>
                      <SelectItem value="Connector">Coordinator</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="Introducer">Introducer</SelectItem>
                      <SelectItem value="Connector">Connector</SelectItem>
                      <SelectItem value="Closer">Closer</SelectItem>
                      <SelectItem value="Contributor">Contributor</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            {isProjectMode ? (
              <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
                <p className="text-sm font-medium">Participant details</p>
                <div className="space-y-2">
                  <Label htmlFor="inv-due">Payout due date (optional)</Label>
                  <Input
                    id="inv-due"
                    type="date"
                    value={payoutDueDate}
                    onChange={(e) => setPayoutDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-pnotes">Notes (optional)</Label>
                  <Textarea
                    id="inv-pnotes"
                    value={participantNotes}
                    onChange={(e) => setParticipantNotes(e.target.value)}
                    placeholder="Internal notes — milestones, contractor context, or payment expectations."
                    rows={3}
                    className="resize-y"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-role-details-p">Scope (optional)</Label>
                  <Textarea
                    id="inv-role-details-p"
                    value={roleDetails}
                    onChange={(e) => setRoleDetails(e.target.value)}
                    placeholder="What this participant is delivering, if you want it recorded."
                    rows={2}
                    className="resize-y"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-payout-condition-p">Payout condition (optional)</Label>
                  <Textarea
                    id="inv-payout-condition-p"
                    value={payoutCondition}
                    onChange={(e) => setPayoutCondition(e.target.value)}
                    placeholder="e.g. After client payment clears; on invoice approval."
                    rows={2}
                    className="resize-y"
                  />
                </div>
              </div>
            ) : (
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
            )}

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
                    {commissionStructureSelectOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {commissionKind === 'pct_deal_value' ? (
                <div className="space-y-2">
                  <Label htmlFor="inv-pct-deal">
                    {isProjectMode ? 'Percentage of project value' : 'Percentage of deal value'}
                  </Label>
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
                  <Label htmlFor="inv-fixed">
                    {isProjectMode ? 'Fixed payout amount (AUD)' : 'Fixed amount (USD)'}
                  </Label>
                  <Input
                    id="inv-fixed"
                    type="number"
                    min={0}
                    step="any"
                    value={commissionValue}
                    onChange={(e) => setCommissionValue(e.target.value)}
                    required
                  />
                </div>
              ) : null}

              {commissionKind === 'pct_of_participant' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{isProjectMode ? 'Base participant' : 'Deal role pool'}</Label>
                    {isProjectMode ? (
                      commissionBaseParticipantOptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground rounded-md border bg-muted/30 p-2">
                          Add at least one other participant to this deal before using percentage-of-participant.
                        </p>
                      ) : (
                        <Select
                          value={commissionBaseParticipantId}
                          onValueChange={(v) => setCommissionBaseParticipantId(v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select participant" />
                          </SelectTrigger>
                          <SelectContent>
                            {commissionBaseParticipantOptions.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.companyName?.trim()
                                  ? `${o.name.trim()} (${o.companyName.trim()})`
                                  : o.name.trim()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )
                    ) : (
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
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-pct-base">Percentage of base</Label>
                    <Input
                      id="inv-pct-base"
                      type="number"
                      min={0}
                      step="any"
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
                  Resolved (demo):{' '}
                  {isProjectMode ? `$${preview.total.toLocaleString()} AUD` : `$${preview.total.toLocaleString()}`}
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
              <Button
                type="submit"
                disabled={
                  isProjectMode ? !preview.valid : !preview.valid || preview.total <= 0
                }
              >
                Invite Participant
              </Button>
            </DialogFooter>
          </form>
        )}
        </div>
      </DialogContent>
    </Dialog>
    {pendingDuplicateParticipant ? (
      <AlertDialog
        open={duplicateDialogOpen}
        onOpenChange={(next) => {
          if (!next) {
            setDuplicateDialogOpen(false);
            setPendingDuplicateParticipant(null);
            setDuplicateCandidates([]);
            setDuplicateSubmitting(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Possible duplicate detected</AlertDialogTitle>
            <AlertDialogDescription>
              A participant with the same name and role already exists on this deal. Choose how to proceed.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
            <p>
              <span className="font-medium">Name:</span> {pendingDuplicateParticipant.name}
            </p>
            <p>
              <span className="font-medium">Role:</span> {pendingDuplicateParticipant.role}
            </p>
            <p className="text-muted-foreground">Matches found: {duplicateCandidates.length}</p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={duplicateSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-muted text-foreground hover:bg-muted/80"
              disabled={duplicateSubmitting}
              onClick={() => {
                void (async () => {
                  try {
                    setDuplicateSubmitting(true);
                    const shared = await onInvite(
                      pendingDuplicateParticipant,
                      'use_existing'
                    );
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const inviteLink =
                      shared.inviteLink ??
                      (origin ? `${origin}/deal-invites/${shared.inviteToken}` : '');
                    setSuccessLink(inviteLink);
                    setDuplicateDialogOpen(false);
                    setPendingDuplicateParticipant(null);
                    setDuplicateCandidates([]);
                    toast.success('Participant invite re-used');
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Failed to use existing participant';
                    setSubmitError(msg);
                  } finally {
                    setDuplicateSubmitting(false);
                  }
                })();
              }}
            >
              Use existing participant
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={duplicateSubmitting}
              onClick={() => {
                void (async () => {
                  try {
                    setDuplicateSubmitting(true);
                    const shared = await onInvite(
                      pendingDuplicateParticipant,
                      'create_duplicate_anyway'
                    );
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const inviteLink =
                      shared.inviteLink ??
                      (origin ? `${origin}/deal-invites/${shared.inviteToken}` : '');
                    setSuccessLink(inviteLink);
                    setDuplicateDialogOpen(false);
                    setPendingDuplicateParticipant(null);
                    setDuplicateCandidates([]);
                    toast.success('Duplicate participant created');
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Failed to create duplicate';
                    setSubmitError(msg);
                  } finally {
                    setDuplicateSubmitting(false);
                  }
                })();
              }}
            >
              Create duplicate anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ) : null}
    </>
  );
}
