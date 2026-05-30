'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
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
}: ReviewPartyCardProps) {
  const partyConfidence = originalParty ? derivePartyConfidence(originalParty) : 'absent';
  const roles = entryPoint === 'onboarding' ? ONBOARDING_ROLE_OPTIONS : ROLE_OPTIONS;

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
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

      {/* Amount field — conditional on model */}
      {party.participationModel === 'fixed_payout' && (
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
            className={cn('h-8 text-sm', extractedCurrency && party.fixedAmount === null && 'border-amber-400 focus-visible:ring-amber-400')}
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

      {party.participationModel === 'revenue_share' && (
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
            placeholder="0"
            className="h-8 text-sm"
          />
        </div>
      )}

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