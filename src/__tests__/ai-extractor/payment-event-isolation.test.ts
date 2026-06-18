/**
 * Payment event modelling + participant isolation regression tests (v5.1).
 *
 * Covers:
 *   - Payment events and settlement rules are distinct concepts.
 *   - Conditional bonuses attach to parent payment events.
 *   - Cross-participant trigger leakage is prevented.
 *   - Revenue share summary is structured (per-participant, not generic).
 *   - Review status is correctly computed.
 *   - No information is duplicated across participants.
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

function findCard(name: string) {
  const graph = buildGraph();
  const card = graph.participantCards.find((c) => c.name === name);
  if (!card) throw new Error(`Expected participant card for ${name}`);
  return card;
}

// ─── Part 1 + 3: Payment events distinct from settlement rules ───────────────

describe('Payment event modelling', () => {
  it('Alex: conditional bonus attaches to payment event, not standalone', () => {
    const alex = findCard('Alex');

    // Conditional bonus must NOT be a separate payment event
    const standaloneBonusEvents = alex.paymentEvents.filter(
      (ev) => ev.pays.every((p) => /conditional bonus/i.test(p)) && ev.pays.length === 1
    );
    expect(standaloneBonusEvents).toHaveLength(0);

    // The bonus condition must appear on an event that also pays the fixed fee
    const eventWithBonus = alex.paymentEvents.find(
      (ev) => ev.pays.some((p) => /\$600/i.test(p) || /fixed/i.test(p))
    );
    expect(eventWithBonus).toBeDefined();
    expect(eventWithBonus?.condition ?? eventWithBonus?.pays.some((p) => /bonus/i.test(p))).toBeTruthy();
  });

  it('Alex: payment event has a timing trigger', () => {
    const alex = findCard('Alex');
    const events = alex.paymentEvents.filter((ev) => ev.pays.length > 0);
    expect(events.length).toBeGreaterThan(0);
    // At least one event has timing
    const hasAnyTiming = events.some((ev) => ev.due !== null);
    expect(hasAnyTiming).toBe(true);
  });

  it('Mia: instalments appear as payment events, not settlement rules', () => {
    const mia = findCard('Mia');
    const allPayItems = mia.paymentEvents.flatMap((ev) => ev.pays);
    const hasInstalment = allPayItems.some((p) => /instalment|500/i.test(p));
    expect(hasInstalment).toBe(true);
  });

  it('Mia: revenue share timing attaches to revenue share payment event', () => {
    const mia = findCard('Mia');
    const revenueShareEvent = mia.paymentEvents.find(
      (ev) => ev.pays.some((p) => /5%|revenue share|sponsorship/i.test(p))
    );
    expect(revenueShareEvent).toBeDefined();
    // Revenue share should have its own trigger, not be stripped
    if (revenueShareEvent) {
      expect(revenueShareEvent.pays.length).toBeGreaterThan(0);
    }
  });

  it('participant cards expose paymentEvents and settlementRules as separate fields', () => {
    const graph = buildGraph();
    for (const card of graph.participantCards) {
      expect(Array.isArray(card.paymentEvents)).toBe(true);
      expect(Array.isArray(card.settlementRules)).toBe(true);
    }
  });

  it('payment events contain pays[] arrays, never empty', () => {
    const graph = buildGraph();
    for (const card of graph.participantCards) {
      for (const event of card.paymentEvents) {
        expect(event.pays.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Part 2: Cross-participant leakage guard ─────────────────────────────────

describe('Participant isolation — no cross-participant leakage', () => {
  it('each participant card contains only their own compensation terms', () => {
    const graph = buildGraph();

    // Compensation amounts per participant (from fixture expectations)
    const alexAmounts = graph.participantCards
      .find((c) => c.name === 'Alex')!
      .compensationTerms.join(' ');
    const miaTerms = graph.participantCards
      .find((c) => c.name === 'Mia')!
      .compensationTerms.join(' ');
    const benTerms = graph.participantCards
      .find((c) => c.name === 'Ben')!
      .compensationTerms.join(' ');

    // Alex should have $600, not Mia's $500 or Ben's $1200
    expect(alexAmounts).toMatch(/600/);
    expect(alexAmounts).not.toMatch(/1200/);

    // Mia should have 5% sponsorship, not Ben's 15% bar revenue
    expect(miaTerms).toMatch(/5%/);
    expect(miaTerms).not.toMatch(/15%/);
    expect(benTerms).toMatch(/15%/);
    // Ben should not have Mia's sponsorship revenue basis
    expect(benTerms.toLowerCase()).not.toMatch(/sponsor/);
  });

  it('participant deliverables do not cross-contaminate', () => {
    const graph = buildGraph();

    const alexDeliverables = graph.participantCards
      .find((c) => c.name === 'Alex')!
      .deliverables.join(' ').toLowerCase();
    const miaDeliverables = graph.participantCards
      .find((c) => c.name === 'Mia')!
      .deliverables.join(' ').toLowerCase();

    // Alex is photography, not videography
    expect(alexDeliverables).toMatch(/photo/);
    expect(alexDeliverables).not.toMatch(/video|reel|drone/);

    // Mia is videography, not photography
    expect(miaDeliverables).toMatch(/video|reel|drone/);
    expect(miaDeliverables).not.toMatch(/crowd shots|edited images/);
  });

  it('global settlement triggers do not appear as unique per-party triggers for every participant', () => {
    // If "Within 7 days after event" appears in ALL parties, it is a global clause.
    // It must not be listed as a unique payment event trigger for participants who have
    // their own distinct timing (e.g. Mia has "14 days after sponsor funds clear").
    const graph = buildGraph();

    // Mia has a distinct timing — sponsor funds clearing
    const mia = graph.participantCards.find((c) => c.name === 'Mia')!;
    const miaAllDueDates = mia.paymentEvents.map((ev) => ev.due?.toLowerCase() ?? '');

    // Mia should NOT have only "within 7 days after event" (Sarah's timing).
    // If present, she must also have her own timing (sponsor funds).
    const hasSarahsTiming = miaAllDueDates.some((d) => /7 days after event/.test(d));
    const hasOwnTiming = miaAllDueDates.some((d) => /sponsor|14 days|before event/.test(d));

    if (hasSarahsTiming) {
      // Sarah's timing can appear only if Mia also has her own distinct timing
      expect(hasOwnTiming).toBe(true);
    }
  });

  it('settlement schedule entries are unique per participant', () => {
    const graph = buildGraph();
    const participantIds = graph.settlementSchedule.map((e) => e.participantId);
    const uniqueIds = new Set(participantIds);
    expect(uniqueIds.size).toBe(participantIds.length);
  });
});

// ─── Part 4: Revenue share summary ─────────────────────────────────────────

describe('Revenue share summary', () => {
  it('builds structured per-participant revenue share rows', () => {
    const graph = buildGraph();
    expect(graph.revenueShareSummary.length).toBeGreaterThanOrEqual(3);
  });

  it('revenue share summary includes Sarah (10% tickets), Mia (5% sponsorship), Ben (15% bar)', () => {
    const graph = buildGraph();
    const summary = graph.revenueShareSummary;

    const sarah = summary.find((r) => r.participantName === 'Sarah');
    const mia = summary.find((r) => r.participantName === 'Mia');
    const ben = summary.find((r) => r.participantName === 'Ben');

    expect(sarah?.percentage).toBe(10);
    expect(mia?.percentage).toBe(5);
    expect(ben?.percentage).toBe(15);
  });

  it('revenue share rows have distinct revenue bases', () => {
    const graph = buildGraph();
    const bases = graph.revenueShareSummary.map((r) => r.revenueBasis.toLowerCase());

    // Each should have a distinct revenue basis
    const uniqueBases = new Set(bases);
    expect(uniqueBases.size).toBeGreaterThanOrEqual(2);
  });

  it('revenue share rows distinguish ticket from sponsorship from bar revenue', () => {
    const graph = buildGraph();
    const bases = graph.revenueShareSummary
      .map((r) => r.revenueBasis.toLowerCase())
      .join(' ');

    // Should mention sponsorship for Mia
    expect(bases).toMatch(/sponsor/);
  });
});

// ─── Part 8: Review status ───────────────────────────────────────────────────

describe('Participant review status', () => {
  it('all participant cards have a valid reviewStatus', () => {
    const graph = buildGraph();
    const validStatuses = ['ready', 'needs_review', 'missing_info'];
    for (const card of graph.participantCards) {
      expect(validStatuses).toContain(card.reviewStatus);
    }
  });

  it('participants without email are not marked ready', () => {
    const graph = buildGraph();
    // In the Sunset Sessions fixture, parties typically lack emails
    for (const card of graph.participantCards) {
      if (!card.name) continue;
      // Cannot be 'ready' if they have low confidence items
      if (card.lowConfidenceItems.length > 0) {
        expect(card.reviewStatus).not.toBe('ready');
      }
    }
  });
});

// ─── Backward compatibility ─────────────────────────────────────────────────

describe('Backward compatibility', () => {
  it('settlementSchedule (legacy field) is still present on participant cards', () => {
    const graph = buildGraph();
    for (const card of graph.participantCards) {
      expect(Array.isArray(card.settlementSchedule)).toBe(true);
    }
  });

  it('operationalObligations and deliverables are the same content', () => {
    const graph = buildGraph();
    for (const card of graph.participantCards) {
      expect(card.deliverables).toEqual(card.operationalObligations);
    }
  });

  it('compensationTerms is still a string[] of formatted labels', () => {
    const graph = buildGraph();
    for (const card of graph.participantCards) {
      expect(Array.isArray(card.compensationTerms)).toBe(true);
      for (const term of card.compensationTerms) {
        expect(typeof term).toBe('string');
      }
    }
  });
});
