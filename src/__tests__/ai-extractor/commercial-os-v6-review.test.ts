/**
 * Commercial OS V6 — Review Page regression tests.
 *
 * Covers:
 *   - Fixed payments separated from revenue share in participant cards.
 *   - Grouped blockers collapse same-type issues across participants.
 *   - Participant review states (ready / needs_review / missing_info) with explicit reasons.
 *   - Commercial risk summary generation (facts + warnings).
 *   - Payment event modelling (timeline-driven, short labels).
 *   - Revenue share summary structured fields (settlement, condition).
 *   - No mixed compensation labels (no "revenue share on fixed fee" text).
 */

import { buildCommercialGraph } from '@/lib/ai-extractor/commercial-graph';
import { normalizeExtractionResult } from '@/lib/ai-extractor/normalize-extraction-result';
import { validateExtractionResult } from '@/lib/ai-extractor/extraction-service';
import {
  sunsetSessionsIdealExtractionPayload,
} from '@/fixtures/sunset-sessions-conversation';

function buildGraph() {
  const normalized = normalizeExtractionResult(
    validateExtractionResult(sunsetSessionsIdealExtractionPayload())
  );
  return buildCommercialGraph(normalized);
}

// ─── Part 3: Fixed payments separate from revenue share ───────────────────────

describe('Compensation separation — fixed payments vs revenue share', () => {
  it('each participant card has fixedPayments and revenueShareTerms as separate arrays', () => {
    const graph = buildGraph();
    for (const card of graph.participantCards) {
      expect(Array.isArray(card.fixedPayments)).toBe(true);
      expect(Array.isArray(card.revenueShareTerms)).toBe(true);
      expect(Array.isArray(card.conditionalBonuses)).toBe(true);
    }
  });

  it('Sarah has fixed payment in fixedPayments and revenue share in revenueShareTerms', () => {
    const card = buildGraph().participantCards.find((c) => c.name === 'Sarah')!;
    expect(card.fixedPayments.some((f) => /300/i.test(f))).toBe(true);
    expect(card.revenueShareTerms.some((r) => /10%/i.test(r))).toBe(true);
    // Fixed fee must NOT appear in revenueShareTerms
    expect(card.revenueShareTerms.every((r) => !/fixed/i.test(r))).toBe(true);
  });

  it('Ben has fixed payment separate from 15% bar revenue', () => {
    const card = buildGraph().participantCards.find((c) => c.name === 'Ben')!;
    expect(card.fixedPayments.some((f) => /1[,.]?200|1200/i.test(f))).toBe(true);
    expect(card.revenueShareTerms.some((r) => /15%/i.test(r))).toBe(true);
    // Revenue share must not contain dollar amounts from the fixed fee
    for (const term of card.revenueShareTerms) {
      expect(term).not.toMatch(/1[,.]?200/);
    }
  });

  it('revenue share labels do not contain "fixed" or dollar amounts from fixed fees', () => {
    const graph = buildGraph();
    for (const card of graph.participantCards) {
      for (const term of card.revenueShareTerms) {
        // Revenue share terms should not embed fixed fee dollar amounts
        expect(term.toLowerCase()).not.toMatch(/\bfixed\b.*\$/);
        expect(term.toLowerCase()).not.toMatch(/fixed fee/);
      }
    }
  });

  it('Mia has instalments in fixedPayments (not revenue share)', () => {
    const card = buildGraph().participantCards.find((c) => c.name === 'Mia')!;
    const instalmentsInFixed = card.fixedPayments.some((f) => /instalment|500/i.test(f));
    const instalmentsInRevShare = card.revenueShareTerms.some((r) => /500/i.test(r));
    expect(instalmentsInFixed).toBe(true);
    expect(instalmentsInRevShare).toBe(false);
  });

  it('Alex conditional bonus is in conditionalBonuses, not in fixedPayments', () => {
    const card = buildGraph().participantCards.find((c) => c.name === 'Alex')!;
    expect(card.conditionalBonuses.some((b) => /150/i.test(b))).toBe(true);
    expect(card.fixedPayments.every((f) => !/bonus/i.test(f))).toBe(true);
  });
});

// ─── Part 7: Grouped blockers ─────────────────────────────────────────────────

describe('Grouped blockers', () => {
  it('produces grouped blockers array', () => {
    const graph = buildGraph();
    expect(Array.isArray(graph.groupedBlockers)).toBe(true);
    expect(graph.groupedBlockers.length).toBeGreaterThan(0);
  });

  it('each blocker has type, title, description, participants[]', () => {
    const graph = buildGraph();
    for (const b of graph.groupedBlockers) {
      expect(typeof b.type).toBe('string');
      expect(typeof b.title).toBe('string');
      expect(typeof b.description).toBe('string');
      expect(Array.isArray(b.participants)).toBe(true);
    }
  });

  it('missing_email blocker groups all participants without emails', () => {
    const graph = buildGraph();
    const emailBlocker = graph.groupedBlockers.find((b) => b.type === 'missing_email');
    expect(emailBlocker).toBeDefined();
    // All 5 sunset sessions participants lack emails
    expect(emailBlocker!.participants.length).toBe(5);
  });

  it('missing_payment_destination blocker is consolidated (not repeated per participant)', () => {
    const graph = buildGraph();
    const paymentBlockers = graph.groupedBlockers.filter((b) => b.type === 'missing_payment_destination');
    // Should appear ONCE, not once per participant
    expect(paymentBlockers.length).toBe(1);
    expect(paymentBlockers[0]!.participants.length).toBe(5);
  });

  it('same blocker type does not appear twice in grouped list', () => {
    const graph = buildGraph();
    const codes = graph.groupedBlockers.map((b) => b.type);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it('blocker descriptions mention count of participants', () => {
    const graph = buildGraph();
    for (const b of graph.groupedBlockers) {
      if (b.participants.length > 1) {
        expect(b.description).toMatch(/\d+/);
      }
    }
  });
});

// ─── Parts 2 + 9: Review reasons + status ────────────────────────────────────

describe('Participant review states and reasons', () => {
  it('all participant cards have explicit reviewReasons when not ready', () => {
    const graph = buildGraph();
    for (const card of graph.participantCards) {
      if (card.reviewStatus !== 'ready') {
        expect(card.reviewReasons.length).toBeGreaterThan(0);
      }
    }
  });

  it('reviewReasons have code and label', () => {
    const graph = buildGraph();
    for (const card of graph.participantCards) {
      for (const reason of card.reviewReasons) {
        expect(typeof reason.code).toBe('string');
        expect(typeof reason.label).toBe('string');
        expect(reason.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('missing_info status triggers when required fields absent', () => {
    const graph = buildGraph();
    // Participants without emails should be missing_info (or needs_review at minimum)
    for (const card of graph.participantCards) {
      const hasMissingEmail = card.reviewReasons.some((r) => r.code === 'missing_email');
      if (hasMissingEmail) {
        expect(['missing_info', 'needs_review']).toContain(card.reviewStatus);
      }
    }
  });

  it('conditional payment creates conditional_payment_unconfirmed reason for Alex', () => {
    const card = buildGraph().participantCards.find((c) => c.name === 'Alex')!;
    expect(card.reviewReasons.some((r) => r.code === 'conditional_payment_unconfirmed')).toBe(true);
  });

  it('no participant has empty reviewReasons when status is not ready', () => {
    const graph = buildGraph();
    for (const card of graph.participantCards) {
      if (card.reviewStatus !== 'ready') {
        expect(card.reviewReasons.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Part 8: Commercial risk summary ─────────────────────────────────────────

describe('Commercial risk summary', () => {
  it('generates risk summary with facts and warnings', () => {
    const graph = buildGraph();
    expect(graph.commercialRiskSummary.length).toBeGreaterThan(0);
  });

  it('contains facts for participant count and fixed commitment', () => {
    const graph = buildGraph();
    const factTexts = graph.commercialRiskSummary
      .filter((i) => i.type === 'fact')
      .map((i) => i.text);

    expect(factTexts.some((t) => /5.*participant/i.test(t))).toBe(true);
    // estimatedFixedCommitment for Sunset Sessions is 3600
    expect(factTexts.some((t) => /3[,.]?600/i.test(t))).toBe(true);
  });

  it('contains fact for revenue share agreement count', () => {
    const graph = buildGraph();
    const factTexts = graph.commercialRiskSummary
      .filter((i) => i.type === 'fact')
      .map((i) => i.text);
    expect(factTexts.some((t) => /revenue share/i.test(t))).toBe(true);
  });

  it('contains warnings for revenue sources requiring verification', () => {
    const graph = buildGraph();
    const warnings = graph.commercialRiskSummary.filter((i) => i.type === 'warning');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('warning about promo code attribution exists for Sarah', () => {
    const graph = buildGraph();
    const warnings = graph.commercialRiskSummary
      .filter((i) => i.type === 'warning')
      .map((i) => i.text.toLowerCase());
    expect(warnings.some((w) => /promo|code|sarah/i.test(w))).toBe(true);
  });

  it('warning about sponsorship revenue for Mia', () => {
    const graph = buildGraph();
    const warnings = graph.commercialRiskSummary
      .filter((i) => i.type === 'warning')
      .map((i) => i.text.toLowerCase());
    expect(warnings.some((w) => /sponsor|mia/i.test(w))).toBe(true);
  });

  it('no duplicate warning items', () => {
    const graph = buildGraph();
    const warningTexts = graph.commercialRiskSummary
      .filter((i) => i.type === 'warning')
      .map((i) => i.text);
    const unique = new Set(warningTexts);
    expect(unique.size).toBe(warningTexts.length);
  });
});

// ─── Part 5: Payment event labels (timeline-driven, short) ───────────────────

describe('Payment event labels are short and timeline-driven', () => {
  it('payment event pays[] labels do not contain timing prose', () => {
    const graph = buildGraph();
    for (const card of graph.participantCards) {
      for (const event of card.paymentEvents) {
        for (const pay of event.pays) {
          // Labels should not embed "within X days" in the pays[] text
          // (timing belongs in event.due, not the pay label)
          expect(pay.toLowerCase()).not.toMatch(/within \d+ days/);
          expect(pay.toLowerCase()).not.toMatch(/before event.*—/);
          expect(pay.toLowerCase()).not.toMatch(/after event.*—/);
        }
      }
    }
  });

  it('payment event due field carries the timing', () => {
    const graph = buildGraph();
    const sarahCard = graph.participantCards.find((c) => c.name === 'Sarah');
    const alexCard = graph.participantCards.find((c) => c.name === 'Alex');

    // At least one event for Sarah or Alex should have a due date
    const sarahEvents = sarahCard?.paymentEvents ?? [];
    const alexEvents = alexCard?.paymentEvents ?? [];
    const allEvents = [...sarahEvents, ...alexEvents];

    const eventsWithTiming = allEvents.filter((ev) => ev.due !== null);
    expect(eventsWithTiming.length).toBeGreaterThan(0);
  });

  it('Alex conditional bonus is attached to parent event, not standalone', () => {
    const card = buildGraph().participantCards.find((c) => c.name === 'Alex')!;

    // Conditional bonus should not be a standalone event where ALL pays are bonus
    const standalone = card.paymentEvents.filter(
      (ev) => ev.pays.every((p) => /bonus/i.test(p)) && ev.pays.length === 1
    );
    expect(standalone).toHaveLength(0);
  });
});

// ─── Revenue share summary with settlement + condition ────────────────────────

describe('Revenue share summary structured fields', () => {
  it('revenue share rows have percentage and revenueBasis', () => {
    const graph = buildGraph();
    for (const row of graph.revenueShareSummary) {
      expect(typeof row.percentage).toBe('number');
      expect(row.percentage).toBeGreaterThan(0);
      expect(typeof row.revenueBasis).toBe('string');
      expect(row.revenueBasis.length).toBeGreaterThan(0);
    }
  });

  it('revenue basis does not contain stray fixed fee amounts', () => {
    const graph = buildGraph();
    for (const row of graph.revenueShareSummary) {
      expect(row.revenueBasis.toLowerCase()).not.toMatch(/\bfixed\b.*\$/);
      expect(row.revenueBasis.toLowerCase()).not.toMatch(/fixed fee/);
    }
  });

  it('Mia revenue share row has sponsorship basis', () => {
    const mia = buildGraph().revenueShareSummary.find((r) => r.participantName === 'Mia');
    expect(mia).toBeDefined();
    expect(mia!.revenueBasis.toLowerCase()).toMatch(/sponsor/);
  });
});

// ─── Backward compatibility ───────────────────────────────────────────────────

describe('Backward compatibility', () => {
  it('compensationTerms string[] is still present', () => {
    const graph = buildGraph();
    for (const card of graph.participantCards) {
      expect(Array.isArray(card.compensationTerms)).toBe(true);
    }
  });

  it('settlementSchedule legacy field is still present', () => {
    const graph = buildGraph();
    for (const card of graph.participantCards) {
      expect(Array.isArray(card.settlementSchedule)).toBe(true);
    }
  });

  it('existing sunset sessions tests still pass — 5 participants', () => {
    const graph = buildGraph();
    expect(graph.participantCards).toHaveLength(5);
  });

  it('estimated fixed commitment still correct', () => {
    const graph = buildGraph();
    expect(graph.commercialStructure.estimatedFixedCommitment).toBe(3600);
  });
});
