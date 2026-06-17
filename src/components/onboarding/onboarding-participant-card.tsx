'use client';

import * as React from 'react';
import { AlertTriangle, Check, Pencil, Trash2 } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  ONBOARDING_PARTICIPANT_ROLES,
  type OnboardingParticipantRole,
} from '@/lib/onboarding/operator-onboarding-types';
import type { ParticipantCompensationProfile } from '@/lib/participants/participant-compensation-types';
import type { ProjectParticipationModel } from '@/lib/projects/participant-entitlement';
import type { ParticipantObligationGraph } from '@/lib/ai-extractor/extraction-obligations';
import type { PreferredPaymentMethod } from '@/lib/onboarding/participant-profile-readiness';
import { deriveParticipantProfileStatus } from '@/lib/onboarding/participant-profile-readiness';
import { cn } from '@/lib/utils';

export type OnboardingDraftParticipant = {
  name: string;
  email: string;
  role: OnboardingParticipantRole;
  notes?: string;
  preferredPaymentMethod?: PreferredPaymentMethod;
  taxIdentifier?: string;
  /** From conversation import — optional for manual rows. */
  participationModel?: ProjectParticipationModel;
  commissionValue?: number;
  compensationProfile?: ParticipantCompensationProfile;
  extractedObligations?: ParticipantObligationGraph;
};

const PAYMENT_OPTIONS: { value: PreferredPaymentMethod; label: string }[] = [
  { value: 'bank_account', label: 'Bank Transfer' },
  { value: 'stripe_connect', label: 'Stripe' },
  { value: 'wallet', label: 'Stablecoin' },
  { value: 'revenue_share_only', label: 'Revenue Share Only' },
  { value: 'manual', label: 'Manual Settlement' },
];

type OnboardingParticipantCardProps = {
  participant: OnboardingDraftParticipant;
  onUpdate: (next: OnboardingDraftParticipant) => void;
  onRemove: () => void;
  /** Propagate key field changes immediately for live agreement preview. */
  livePreview?: boolean;
};

function ProfileStatusRow({
  ok,
  warning,
  label,
}: {
  ok: boolean;
  warning: boolean;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok && !warning ? (
        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden />
      ) : (
        <AlertTriangle
          className={cn('h-3.5 w-3.5 shrink-0', warning ? 'text-amber-600' : 'text-muted-foreground')}
          aria-hidden
        />
      )}
      <span className={warning ? 'text-amber-950' : 'text-muted-foreground'}>{label}</span>
    </li>
  );
}

export function OnboardingParticipantCard({
  participant,
  onUpdate,
  onRemove,
  livePreview = false,
}: OnboardingParticipantCardProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(participant);
  const status = deriveParticipantProfileStatus(participant);
  const draftStatus = deriveParticipantProfileStatus(draft);

  React.useEffect(() => {
    setDraft(participant);
  }, [participant]);

  function pushLiveUpdate(next: OnboardingDraftParticipant) {
    setDraft(next);
    if (livePreview) {
      onUpdate({
        ...next,
        name: next.name.trim() || participant.name,
        email: next.email.trim(),
        taxIdentifier: next.taxIdentifier?.trim() || undefined,
      });
    }
  }

  function saveEdit() {
    if (!draft.name.trim()) return;
    onUpdate({
      ...draft,
      name: draft.name.trim(),
      email: draft.email.trim(),
      taxIdentifier: draft.taxIdentifier?.trim() || undefined,
    });
    setEditOpen(false);
  }

  return (
    <>
      <div className="rounded-lg border border-[rgba(124,92,255,0.12)] bg-white px-3 py-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
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
        <ul className="space-y-1 pt-1 border-t border-border/40">
          <ProfileStatusRow
            ok={status.contactable}
            warning={!status.contactable}
            label={status.contactable ? 'Contactable' : 'Email missing'}
          />
          <ProfileStatusRow
            ok={!status.paymentWarning}
            warning={status.paymentWarning}
            label={status.paymentLabel}
          />
          <ProfileStatusRow
            ok={!status.taxWarning}
            warning={status.taxWarning}
            label={status.taxLabel}
          />
        </ul>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit participant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Participant
              </p>
              <div className="space-y-1">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={draft.name}
                  onChange={(e) => pushLiveUpdate({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => pushLiveUpdate({ ...draft, email: e.target.value })}
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
            </div>

            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Settlement
              </p>
              <p className="text-sm text-foreground">How will this participant be paid?</p>
              <RadioGroup
                value={draft.preferredPaymentMethod ?? ''}
                onValueChange={(v) =>
                  pushLiveUpdate({
                    ...draft,
                    preferredPaymentMethod: v as PreferredPaymentMethod,
                  })
                }
                className="grid gap-2 sm:grid-cols-2"
              >
                {PAYMENT_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={opt.value} id={`pay-${opt.value}`} />
                    <Label htmlFor={`pay-${opt.value}`} className="font-normal cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-1 pt-2 border-t">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tax
              </p>
              <Label htmlFor="edit-tax">ABN / GST (optional)</Label>
              <Input
                id="edit-tax"
                value={draft.taxIdentifier ?? ''}
                onChange={(e) => setDraft({ ...draft, taxIdentifier: e.target.value })}
                placeholder="e.g. 12 345 678 901"
              />
            </div>

            <div className="space-y-1 pt-2 border-t">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              <ul className="space-y-1">
                <ProfileStatusRow
                  ok={draftStatus.contactable}
                  warning={!draftStatus.contactable}
                  label={draftStatus.contactable ? 'Contactable' : 'Email missing'}
                />
                <ProfileStatusRow
                  ok={!draftStatus.paymentWarning}
                  warning={draftStatus.paymentWarning}
                  label={draftStatus.paymentLabel}
                />
                <ProfileStatusRow
                  ok={!draftStatus.taxWarning}
                  warning={draftStatus.taxWarning}
                  label={draftStatus.taxLabel}
                />
              </ul>
            </div>

            <div className="space-y-1 pt-2 border-t">
              <Label htmlFor="edit-notes">Additional Context for AI</Label>
              <Textarea
                id="edit-notes"
                rows={2}
                value={draft.notes ?? ''}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="e.g. Pays monthly via Wise, ABN supplied separately"
              />
              <p className="text-[11px] text-muted-foreground">
                Used to improve agreement interpretation and settlement recommendations.
              </p>
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
