'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  PARTICIPANT_COMPENSATION_TYPES,
  REVENUE_SOURCE_OPTIONS,
  type ParticipantCompensationProfile,
  type ParticipantCompensationType,
  type CommissionSourceMode,
} from '@/lib/participants/participant-compensation-types';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';
import { safeDefaultCompensationProfile } from '@/lib/operational/safe-operational-hydration';
import { ServiceCatalogGuidance } from '@/components/operations/service-catalog-guidance';

type CatalogService = { id: string; name: string; price?: number; currency?: string };

const COMPENSATION_LABELS: Record<ParticipantCompensationType, string> = {
  FIXED_FEE: 'Fixed fee',
  REVENUE_SHARE: 'Revenue share',
  COMMISSION: 'Commission',
  HYBRID: 'Hybrid',
  REIMBURSEMENT: 'Reimbursement',
  CUSTOM: 'Manual / custom',
  UNPAID_INTERNAL: 'Unpaid / internal (no payout)',
};

type ParticipantCompensationDialogProps = {
  participant: DemoParticipant | null;
  organizationId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (profile: ParticipantCompensationProfile) => Promise<void>;
};

export function ParticipantCompensationDialog({
  participant,
  organizationId,
  open,
  onOpenChange,
  onSave,
}: ParticipantCompensationDialogProps) {
  const [saving, setSaving] = React.useState(false);
  const [serviceQuery, setServiceQuery] = React.useState('');
  const [catalogServices, setCatalogServices] = React.useState<CatalogService[]>([]);
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [draft, setDraft] = React.useState<ParticipantCompensationProfile>({
    compensationType: 'FIXED_FEE',
    configured: false,
    revenueSources: [],
  });

  React.useEffect(() => {
    if (!participant) return;
    setServiceQuery('');
    try {
      setDraft(
        participant.compensationProfile ?? safeDefaultCompensationProfile(participant)
      );
    } catch {
      setDraft({
        compensationType: 'FIXED_FEE',
        configured: false,
        revenueSources: [],
        customerAttributionEnabled: false,
        commissionSourceMode: 'all_active',
        commissionServiceIds: [],
      });
    }
  }, [participant]);

  React.useEffect(() => {
    if (!open || !organizationId || draft.compensationType !== 'COMMISSION') return;
    let cancelled = false;
    setCatalogLoading(true);
    void fetch(
      `/api/organization-services?organizationId=${encodeURIComponent(organizationId)}&status=active`
    )
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json: { data?: CatalogService[] }) => {
        if (!cancelled) setCatalogServices(Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => {
        if (!cancelled) setCatalogServices([]);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, organizationId, draft.compensationType]);

  const showPercentage =
    draft.compensationType === 'REVENUE_SHARE' ||
    draft.compensationType === 'COMMISSION' ||
    draft.compensationType === 'HYBRID';
  const showFixed =
    draft.compensationType === 'FIXED_FEE' ||
    draft.compensationType === 'REIMBURSEMENT' ||
    draft.compensationType === 'HYBRID' ||
    draft.compensationType === 'CUSTOM';
  const showRevenueSources =
    draft.compensationType === 'REVENUE_SHARE' || draft.compensationType === 'HYBRID';
  const isExempt = draft.compensationType === 'UNPAID_INTERNAL';
  const showCommissionSource = draft.compensationType === 'COMMISSION';
  const commissionMode = draft.commissionSourceMode ?? 'all_active';
  const filteredServices = catalogServices.filter((s) =>
    s.name.toLowerCase().includes(serviceQuery.toLowerCase())
  );

  async function handleSave() {
    setSaving(true);
    try {
      const profile: ParticipantCompensationProfile = {
        ...draft,
        exemptFromPayout: isExempt,
        configured: true,
        configuredAt: new Date().toISOString(),
      };
      await onSave(profile);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  if (!participant) return null;

  const preview = React.useMemo(() => {
    try {
      return applyCompensationProfileToParticipant(participant, {
        ...draft,
        configured: true,
      });
    } catch {
      return participant;
    }
  }, [participant, draft]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compensation structure · {participant.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Compensation type</Label>
            <Select
              value={draft.compensationType}
              onValueChange={(v) =>
                setDraft({ ...draft, compensationType: v as ParticipantCompensationType })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARTICIPANT_COMPENSATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {COMPENSATION_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isExempt && showPercentage ? (
            <div className="space-y-1">
              <Label htmlFor="comp-pct">Percentage</Label>
              <Input
                id="comp-pct"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={draft.percentage ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    percentage: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                placeholder="15"
              />
            </div>
          ) : null}

          {!isExempt && showFixed ? (
            <div className="space-y-1">
              <Label htmlFor="comp-fixed">Fixed amount</Label>
              <Input
                id="comp-fixed"
                type="number"
                min={0}
                step="0.01"
                value={draft.fixedAmount ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    fixedAmount: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                placeholder="5000"
              />
            </div>
          ) : null}

          {!isExempt && showRevenueSources ? (
            <div className="space-y-2">
              <Label>Revenue sources</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {REVENUE_SOURCE_OPTIONS.map((src) => {
                  const checked = draft.revenueSources?.includes(src.id) ?? false;
                  return (
                    <label
                      key={src.id}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const set = new Set(draft.revenueSources ?? []);
                          if (v) set.add(src.id);
                          else set.delete(src.id);
                          setDraft({ ...draft, revenueSources: [...set] });
                        }}
                      />
                      {src.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {!isExempt && showCommissionSource ? (
            <div className="space-y-3 rounded-md border border-border/40 p-3">
              <Label>Commission source</Label>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="commission-source"
                    checked={commissionMode === 'all_active'}
                    onChange={() =>
                      setDraft({
                        ...draft,
                        commissionSourceMode: 'all_active' as CommissionSourceMode,
                      })
                    }
                  />
                  All active services
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="commission-source"
                    checked={commissionMode === 'selected'}
                    onChange={() =>
                      setDraft({
                        ...draft,
                        commissionSourceMode: 'selected' as CommissionSourceMode,
                      })
                    }
                  />
                  Selected services/products
                </label>
              </div>
              {commissionMode === 'selected' ? (
                catalogLoading ? (
                  <p className="text-xs text-muted-foreground">Loading service catalog…</p>
                ) : catalogServices.length === 0 ? (
                  <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-xs space-y-2">
                    <p>No services/products available yet.</p>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/dashboard/settings/services">Add services</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="Search services…"
                      value={serviceQuery}
                      onChange={(e) => setServiceQuery(e.target.value)}
                    />
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {filteredServices.map((s) => {
                        const checked = draft.commissionServiceIds?.includes(s.id) ?? false;
                        return (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const set = new Set(draft.commissionServiceIds ?? []);
                                if (v) set.add(s.id);
                                else set.delete(s.id);
                                setDraft({ ...draft, commissionServiceIds: [...set] });
                              }}
                            />
                            {s.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )
              ) : null}
            </div>
          ) : null}

          {!isExempt ? (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={draft.customerAttributionEnabled === true}
                  onCheckedChange={(v) =>
                    setDraft({ ...draft, customerAttributionEnabled: v === true })
                  }
                />
                Enable customer purchase attribution
              </label>
              <ServiceCatalogGuidance
                organizationId={organizationId}
                attributionEnabled={draft.customerAttributionEnabled === true}
              />
            </div>
          ) : null}

          {!isExempt ? (
            <div className="space-y-1">
              <Label htmlFor="comp-min">Minimum guarantee (optional)</Label>
              <Input
                id="comp-min"
                type="number"
                min={0}
                value={draft.minimumGuarantee ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    minimumGuarantee:
                      e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                placeholder="500"
              />
            </div>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="comp-notes">Notes</Label>
            <Textarea
              id="comp-notes"
              rows={2}
              value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Allocation context for operators and agreements"
            />
          </div>

          <p className="text-xs text-muted-foreground rounded-md border border-border/30 px-3 py-2">
            Preview:{' '}
            {isExempt
              ? 'No payout — internal or unpaid role'
              : `${preview.participationModel ?? '—'} · stored for readiness only (no settlement calc)`}
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save compensation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
