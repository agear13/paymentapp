'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ReferralImportCandidate, ReferralImportPreview } from '@/lib/workflows/referral-management/import-from-extraction';
import { candidateEarningSourceType } from '@/lib/workflows/referral-management/import-from-extraction';
import {
  ATTRIBUTION_METHOD_LABELS,
  KNOWN_EXTERNAL_PLATFORMS,
  type ReferralAttributionMethod,
  type ReferralEarningSourceType,
} from '@/lib/workflows/referral-management/earning-source';
import type { ReferralManagementContext } from '@/lib/workflows/referral-management/hub.server';

function earningSourceButtonClass(active: boolean): string {
  return active
    ? 'rounded-md border border-border bg-secondary px-3 py-1.5 text-[13px] font-semibold'
    : 'rounded-md border border-transparent px-3 py-1.5 text-[13px] text-ink-soft';
}

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

  const handleEarningSourceType = (candidate: ReferralImportCandidate, type: ReferralEarningSourceType) => {
    if (type === 'external') {
      updateCandidate(candidate.partyId, {
        earningSourceType: 'external',
        serviceId: null,
        serviceMatch: 'none',
      });
      return;
    }
    updateCandidate(candidate.partyId, {
      earningSourceType: 'internal_service',
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
          {preview.candidates.map((candidate) => {
            const earningSourceType = candidateEarningSourceType(candidate);
            const isExternal = earningSourceType === 'external';
            return (
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
                  aria-label="Promoter name"
                />
                <Input
                  type="email"
                  value={candidate.email}
                  onChange={(event) => updateCandidate(candidate.partyId, { email: event.target.value })}
                  placeholder="Email (optional — add later to send the agreement)"
                  aria-label="Email"
                />
                <Input
                  value={candidate.phone}
                  onChange={(event) => updateCandidate(candidate.partyId, { phone: event.target.value })}
                  placeholder="Phone (optional)"
                  aria-label="Phone"
                />
                <label className="block space-y-1">
                  <span className="text-[12px] text-ink-soft">Role</span>
                  <Input
                    value={candidate.extractedRole}
                    onChange={(event) =>
                      updateCandidate(candidate.partyId, { extractedRole: event.target.value })
                    }
                    placeholder="e.g. Community Organiser"
                    aria-label="Extracted role"
                  />
                </label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  value={candidate.role}
                  aria-label="Role"
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

                <div className="space-y-2">
                  <p className="text-[13px] font-semibold">What does this affiliate earn on?</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Earning source">
                    <button
                      type="button"
                      className={earningSourceButtonClass(!isExternal)}
                      aria-pressed={!isExternal}
                      onClick={() => handleEarningSourceType(candidate, 'internal_service')}
                    >
                      Provvy service
                    </button>
                    <button
                      type="button"
                      className={earningSourceButtonClass(isExternal)}
                      aria-pressed={isExternal}
                      onClick={() => handleEarningSourceType(candidate, 'external')}
                    >
                      External platform / service
                    </button>
                  </div>
                </div>

                {isExternal ? (
                  <div className="space-y-3 rounded-lg bg-secondary/20 p-3">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                      Earning source · External platform
                    </p>
                    <label className="block space-y-1">
                      <span className="text-[12px] text-ink-soft">Platform</span>
                      <Input
                        value={candidate.externalProvider ?? ''}
                        onChange={(event) =>
                          updateCandidate(candidate.partyId, { externalProvider: event.target.value })
                        }
                        placeholder="e.g. Weso"
                        list={`external-platforms-${candidate.partyId}`}
                        aria-label="External platform"
                      />
                      <datalist id={`external-platforms-${candidate.partyId}`}>
                        {KNOWN_EXTERNAL_PLATFORMS.map((platform) => (
                          <option key={platform.id} value={platform.displayName} />
                        ))}
                      </datalist>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[12px] text-ink-soft">Earning source / service</span>
                      <Input
                        value={candidate.externalService ?? ''}
                        onChange={(event) =>
                          updateCandidate(candidate.partyId, { externalService: event.target.value })
                        }
                        placeholder="e.g. Weso App Store"
                        aria-label="External earning source"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[12px] text-ink-soft">Attribution method</span>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                        value={candidate.attributionMethod ?? ''}
                        aria-label="Attribution method"
                        onChange={(event) =>
                          updateCandidate(candidate.partyId, {
                            attributionMethod: (event.target.value || null) as ReferralAttributionMethod | null,
                          })
                        }
                      >
                        <option value="">Not specified — complete if known</option>
                        {Object.entries(ATTRIBUTION_METHOD_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[12px] text-ink-soft">External integration</span>
                      <Input
                        value={candidate.integration ?? ''}
                        onChange={(event) =>
                          updateCandidate(candidate.partyId, { integration: event.target.value })
                        }
                        placeholder="e.g. Weso API / webhook"
                        aria-label="External integration"
                      />
                    </label>
                    <p className="text-[12px] text-ink-soft">
                      A Provvy catalogue service or checkout destination is not required. Missing external
                      details can be completed here — they will not be invented.
                    </p>
                  </div>
                ) : (
                  <>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      value={candidate.serviceId ?? ''}
                      aria-label="Catalogue service"
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
                  </>
                )}
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
                    aria-label="Commission percentage"
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
                    aria-label="Fixed commission amount"
                    onChange={(event) =>
                      updateCandidate(candidate.partyId, {
                        amount: event.target.value === '' ? null : Number(event.target.value),
                        commissionLabel: `${candidate.currency} ${event.target.value} fixed commission`,
                      })
                    }
                    placeholder="Fixed amount"
                  />
                )}
                <label className="block space-y-1">
                  <span className="text-[12px] text-ink-soft">Audience discount</span>
                  <Input
                    type="number"
                    min={0.01}
                    max={100}
                    step="0.01"
                    value={candidate.audienceDiscountPct ?? ''}
                    aria-label="Audience discount"
                    onChange={(event) =>
                      updateCandidate(candidate.partyId, {
                        audienceDiscountPct:
                          event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                    placeholder="e.g. 10"
                  />
                  <p className="text-[12px] text-ink-soft">
                    Only set when the conversation states an audience/customer discount. Leave blank if none
                    was agreed.
                  </p>
                </label>
              </li>
            );
          })}
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
