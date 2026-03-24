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

export interface CommissionValidationResult extends ComputeDealCommissionResult {
  valid: boolean;
  error?: string;
}

export interface CommissionContext {
  dealValue: number;
  roleAmounts?: Partial<Record<BaseParticipantSlot, number>>;
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

/** Shared pilot commission engine with strict validation. */
export function resolveCommissionWithValidation(
  input: ParticipantCommissionInput,
  ctx: CommissionContext
): CommissionValidationResult {
  const dealValue = ctx.dealValue;
  if (!Number.isFinite(dealValue) || dealValue <= 0) {
    return { total: 0, previewLine: 'Deal value is required.', valid: false, error: 'Deal value is required.' };
  }

  if (input.commissionKind === 'pct_deal_value') {
    const pct = input.commissionValue;
    if (!Number.isFinite(pct) || pct < 0) {
      return { total: 0, previewLine: 'Enter a valid percentage.', valid: false, error: 'Invalid percentage.' };
    }
    const total = Math.round(dealValue * (pct / 100));
    if (total > dealValue) {
      return {
        total,
        previewLine: `${pct}% of deal value → $${total.toLocaleString()}`,
        valid: false,
        error: 'Allocation cannot exceed deal value.',
      };
    }
    return { total, previewLine: `${pct}% of deal value → $${total.toLocaleString()}`, valid: true };
  }

  if (input.commissionKind === 'fixed_amount') {
    const fixed = input.commissionValue;
    if (!Number.isFinite(fixed) || fixed < 0) {
      return { total: 0, previewLine: 'Enter a valid fixed amount.', valid: false, error: 'Invalid fixed amount.' };
    }
    const total = Math.round(fixed);
    if (total > dealValue) {
      return {
        total,
        previewLine: `Fixed amount: $${total.toLocaleString()}`,
        valid: false,
        error: 'Fixed amount cannot exceed deal value.',
      };
    }
    return { total, previewLine: `Fixed amount: $${total.toLocaleString()}`, valid: true };
  }

  if (input.commissionKind === 'pct_of_participant') {
    const pct = input.commissionValue;
    const base = input.baseParticipant;
    if (!base) {
      return {
        total: 0,
        previewLine: 'Choose a base participant.',
        valid: false,
        error: 'Base participant is required.',
      };
    }
    if (!Number.isFinite(pct) || pct < 0) {
      return {
        total: 0,
        previewLine: 'Enter a valid percentage.',
        valid: false,
        error: 'Invalid percentage.',
      };
    }
    const baseAmount = ctx.roleAmounts?.[base];
    if (!Number.isFinite(baseAmount ?? NaN)) {
      return {
        total: 0,
        previewLine: 'Base participant allocation is not available.',
        valid: false,
        error: 'Base participant allocation is required first.',
      };
    }
    const total = Math.round((baseAmount as number) * (pct / 100));
    if (total > dealValue) {
      return {
        total,
        previewLine: `${pct}% of ${base} ($${Math.round(baseAmount as number).toLocaleString()}) → $${total.toLocaleString()}`,
        valid: false,
        error: 'Allocation cannot exceed deal value.',
      };
    }
    return {
      total,
      previewLine: `${pct}% of ${base} ($${Math.round(baseAmount as number).toLocaleString()}) → $${total.toLocaleString()}`,
      valid: true,
    };
  }

  const expr = input.formulaExpression?.trim() ?? '';
  if (!expr) {
    return {
      total: 0,
      previewLine: 'Enter a formula expression to save this structure.',
      valid: false,
      error: 'Formula expression is required.',
    };
  }
  const staticPreview = Math.round(dealValue * 0.1);
  return {
    total: staticPreview,
    previewLine: `Expression recorded (preview only): "${expr.slice(0, 48)}${expr.length > 48 ? '…' : ''}" → $${staticPreview.toLocaleString()}`,
    valid: true,
  };
}

/** Resolve a participant row’s commission to USD for tables / export. */
export function resolveParticipantCommissionUsd(
  p: ParticipantCommissionInput,
  dealValue: number,
  roleAmounts?: Partial<Record<BaseParticipantSlot, number>>
): ComputeDealCommissionResult {
  const result = resolveCommissionWithValidation(p, { dealValue, roleAmounts });
  return { total: result.valid ? result.total : 0, previewLine: result.previewLine };
}
