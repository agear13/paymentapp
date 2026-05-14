/**
 * Deterministic revenue-share / commission math scenarios for launch verification.
 * Pure functions only — no DB. Safe to run from CLI or internal API.
 */

import {
  computeSplitAmounts,
  type ReferralSplitMeta,
} from '@/lib/referrals/commission-posting';

export interface MatrixScenarioResult {
  id: string;
  title: string;
  invoiceBasis: number;
  currency: string;
  splits: ReferralSplitMeta[];
  payoutRows: { label: string; percentage: number; amount: number }[];
  payoutTotal: number;
  notes: string[];
}

function runScenario(
  id: string,
  title: string,
  invoiceBasis: number,
  currency: string,
  splits: ReferralSplitMeta[],
  notes: string[] = []
): MatrixScenarioResult {
  const payoutRows = computeSplitAmounts(invoiceBasis, splits, currency).map((r) => ({
    label: r.label,
    percentage: r.percentage,
    amount: r.amount,
  }));
  const payoutTotal = payoutRows.reduce((a, r) => a + r.amount, 0);
  return {
    id,
    title,
    invoiceBasis,
    currency,
    splits,
    payoutRows,
    payoutTotal,
    notes,
  };
}

function contractScenario(
  id: string,
  title: string,
  notes: string[]
): MatrixScenarioResult {
  return {
    id,
    title,
    invoiceBasis: 0,
    currency: '—',
    splits: [],
    payoutRows: [],
    payoutTotal: 0,
    notes,
  };
}

/** Deterministic scenarios A–J (labels align with launch verification checklist). */
export function buildRevenueShareMatrixResults(): MatrixScenarioResult[] {
  const mk = (
    id: string,
    title: string,
    basis: number,
    currency: string,
    splits: ReferralSplitMeta[],
    notes?: string[]
  ) => runScenario(id, title, basis, currency, splits, notes);

  return [
    mk(
      'A',
      'Single recipient %',
      100,
      'USD',
      [{ split_id: 's1', label: 'Partner', percentage: 10, beneficiary_id: 'u1', sort_order: 0 }],
      ['Partial allocation (10% of 100): payout 10.00; remaining 90.00 is not assigned to partners.']
    ),
    mk(
      'B',
      'Multi recipient %',
      1_000,
      'USD',
      [
        { split_id: 'a', label: 'A', percentage: 60, beneficiary_id: 'u1', sort_order: 0 },
        { split_id: 'b', label: 'B', percentage: 40, beneficiary_id: 'u2', sort_order: 1 },
      ],
      ['60/40; declared 100% → payout_total should equal basis after cent rounding.']
    ),
    mk(
      'C',
      'Decimal percentages (floor per line, full-basis remainder)',
      100,
      'USD',
      [
        { split_id: '1', label: 'P1', percentage: 33.33, beneficiary_id: null, sort_order: 1 },
        { split_id: '2', label: 'P2', percentage: 33.33, beneficiary_id: null, sort_order: 2 },
        { split_id: '3', label: 'P3', percentage: 33.34, beneficiary_id: null, sort_order: 3 },
      ],
      ['Declared total 100%; tiny remainder goes to first split.']
    ),
    mk(
      'D',
      'FX-adjusted payouts (split layer)',
      250.5,
      'USD',
      [{ split_id: 'x', label: 'Partner', percentage: 5, beneficiary_id: 'u1', sort_order: 0 }],
      [
        'Split math runs on commission basis amount supplied by caller (confirmPayment uses invoice/settlement currency).',
        'FX into basis happens before applyRevenueShareSplits — not recomputed here.',
      ]
    ),
    mk(
      'E',
      'Stripe settlement basis (GROSS proxy)',
      99.99,
      'USD',
      [{ split_id: 's', label: 'Rev', percentage: 10, beneficiary_id: 'u1', sort_order: 0 }],
      ['Same as partial %: 9.999 floored to 9.99; no dump of remaining 90.00 to partner.']
    ),
    mk(
      'F',
      'Hedera settlement basis (same math)',
      200,
      'USD',
      [{ split_id: 'h', label: 'Partner', percentage: 15, beneficiary_id: 'u2', sort_order: 0 }],
      ['Rail-specific fee/basis is upstream; split layer unchanged.']
    ),
    mk(
      'G',
      'Wise settlement basis (same math)',
      80,
      'EUR',
      [
        { split_id: 'w1', label: 'A', percentage: 25, beneficiary_id: 'a', sort_order: 0 },
        { split_id: 'w2', label: 'B', percentage: 25, beneficiary_id: 'b', sort_order: 1 },
        { split_id: 'w3', label: 'C', percentage: 50, beneficiary_id: 'c', sort_order: 2 },
      ],
      ['EUR minor units = 2; total should match 80.00 after remainder rule.']
    ),
    mk(
      'H',
      'Recurring invoice settlement (basis shape)',
      120,
      'AUD',
      [{ split_id: 'r', label: 'Consultant', percentage: 8, beneficiary_id: 'c1', sort_order: 0 }],
      [
        'Recurring-generated links still carry referral_splits metadata shape.',
        'Duplicate execution prevention is in recurring job + PAYMENT_CONFIRMED idempotency.',
      ]
    ),
    contractScenario('I', 'Replay / retry (contract)', [
      'Settlement replay: confirmPayment + PAYMENT_CONFIRMED uniqueness — see settlement-integrity-guards tests.',
      'Queue retry: Xero job lease + row status — see distributed-lease-recovery tests.',
    ]),
    contractScenario('J', 'Refund / reversal (contract)', [
      'Refund writes REFUND_CONFIRMED + reversal postings; not mixed with revenue-share split math.',
      'See Stripe refund webhook route + posting-rules/stripe refund path.',
    ]),
  ];
}

export function formatRevenueShareMatrixLines(): string[] {
  const lines: string[] = [];
  lines.push('=== Revenue share / commission deterministic matrix ===');
  lines.push(`generated_at_utc=${new Date().toISOString()}`);
  for (const r of buildRevenueShareMatrixResults()) {
    lines.push('');
    lines.push(`[${r.id}] ${r.title}`);
    lines.push(`  invoice_basis=${r.invoiceBasis} ${r.currency}`);
    if (r.splits.length === 0) {
      r.notes.forEach((n) => lines.push(`  note: ${n}`));
      continue;
    }
    lines.push(`  declared_splits=${r.splits.map((s) => `${s.percentage}%`).join(' + ')}`);
    for (const p of r.payoutRows) {
      lines.push(`  payout | ${p.label} | pct=${p.percentage}% | amount=${p.amount}`);
    }
    lines.push(`  payout_total=${r.payoutTotal.toFixed(2)} (vs basis ${r.invoiceBasis.toFixed(2)})`);
    const declared = r.splits.reduce((a, s) => a + s.percentage, 0);
    const full = declared >= 99.99 && declared <= 100.01;
    lines.push(`  full_basis_allocation=${full ? 'yes (remainder absorption allowed)' : 'no (partial share; unallocated stays platform)'}`);
    r.notes.forEach((n) => lines.push(`  note: ${n}`));
  }
  return lines;
}
