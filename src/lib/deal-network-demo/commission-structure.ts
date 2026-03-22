/**
 * Demo-only commission structure helpers (no formula engine).
 * Used by Create Deal + Invite Participant flows.
 */

export type CommissionStructureKind =
  | 'pct_deal_value'
  | 'fixed_amount'
  | 'pct_of_participant'
  | 'formula_advanced';

export const COMMISSION_STRUCTURE_OPTIONS: { value: CommissionStructureKind; label: string }[] = [
  { value: 'pct_deal_value', label: 'Percentage of Deal Value' },
  { value: 'fixed_amount', label: 'Fixed Amount' },
  { value: 'pct_of_participant', label: 'Percentage of Another Participant' },
  { value: 'formula_advanced', label: 'Formula (Advanced)' },
];

/** Reference slots used for “% of another participant” (demo split of the 20% pool). */
export type BaseParticipantSlot = 'Introducer' | 'Closer' | 'Platform';

export const BASE_PARTICIPANT_OPTIONS: { value: BaseParticipantSlot; label: string }[] = [
  { value: 'Introducer', label: 'Introducer' },
  { value: 'Closer', label: 'Closer' },
  { value: 'Platform', label: 'Platform' },
];

/** 20% pool, then 50/50 intro/closer; platform gets 10% of pool for demo third line. */
export function computeReferencePool(dealValue: number) {
  const pool = dealValue * 0.2;
  return {
    pool,
    introducerBase: pool * 0.5,
    closerBase: pool * 0.5,
    platformBase: pool * 0.1,
  };
}

export interface ComputeDealCommissionResult {
  total: number;
  previewLine: string;
}

export function computeDealCommissionTotal(
  kind: CommissionStructureKind,
  dealValue: number,
  pctOfDeal: number,
  fixedAmount: number,
  baseParticipant: BaseParticipantSlot,
  pctOfParticipant: number,
  _formulaText: string
): ComputeDealCommissionResult {
  const ref = computeReferencePool(dealValue);

  if (kind === 'pct_deal_value') {
    const total = Math.round(dealValue * (pctOfDeal / 100));
    return {
      total,
      previewLine: `${pctOfDeal}% of deal value → $${total.toLocaleString()}`,
    };
  }

  if (kind === 'fixed_amount') {
    const total = Math.round(fixedAmount);
    return {
      total,
      previewLine: `Fixed commission pool: $${total.toLocaleString()}`,
    };
  }

  if (kind === 'pct_of_participant') {
    const base =
      baseParticipant === 'Introducer'
        ? ref.introducerBase
        : baseParticipant === 'Closer'
          ? ref.closerBase
          : ref.platformBase;
    const total = Math.round(base * (pctOfParticipant / 100));
    const roleLabel =
      baseParticipant === 'Introducer'
        ? 'Introducer'
        : baseParticipant === 'Closer'
          ? 'Closer'
          : 'Platform';
    return {
      total,
      previewLine: `${roleLabel} earns $${Math.round(base).toLocaleString()} → ${pctOfParticipant}% = $${total.toLocaleString()}`,
    };
  }

  // Formula (Advanced): static preview only — no parsing
  const total = Math.round(dealValue * 0.2 * 0.5);
  const note = _formulaText.trim()
    ? `Expression recorded: “${_formulaText.trim().slice(0, 48)}${_formulaText.trim().length > 48 ? '…' : ''}”`
    : 'No expression entered — showing sample math';
  return {
    total,
    previewLine: `${note}. Static result: $${total.toLocaleString()} (not evaluated)`,
  };
}

export interface ParticipantCommissionInput {
  commissionKind: CommissionStructureKind;
  commissionValue: number;
  baseParticipant?: BaseParticipantSlot;
  formulaExpression?: string;
}

/** Resolve a participant row’s commission to USD for tables / export. */
export function resolveParticipantCommissionUsd(
  p: ParticipantCommissionInput,
  dealValue: number
): ComputeDealCommissionResult {
  const pctOfDeal = p.commissionKind === 'pct_deal_value' ? p.commissionValue : 20;
  const fixedAmt = p.commissionKind === 'fixed_amount' ? p.commissionValue : 0;
  const base = p.baseParticipant ?? 'Closer';
  const pctOfPart = p.commissionKind === 'pct_of_participant' ? p.commissionValue : 5;
  return computeDealCommissionTotal(
    p.commissionKind,
    dealValue,
    pctOfDeal,
    fixedAmt,
    base,
    pctOfPart,
    p.formulaExpression ?? ''
  );
}
