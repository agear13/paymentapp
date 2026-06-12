'use client';

import * as React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import {
  getPartyCompensationWarnings,
  isHybridCompensationParty,
  revenueComponentActive,
  fixedComponentActive,
} from '@/lib/ai-extractor/compensation-review-validation';
import type { ExtractedParty, ExtractorEntryPoint } from '@/lib/ai-extractor/extraction-types';
import type { ReviewedParty } from '@/lib/ai-extractor/review-form-types';
import type { DuplicateMatch } from '@/lib/ai-extractor/duplicate-detection';
import { derivePartyConfidence } from '@/lib/ai-extractor/extraction-summary';
import { ConfidenceBadge, ParticipantConfidenceBadge } from './confidence-badge';

const ROLE_OPTIONS = [
  'Partner',
  'Co-founder',
  'Stakeholder',
  'Contractor',
  'Referrer',
  'Contributor',
] as const;

const ONBOARDING_ROLE_OPTIONS = [
  'Partner',
  'Co-founder',
  'Stakeholder',
  'Contractor',
  'Supplier',
  'Promoter',
  'Affiliate',
  'Venue',
  'Staff',
  'Performer',
  'Referrer',
] as const;

interface ReviewPartyCardProps {
  party: ReviewedParty;
  originalParty: ExtractedParty | undefined;
  entryPoint: ExtractorEntryPoint;
  /** When set, fixed amounts were nulled because the extracted currency is unsupported.
   *  Used to show the original extracted value as a reference below the blank input. */
  extractedCurrency?: string;
  duplicateMatch?: DuplicateMatch;
  duplicateResolution?: 'update' | 'create';
  onDuplicateResolutionChange?: (resolution: 'update' | 'create') => void;
  onChange: (updated: ReviewedParty) => void;
  onRemove: () => void;
  /** Set when save validation failed for this party. */
  validationMessage?: string | null;
}

export function ReviewPartyCard({
  party,
  originalParty,
  entryPoint,
  extractedCurrency,
  duplicateMatch,
  duplicateResolution,
  onDuplicateResolutionChange,
  onChange,
  onRemove,
  validationMessage,
}: ReviewPartyCardProps) {
  const partyConfidence = originalParty ? derivePartyConfidence(originalParty) : 'absent';
  const roles = entryPoint === 'onboarding' ? ONBOARDING_ROLE_OPTIONS : ROLE_OPTIONS;
  const hybrid = isHybridCompensationParty(party, originalParty);
  const compensationWarnings = getPartyCompensationWarnings(party, originalParty);
  const showRevenueField =
    party.participationModel === 'revenue_share' ||
    party.participationModel === 'hybrid' ||
    (hybrid && revenueComponentActive(party, originalParty));
  const showFixedField =
    party.participationModel === 'fixed_payout' ||
    party.participationModel === 'hybrid' ||
    (hybrid && fixedComponentActive(party, originalParty));

  const financialMilestones = party.milestones.filter((m) => m.category === 'financial');
  const performanceMilestones = party.milestones.filter((m) => m.category === 'performance');
  const hasFinancialObligations =
    showFixedField ||
    showRevenueField ||
    financialMilestones.length > 0;
  const hasPerformanceObligations =
    party.deliverables.length > 0 ||
    performanceMilestones.length > 0;

  return (
    <div
      className={cn(
        'rounded-lg border bg-muted/20 p-4 space-y-3',
        (compensationWarnings.length > 0 || validationMessage) &&
          'border-amber-500/40 ring-1 ring-amber-500/20'
      )}
    >
      {/* Card header — name + participant confidence + remove */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium leading-none">{party.name || 'New participant'}</p>
          <ParticipantConfidenceBadge confidence={partyConfidence} />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
          onClick={onRemove}
          aria-label="Remove participant"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Duplicate match banner */}
      {duplicateMatch && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 space-y-2">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
            Potential match: <span className="font-semibold">{duplicateMatch.existingParticipant.name}</span>{' '}
            already exists in this project
            {duplicateMatch.matchReason === 'email' ? ' (same email)' : ' (same name)'}.
          </p>
          <div className="flex gap-4">
            {(['update', 'create'] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name={`dup-${party.id}`}
                  value={opt}
                  checked={duplicateResolution === opt}
                  onChange={() => onDuplicateResolutionChange?.(opt)}
                  className="accent-primary"
                />
                {opt === 'update' ? 'Update existing participant' : 'Create new participant'}
              </label>
            ))}
          </div>
        </div>
      )}

      {(hybrid || party.participationModel === 'hybrid') && compensationWarnings.length === 0 && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 space-y-1.5">
          <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
            Hybrid Compensation
          </p>
          <div className="text-xs text-blue-800/90 dark:text-blue-300/90 space-y-0.5">
            {showFixedField && party.fixedAmount != null ? (
              <p>Fixed Fee: ${party.fixedAmount.toLocaleString()}</p>
            ) : showFixedField ? (
              <p>Fixed Fee: enter amount</p>
            ) : null}
            {showRevenueField && party.revenueSharePct != null ? (
              <p>Revenue Share: {party.revenueSharePct}%</p>
            ) : showRevenueField ? (
              <p>Revenue Share: enter percentage</p>
            ) : null}
          </div>
        </div>
      )}

      {compensationWarnings.map((warning) => (
        <div
          key={warning.kind}
          className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 space-y-0.5"
        >
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {warning.title}
          </p>
          <p className="text-xs text-amber-800/90 dark:text-amber-300/90">{warning.message}</p>
        </div>
      ))}

      {validationMessage ? (
        <p className="text-xs text-destructive font-medium">{validationMessage}</p>
      ) : null}

      {/* Name */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Name</Label>
          {originalParty && <ConfidenceBadge confidence={originalParty.name.confidence} />}
        </div>
        <Input
          value={party.name}
          onChange={(e) => onChange({ ...party, name: e.target.value })}
          placeholder="Full name"
          className="h-8 text-sm"
        />
      </div>

      {/* Email */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Email</Label>
          {originalParty && <ConfidenceBadge confidence={originalParty.email.confidence} />}
        </div>
        <Input
          type="email"
          value={party.email}
          onChange={(e) => onChange({ ...party, email: e.target.value })}
          placeholder="email@example.com (optional)"
          className="h-8 text-sm"
        />
      </div>

      {/* Role */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Role</Label>
          {originalParty && <ConfidenceBadge confidence={originalParty.role.confidence} />}
        </div>
        <Select
          value={roles.find((r) => r === party.role) ?? roles[0]}
          onValueChange={(v) => onChange({ ...party, role: v })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r} value={r} className="text-sm">{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Participation model */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Participation</Label>
          {originalParty && <ConfidenceBadge confidence={originalParty.participationModel.confidence} />}
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'fixed_payout', label: 'Fixed payout' },
            { value: 'revenue_share', label: 'Revenue share' },
            { value: 'hybrid', label: 'Hybrid' },
            { value: 'customer_attribution', label: 'Attribution' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...party, participationModel: opt.value })}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                party.participationModel === opt.value
                  ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent/40'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Amount fields — conditional on model or hybrid structure */}
      {showFixedField && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label className="text-xs">
              Fixed amount (AUD or USD)
            </Label>
            {originalParty && !extractedCurrency && (
              <ConfidenceBadge confidence={originalParty.fixedAmount.confidence} />
            )}
          </div>
          <Input
            type="number"
            min={0}
            value={party.fixedAmount ?? ''}
            onChange={(e) =>
              onChange({ ...party, fixedAmount: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="Enter converted amount"
            className={cn(
              'h-8 text-sm',
              (extractedCurrency && party.fixedAmount === null) || compensationWarnings.some((w) => w.kind === 'fixed_payout_missing_amount' || w.kind === 'hybrid_incomplete')
                ? 'border-amber-400 focus-visible:ring-amber-400'
                : undefined
            )}
          />
          {extractedCurrency && originalParty && originalParty.fixedAmount.value != null && (
            <p className="text-xs text-muted-foreground">
              Original extracted:{' '}
              <span className="font-medium text-amber-700 dark:text-amber-400">
                {extractedCurrency} {originalParty.fixedAmount.value.toLocaleString()}
              </span>
            </p>
          )}
        </div>
      )}

      {showRevenueField && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Revenue share %</Label>
            {originalParty && <ConfidenceBadge confidence={originalParty.revenueSharePct.confidence} />}
          </div>
          <Input
            type="number"
            min={0}
            max={100}
            value={party.revenueSharePct ?? ''}
            onChange={(e) =>
              onChange({ ...party, revenueSharePct: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="Enter percentage"
            className={cn(
              'h-8 text-sm',
              compensationWarnings.some((w) => w.kind === 'revenue_share_missing_pct' || w.kind === 'hybrid_incomplete')
                ? 'border-amber-400 focus-visible:ring-amber-400'
                : undefined
            )}
          />
        </div>
      )}

      {party.participationModel === 'customer_attribution' && !hybrid && (
        <p className="text-xs text-muted-foreground">
          Customer attribution earnings — no fixed percentage or amount required.
        </p>
      )}

      {hasFinancialObligations ? (
        <div className="space-y-2 rounded-md border bg-background/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Financial Obligations
          </p>
          <ul className="space-y-1 text-xs text-foreground/85">
            {showFixedField && party.fixedAmount != null ? (
              <li>${party.fixedAmount.toLocaleString()} fixed fee</li>
            ) : null}
            {showRevenueField && party.revenueSharePct != null ? (
              <li>{party.revenueSharePct}% revenue share</li>
            ) : null}
            {financialMilestones.map((milestone, index) => (
              <li key={`fin-${index}`}>
                {milestone.description}
                {milestone.deadline ? ` — ${milestone.deadline}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasPerformanceObligations ? (
        <div className="space-y-2 rounded-md border bg-background/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Performance Obligations
          </p>
          {party.deliverables.length > 0 ? (
            <ul className="list-disc pl-4 space-y-1 text-xs text-foreground/85">
              {party.deliverables.map((item, index) => (
                <li key={`del-${index}`}>{item}</li>
              ))}
            </ul>
          ) : null}
          {performanceMilestones.length > 0 ? (
            <ul className="space-y-1 text-xs text-foreground/85">
              {performanceMilestones.map((milestone, index) => (
                <li key={`perf-${index}`}>
                  {milestone.description}
                  {milestone.deadline ? ` — ${milestone.deadline}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Notes */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Notes</Label>
          {originalParty && <ConfidenceBadge confidence={originalParty.notes.confidence} />}
        </div>
        <Textarea
          value={party.notes}
          onChange={(e) => onChange({ ...party, notes: e.target.value })}
          placeholder="Optional context"
          rows={2}
          className="text-sm resize-none"
        />
      </div>
    </div>
  );
}