'use client';

import * as React from 'react';
import { Copy, Loader2 } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { resolveCommissionWithValidation } from '@/lib/deal-network-demo/commission-structure';
import {
  defaultReferralCommerce,
  normalizeReferralCommerce,
  type ParticipantReferralCommerce,
} from '@/lib/referrals/referral-commerce-config';
import { ReferralCommerceSection } from '@/components/referrals/referral-commerce-section';
import {
  buildProjectParticipant,
  buildReferralCommerceForProject,
  participantAgreementPath,
  participationModelToCommissionKind,
  type ProjectParticipationModel,
} from '@/lib/projects/participant-entitlement';
import type { OperationalParticipantRole } from '@/lib/projects/participants-for-project';
import { getProjectDisplayName } from '@/lib/projects/get-project-display-name';

type InviteProjectParticipantModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: RecentDeal;
  organizationId: string | null;
  onSubmit: (participant: DemoParticipant) => Promise<DemoParticipant | void>;
};

type ModalStep = 1 | 2 | 'agreement';

const ROLES: OperationalParticipantRole[] = [
  'Partner',
  'Co-founder',
  'Stakeholder',
  'Contributor',
  'Contractor',
  'Referrer',
];

const PARTICIPATION_MODELS: {
  id: ProjectParticipationModel;
  title: string;
  description: string;
}[] = [
  {
    id: 'fixed_payout',
    title: 'Fixed payout',
    description: 'Assign a fixed amount to this participant when the project settles.',
  },
  {
    id: 'revenue_share',
    title: 'Revenue share',
    description: 'Allocate a percentage of project revenue or value.',
  },
  {
    id: 'customer_attribution',
    title: 'Customer attribution',
    description:
      'Allow this participant to earn from purchases through their referral/payment link.',
  },
];

export function InviteProjectParticipantModal({
  open,
  onOpenChange,
  project,
  organizationId,
  onSubmit,
}: InviteProjectParticipantModalProps) {
  const projectLabel = getProjectDisplayName({ dealName: project.dealName });

  const [step, setStep] = React.useState<ModalStep>(1);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<OperationalParticipantRole>('Contributor');
  const [notes, setNotes] = React.useState('');
  const [payoutDueDate, setPayoutDueDate] = React.useState('');
  const [participationModel, setParticipationModel] =
    React.useState<ProjectParticipationModel>('fixed_payout');
  const [entitlementValue, setEntitlementValue] = React.useState('0');
  const [enableCustomerAttribution, setEnableCustomerAttribution] = React.useState(false);
  const [referralCommerce, setReferralCommerce] =
    React.useState<ParticipantReferralCommerce>(defaultReferralCommerce());
  const [saving, setSaving] = React.useState(false);
  const [agreementLink, setAgreementLink] = React.useState<string | null>(null);

  const commissionKind = participationModelToCommissionKind(participationModel);

  React.useEffect(() => {
    if (!open) {
      setStep(1);
      setName('');
      setEmail('');
      setRole('Contributor');
      setNotes('');
      setPayoutDueDate('');
      setParticipationModel('fixed_payout');
      setEntitlementValue('0');
      setEnableCustomerAttribution(false);
      setReferralCommerce(defaultReferralCommerce());
      setAgreementLink(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (participationModel === 'customer_attribution') {
      setEnableCustomerAttribution(true);
      setReferralCommerce((prev) =>
        normalizeReferralCommerce({
          ...prev,
          createReferralLink: true,
          commissionMode: 'referral_commerce',
        })
      );
    }
  }, [participationModel]);

  React.useEffect(() => {
    if (participationModel === 'fixed_payout') {
      setEntitlementValue((v) => (v === '10' ? '0' : v));
    } else if (participationModel === 'revenue_share') {
      setEntitlementValue((v) => (v === '0' ? '10' : v));
    }
  }, [participationModel]);

  const entitlementNumeric = parseFloat(entitlementValue);
  const hasMeaningfulEntitlement =
    participationModel === 'fixed_payout'
      ? Number.isFinite(entitlementNumeric) && entitlementNumeric > 0
      : participationModel === 'revenue_share'
        ? Number.isFinite(entitlementNumeric) && entitlementNumeric > 0
        : false;

  const preview = React.useMemo(() => {
    const num = parseFloat(entitlementValue);
    const commissionNum = Number.isFinite(num) && num >= 0 ? num : 0;
    return resolveCommissionWithValidation(
      { commissionKind, commissionValue: commissionNum },
      { dealValue: project.value }
    );
  }, [commissionKind, entitlementValue, project.value]);

  const attributionEnabled =
    participationModel === 'customer_attribution' || enableCustomerAttribution;

  const continueToStepTwo = () => {
    if (!name.trim()) {
      toast.error('Name is required.');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required.');
      return;
    }
    if (participationModel !== 'customer_attribution' && !preview.valid) {
      toast.error(preview.error ?? 'Check earning configuration.');
      return;
    }

    setSaving(true);
    try {
      const num = parseFloat(entitlementValue);
      const commissionValue = Number.isFinite(num) && num >= 0 ? num : 0;

      const commerce = attributionEnabled
        ? normalizeReferralCommerce({
            ...referralCommerce,
            createReferralLink: true,
            commissionMode:
              participationModel === 'customer_attribution' ||
              referralCommerce.commissionMode === 'referral_commerce'
                ? 'referral_commerce'
                : referralCommerce.commissionMode,
          })
        : buildReferralCommerceForProject({
            participationModel,
            enableCustomerAttribution: false,
          });

      const participant = buildProjectParticipant({
        name,
        email: email.trim() || undefined,
        role,
        project,
        notes: notes || undefined,
        payoutDueDate: payoutDueDate || undefined,
        participationModel,
        commissionKind,
        commissionValue:
          participationModel === 'customer_attribution' ? 0 : commissionValue,
        enableCustomerAttribution: attributionEnabled,
        referralCommerce: commerce,
        sendInvite: !!email.trim(),
      });

      const saved = await onSubmit(participant);
      const finalParticipant = saved ?? participant;

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const agreementPath =
        finalParticipant.agreementUrl ?? participantAgreementPath(finalParticipant.inviteToken);
      const fullAgreementUrl = origin ? `${origin}${agreementPath}` : agreementPath;

      setAgreementLink(fullAgreementUrl);
      setStep('agreement');
      toast.success(`${finalParticipant.name} added. Share the agreement link.`);
    } catch {
      toast.error('Could not add participant. Try again.');
    } finally {
      setSaving(false);
    }
  };

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col gap-0 overflow-hidden p-0">
        <div className="max-h-[90vh] overflow-y-auto px-6 pt-6 pb-6">
          <DialogHeader>
            <DialogTitle>
              {step === 'agreement'
                ? 'Agreement link ready'
                : step === 1
                  ? 'Add project participant'
                  : 'Configure participation'}
            </DialogTitle>
            <DialogDescription>
              {step === 'agreement'
                ? 'Share this link so the participant can review and approve participation. Customer payment links activate only after approval.'
                : step === 1
                  ? `Add a stakeholder to ${projectLabel}.`
                  : 'Choose how this participant earns from the project.'}
            </DialogDescription>
          </DialogHeader>

          {step === 'agreement' && agreementLink ? (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <Label className="text-xs text-muted-foreground">Participant agreement link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={agreementLink} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void copyText(agreementLink)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : step === 1 ? (
            <div className="space-y-6 py-4">
              <section className="space-y-3">
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="proj-invite-name">Name</Label>
                    <Input
                      id="proj-invite-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name or placeholder label"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="proj-invite-email">Email (optional)</Label>
                    <Input
                      id="proj-invite-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Leave blank for draft / internal allocation"
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
                    <Label htmlFor="proj-invite-notes">Notes (optional)</Label>
                    <Textarea
                      id="proj-invite-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Scope, deliverables, or internal context"
                      rows={2}
                    />
                  </div>
                </div>
              </section>

              <p className="text-xs text-muted-foreground">
                You can configure payout structure next.
              </p>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={continueToStepTwo}>
                  Continue
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 py-4">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Participation model</h3>
                <div className="grid gap-2">
                  {PARTICIPATION_MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setParticipationModel(m.id)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors',
                        participationModel === m.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-accent/50'
                      )}
                    >
                      <p className="font-medium text-sm">{m.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Earning configuration</h3>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                  {participationModel === 'fixed_payout' ? (
                    <div className="grid gap-2">
                      <Label htmlFor="proj-fixed">Fixed payout amount</Label>
                      <Input
                        id="proj-fixed"
                        type="number"
                        min={0}
                        step="any"
                        value={entitlementValue}
                        onChange={(e) => setEntitlementValue(e.target.value)}
                      />
                    </div>
                  ) : null}
                  {participationModel === 'revenue_share' ? (
                    <div className="grid gap-2">
                      <Label htmlFor="proj-pct">Percentage of project value (%)</Label>
                      <Input
                        id="proj-pct"
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={entitlementValue}
                        onChange={(e) => setEntitlementValue(e.target.value)}
                      />
                    </div>
                  ) : null}
                  {participationModel === 'customer_attribution' ? (
                    <p className="text-sm text-muted-foreground">
                      Primary earnings come from attributable customer purchases. Configure the
                      revenue share on purchases below.
                    </p>
                  ) : null}

                  <div className="grid gap-2">
                    <Label htmlFor="proj-payout-due">Payout due date (optional)</Label>
                    <Input
                      id="proj-payout-due"
                      type="date"
                      value={payoutDueDate}
                      onChange={(e) => setPayoutDueDate(e.target.value)}
                    />
                  </div>

                  {participationModel !== 'customer_attribution' &&
                  hasMeaningfulEntitlement &&
                  preview.previewLine ? (
                    <div className="rounded-md border bg-background px-3 py-2 text-sm">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Entitlement preview
                      </p>
                      <p>{preview.previewLine}</p>
                      <p className="font-semibold tabular-nums mt-1">
                        ${preview.total.toLocaleString()}
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold">Issue referral/payment link</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Allow this participant to earn from attributable purchases.
                    </p>
                  </div>
                  {participationModel !== 'customer_attribution' ? (
                    <Switch
                      checked={enableCustomerAttribution}
                      onCheckedChange={(c) => {
                        setEnableCustomerAttribution(c);
                        setReferralCommerce((prev) =>
                          normalizeReferralCommerce({ ...prev, createReferralLink: c })
                        );
                      }}
                    />
                  ) : null}
                </div>

                {attributionEnabled ? (
                  <ReferralCommerceSection
                    organizationId={organizationId}
                    value={referralCommerce}
                    onChange={setReferralCommerce}
                    tone="operational"
                    hideEnableToggle
                  />
                ) : null}
              </section>

              <Alert>
                <AlertDescription className="text-sm">
                  This participant can accrue attributable earnings and obligations immediately.
                  Identity verification and payout setup are only required before funds are released.
                </AlertDescription>
              </Alert>

              <DialogFooter className="flex-col items-stretch sm:items-end gap-2">
                <div className="flex w-full justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={saving}>
                    Back
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {email.trim() ? 'Add participant' : 'Save draft participant'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  You can review and send the participant agreement after saving.
                </p>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
