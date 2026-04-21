/**
 * Demo-only commission structure helpers (no formula engine).
 * Used by Create Deal + Invite Participant flows.
 */

import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

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
  /** Resolved payout totals for other pilot participant rows (used by %-of-participant when keyed by id). */
  participantBaseTotals?: Record<string, number>;
  participantLabels?: Record<string, string>;
  /** When resolving one row inside a joint solve, used to reject self-references. */
  resolvingParticipantId?: string;
}

const MAX_PILOT_MONEY = 1_000_000_000;

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
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
    const total = roundMoney(fixedAmount);
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
    const total = roundMoney(base * (pctOfParticipant / 100));
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
  /** When set, %-of-participant uses this invitee's resolved allocation instead of Introducer/Closer/Platform pools. */
  commissionBaseParticipantId?: string;
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
    const total = roundMoney(dealValue * (pct / 100));
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
    if (fixed > MAX_PILOT_MONEY) {
      return {
        total: 0,
        previewLine: 'Fixed amount too large.',
        valid: false,
        error: `Enter an amount up to $${MAX_PILOT_MONEY.toLocaleString()}.`,
      };
    }
    const total = roundMoney(fixed);
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
    if (!Number.isFinite(pct) || pct < 0) {
      return {
        total: 0,
        previewLine: 'Enter a valid percentage.',
        valid: false,
        error: 'Invalid percentage.',
      };
    }

    const baseId = input.commissionBaseParticipantId?.trim();
    if (baseId) {
      if (ctx.resolvingParticipantId && baseId === ctx.resolvingParticipantId) {
        return {
          total: 0,
          previewLine: 'Choose a different base participant.',
          valid: false,
          error: 'Percentage cannot be based on the same participant row.',
        };
      }
      const baseAmount = ctx.participantBaseTotals?.[baseId];
      if (!Number.isFinite(baseAmount ?? NaN)) {
        return {
          total: 0,
          previewLine: 'Base participant allocation is not available yet.',
          valid: false,
          error: 'Base participant allocation is required first.',
        };
      }
      const label = ctx.participantLabels?.[baseId] ?? baseId;
      const total = roundMoney((baseAmount as number) * (pct / 100));
      if (total > dealValue) {
        return {
          total,
          previewLine: `${pct}% of ${label} ($${roundMoney(baseAmount as number).toLocaleString()}) → $${total.toLocaleString()}`,
          valid: false,
          error: 'Allocation cannot exceed deal value.',
        };
      }
      return {
        total,
        previewLine: `${pct}% of ${label} ($${roundMoney(baseAmount as number).toLocaleString()}) → $${total.toLocaleString()}`,
        valid: true,
      };
    }

    const base = input.baseParticipant;
    if (!base) {
      return {
        total: 0,
        previewLine: 'Choose a base participant.',
        valid: false,
        error: 'Base participant is required.',
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
    const total = roundMoney((baseAmount as number) * (pct / 100));
    if (total > dealValue) {
      return {
        total,
        previewLine: `${pct}% of ${base} ($${roundMoney(baseAmount as number).toLocaleString()}) → $${total.toLocaleString()}`,
        valid: false,
        error: 'Allocation cannot exceed deal value.',
      };
    }
    return {
      total,
      previewLine: `${pct}% of ${base} ($${roundMoney(baseAmount as number).toLocaleString()}) → $${total.toLocaleString()}`,
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
  const staticPreview = roundMoney(dealValue * 0.1);
  return {
    total: staticPreview,
    previewLine: `Expression recorded (preview only): "${expr.slice(0, 48)}${expr.length > 48 ? '…' : ''}" → $${staticPreview.toLocaleString()}`,
    valid: true,
  };
}

export type ParticipantCommissionResolveOptions = {
  participantTotals?: Record<string, number>;
  participantLabels?: Record<string, string>;
  /** When resolving within a joint participant solve (same as CommissionContext.resolvingParticipantId). */
  resolvingParticipantId?: string;
};

/** Resolve a participant row’s commission to USD for tables / export. */
export function resolveParticipantCommissionUsd(
  p: ParticipantCommissionInput,
  dealValue: number,
  roleAmounts?: Partial<Record<BaseParticipantSlot, number>>,
  options?: ParticipantCommissionResolveOptions
): ComputeDealCommissionResult {
  const result = resolveCommissionWithValidation(p, {
    dealValue,
    roleAmounts,
    participantBaseTotals: options?.participantTotals,
    participantLabels: options?.participantLabels,
    resolvingParticipantId: options?.resolvingParticipantId,
  });
  return { total: result.valid ? result.total : 0, previewLine: result.previewLine };
}

/** Row shape used when jointly resolving %-of-participant chains across invitees. */
export type PilotParticipantCommissionRow = {
  id: string;
  name: string;
  companyName?: string;
  commissionKind: CommissionStructureKind;
  commissionValue: number;
  baseParticipant?: BaseParticipantSlot;
  commissionBaseParticipantId?: string;
  formulaExpression?: string;
};

export function pilotParticipantBaseLabel(p: Pick<PilotParticipantCommissionRow, 'name' | 'companyName'>): string {
  const c = p.companyName?.trim();
  return c ? `${p.name.trim()} (${c})` : p.name.trim();
}

/**
 * Iteratively resolves each participant row on a deal so %-of-participant can reference other invitees.
 * Legacy rows without `commissionBaseParticipantId` still use deal role pools via `roleAmounts`.
 */
export function computeParticipantCommissionTotalsForDeal(
  dealValue: number,
  roleAmounts: Partial<Record<BaseParticipantSlot, number>> | undefined,
  participants: PilotParticipantCommissionRow[]
): { totals: Record<string, number>; labels: Record<string, string> } {
  const labels: Record<string, string> = {};
  for (const p of participants) {
    labels[p.id] = pilotParticipantBaseLabel(p);
  }
  const totals: Record<string, number> = {};
  for (const p of participants) {
    totals[p.id] = 0;
  }
  for (let iter = 0; iter < 50; iter++) {
    let maxDelta = 0;
    for (const p of participants) {
      const prev = totals[p.id] ?? 0;
      const r = resolveCommissionWithValidation(
        {
          commissionKind: p.commissionKind,
          commissionValue: p.commissionValue,
          baseParticipant: p.baseParticipant,
          commissionBaseParticipantId: p.commissionBaseParticipantId,
          formulaExpression: p.formulaExpression,
        },
        {
          dealValue,
          roleAmounts,
          participantBaseTotals: totals,
          participantLabels: labels,
          resolvingParticipantId: p.id,
        }
      );
      const t = r.valid ? r.total : 0;
      totals[p.id] = t;
      maxDelta = Math.max(maxDelta, Math.abs(t - prev));
    }
    if (maxDelta < 1e-6) break;
  }
  return { totals, labels };
}

export function demoParticipantToPilotRow(p: DemoParticipant): PilotParticipantCommissionRow {
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

/**
 * Precomputes joint %-of-participant totals per deal id for tables, export, and top earners.
 */
export function computeJointTotalsByDealId(
  deals: RecentDeal[],
  participants: DemoParticipant[]
): Map<string, { totals: Record<string, number>; labels: Record<string, string> }> {
  const dealById = new Map(deals.map((d) => [d.id, d]));
  const grouped = new Map<string, DemoParticipant[]>();
  for (const p of participants) {
    if (!p.dealId) continue;
    const list = grouped.get(p.dealId) ?? [];
    list.push(p);
    grouped.set(p.dealId, list);
  }
  const out = new Map<string, { totals: Record<string, number>; labels: Record<string, string> }>();
  for (const [dealId, plist] of grouped) {
    const deal = dealById.get(dealId);
    if (!deal) continue;
    const joint = computeParticipantCommissionTotalsForDeal(
      deal.value,
      {
        Introducer: deal.introducerAmount,
        Closer: deal.closerAmount,
        Platform: deal.platformFee,
      },
      plist.map(demoParticipantToPilotRow)
    );
    out.set(dealId, { totals: joint.totals, labels: joint.labels });
  }
  return out;
}
