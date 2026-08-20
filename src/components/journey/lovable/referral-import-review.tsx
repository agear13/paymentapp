'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ReferralImportCandidate, ReferralImportPreview } from '@/lib/workflows/referral-management/import-from-extraction';
import type { ReferralManagementContext } from '@/lib/workflows/referral-management/hub.server';

export function ReferralImportReview({
  preview,
  catalog,
  busy,
  error,
  onChange,
  onConfirm,
  onBack,
}: {
  preview: ReferralImportPreview;
  catalog: ReferralManagementContext['catalog'];
  busy: boolean;
  error: string | null;
  onChange: (preview: ReferralImportPreview) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const updateCandidate = (partyId: string, patch: Partial<ReferralImportCandidate>) => {
    onChange({
      ...preview,
      candidates: preview.candidates.map((row) => (row.partyId === partyId ? { ...row, ...patch } : row)),
    });
  };

  const selectedCount = preview.candidates.filter((row) => row.selected).length;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          Referral relationship found
        </p>
        <p className="mt-1 text-[13px] text-ink-soft">
          Source: {preview.sourceLabel}
          {preview.projectName ? ` · ${preview.projectName}` : ''}
        </p>
        <p className="mt-1 text-[13px] text-ink-soft">
          Review and edit the referral-specific fields, then confirm. Contractual parties are not added as
          promoters.
        </p>
      </div>

      {preview.candidates.length === 0 ? (
        <p className="text-[13px] text-ink-soft">
          No referral or commission relationship was found. Venue, talent, and other contractual parties are
          not imported automatically.
        </p>
      ) : (
        <ul className="space-y-4">
          {preview.candidates.map((candidate) => (
            <li key={candidate.partyId} className="space-y-3 rounded-xl border border-border p-3">
              <label className="flex items-start gap-2 text-[14px] font-medium">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={candidate.selected}
                  onChange={(event) => updateCandidate(candidate.partyId, { selected: event.target.checked })}
                />
                <span>
                  {candidate.name}
                  <span className="block text-[12px] font-normal text-ink-soft">
                    {candidate.extractedRole} · {candidate.commissionLabel}
                    {candidate.extractedServiceLabel ? ` · ${candidate.extractedServiceLabel}` : ''}
                  </span>
                </span>
              </label>
              <Input
                value={candidate.name}
                onChange={(event) => updateCandidate(candidate.partyId, { name: event.target.value })}
                placeholder="Promoter / referrer name"
              />
              <Input
                type="email"
                value={candidate.email}
                onChange={(event) => updateCandidate(candidate.partyId, { email: event.target.value })}
                placeholder="Email"
              />
              <Input
                value={candidate.phone}
                onChange={(event) => updateCandidate(candidate.partyId, { phone: event.target.value })}
                placeholder="Phone (optional)"
              />
              <select
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={candidate.role}
                onChange={(event) =>
                  updateCandidate(candidate.partyId, {
                    role: event.target.value as ReferralImportCandidate['role'],
                  })
                }
              >
                <option>Promoter</option>
                <option>Affiliate</option>
                <option>Partner</option>
                <option>Other</option>
              </select>
              <select
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={candidate.serviceId ?? ''}
                onChange={(event) =>
                  updateCandidate(candidate.partyId, {
                    serviceId: event.target.value || null,
                    serviceMatch: event.target.value ? 'exact' : 'none',
                  })
                }
              >
                <option value="">
                  {candidate.serviceMatch === 'ambiguous'
                    ? 'Choose the matching catalogue service'
                    : 'Select an existing catalogue service'}
                </option>
                {(candidate.serviceSuggestions.length > 0 ? candidate.serviceSuggestions : catalog).map(
                  (service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  )
                )}
              </select>
              {candidate.serviceMatch === 'none' && catalog.length > 0 ? (
                <p className="text-[12px] text-ink-soft">
                  No exact catalogue match
                  {candidate.extractedServiceLabel ? ` for “${candidate.extractedServiceLabel}”` : ''}.
                  Choose an existing service. A new service will not be created here.
                </p>
              ) : null}
              {catalog.length === 0 ? (
                <p className="text-[12px] text-amber-800 dark:text-amber-200">
                  Add an active catalogue service before confirming. A checkout destination will not be
                  fabricated.
                </p>
              ) : null}
              <div className="flex gap-2 text-[13px]">
                <button
                  type="button"
                  className={candidate.compensationKind === 'revenue_share' ? 'font-semibold' : 'text-ink-soft'}
                  onClick={() =>
                    updateCandidate(candidate.partyId, {
                      compensationKind: 'revenue_share',
                      commissionLabel: candidate.percentage
                        ? `${candidate.percentage}% revenue share`
                        : 'Revenue share',
                    })
                  }
                >
                  Revenue share
                </button>
                <button
                  type="button"
                  className={candidate.compensationKind === 'fixed' ? 'font-semibold' : 'text-ink-soft'}
                  onClick={() =>
                    updateCandidate(candidate.partyId, {
                      compensationKind: 'fixed',
                      commissionLabel: candidate.amount
                        ? `${candidate.currency} ${candidate.amount} fixed commission`
                        : 'Fixed commission',
                    })
                  }
                >
                  Fixed commission
                </button>
              </div>
              {candidate.compensationKind === 'revenue_share' ? (
                <Input
                  type="number"
                  min={0.01}
                  max={100}
                  step="0.01"
                  value={candidate.percentage ?? ''}
                  onChange={(event) =>
                    updateCandidate(candidate.partyId, {
                      percentage: event.target.value === '' ? null : Number(event.target.value),
                      commissionLabel: `${event.target.value}% revenue share`,
                    })
                  }
                  placeholder="Commission %"
                />
              ) : (
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={candidate.amount ?? ''}
                  onChange={(event) =>
                    updateCandidate(candidate.partyId, {
                      amount: event.target.value === '' ? null : Number(event.target.value),
                      commissionLabel: `${candidate.currency} ${event.target.value} fixed commission`,
                    })
                  }
                  placeholder="Fixed amount"
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {preview.excludedParties.length > 0 ? (
        <div className="rounded-xl bg-secondary/20 p-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">Not imported</p>
          <ul className="mt-2 space-y-1">
            {preview.excludedParties.map((party) => (
              <li key={`${party.name}-${party.role}`} className="text-[13px] text-ink-soft">
                {party.name} ({party.role}) — {party.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy || selectedCount === 0} onClick={onConfirm}>
          {busy ? 'Saving…' : `Confirm ${selectedCount || ''} relationship${selectedCount === 1 ? '' : 's'}`}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
