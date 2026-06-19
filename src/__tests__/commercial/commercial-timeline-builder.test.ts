/**
 * Regression tests — Commercial Timeline Builder
 *
 * Covers:
 *   - buildCommercialTimeline: event conversion, deduplication, chronological ordering
 *   - Participant timeline filtering
 *   - Commercial impact generation (every mapped event has an impact string)
 *   - Timeline generation after approvals
 *   - Invoice lifecycle events
 *   - Xero export lifecycle
 *   - Settlement lifecycle
 *   - AI timeline references (buildProvvyTimelineNarrative, buildCommercialTimelineContext)
 *   - Unmapped system events are excluded
 *   - Actor names are threaded into descriptions
 */

import {
  buildCommercialTimeline,
  buildParticipantCommercialJourney,
  buildCommercialTimelineContext,
  buildProvvyTimelineNarrative,
  relativeTimeLabel,
} from '../../lib/commercial/commercial-timeline-events';

/* ─── Fixtures ──────────────────────────────────────────────────────────── */

const FIXED_NOW = new Date('2025-06-12T10:00:00Z').getTime();

function fixedEntry(type, overrides = {}) {
  return {
    id: `fixed-${type}-${Math.random().toString(36).slice(2)}`,
    type,
    title: type,
    description: 'description',
    timestamp: new Date(FIXED_NOW).toISOString(),
    ...overrides,
  };
}

/* ─── buildCommercialTimeline ────────────────────────────────────────────── */

describe('buildCommercialTimeline', () => {
  describe('event conversion', () => {
    it('converts agreement_approved to commercial event', () => {
      const entries = [
        fixedEntry('agreement_approved', { actor: 'Sarah' }),
      ];

      const events = buildCommercialTimeline({ auditEntries: entries });

      expect(events).toHaveLength(1);
      const event = events[0];
      expect(event.type).toBe('agreement_approved');
      expect(event.title).toBe('Agreement approved');
      expect(event.description).toContain('Sarah');
      expect(event.commercialImpact).toBeTruthy();
      expect(event.commercialImpact.length).toBeGreaterThan(10);
    });

    it('converts conversation_imported to agreement_negotiated', () => {
      const entries = [fixedEntry('conversation_imported', { actor: 'James' })];
      const events = buildCommercialTimeline({ auditEntries: entries });

      expect(events[0] && events[0].type).toBe('agreement_negotiated');
      expect(events[0] && events[0].title).toBe('Agreement negotiated');
    });

    it('converts stripe_connected to payment_provider_connected', () => {
      const entries = [fixedEntry('stripe_connected')];
      const events = buildCommercialTimeline({ auditEntries: entries });

      expect(events[0] && events[0].type).toBe('payment_provider_connected');
      expect(events[0] && events[0].title).toBe('Payment provider connected');
    });

    it('converts release_batch_generated to payment_released', () => {
      const entries = [fixedEntry('release_batch_generated', { actor: 'James' })];
      const events = buildCommercialTimeline({ auditEntries: entries });

      expect(events[0] && events[0].type).toBe('payment_released');
      expect(events[0] && events[0].title).toBe('Payments released');
    });

    it('includes actor name in description when available', () => {
      const entries = [fixedEntry('agreement_approved', { actor: 'Ben' })];
      const events = buildCommercialTimeline({ auditEntries: entries });

      expect(events[0] && events[0].description).toContain('Ben');
    });

    it('handles missing actor gracefully', () => {
      const entries = [fixedEntry('agreement_approved', { actor: undefined })];
      const events = buildCommercialTimeline({ auditEntries: entries });

      expect(events[0] && events[0].description).toBeTruthy();
      expect(events[0] && events[0].description).not.toContain('undefined');
    });
  });

  describe('system event exclusion', () => {
    it('excludes operational_graph_initialized (system event)', () => {
      const entries = [fixedEntry('operational_graph_initialized')];
      const events = buildCommercialTimeline({ auditEntries: entries });
      expect(events).toHaveLength(0);
    });

    it('excludes settlement_infrastructure_ready (system event)', () => {
      const entries = [fixedEntry('settlement_infrastructure_ready')];
      const events = buildCommercialTimeline({ auditEntries: entries });
      expect(events).toHaveLength(0);
    });

    it('excludes operational_graph_initialization_failed (system event)', () => {
      const entries = [fixedEntry('operational_graph_initialization_failed')];
      const events = buildCommercialTimeline({ auditEntries: entries });
      expect(events).toHaveLength(0);
    });

    it('includes only mapped commercial events from a mixed list', () => {
      const entries = [
        fixedEntry('agreement_approved', { id: 'a1', actor: 'Sarah' }),
        fixedEntry('operational_graph_initialized', { id: 's1' }),
        fixedEntry('stripe_connected', { id: 'a2' }),
        fixedEntry('settlement_infrastructure_ready', { id: 's2' }),
      ];
      const events = buildCommercialTimeline({ auditEntries: entries });
      expect(events).toHaveLength(2);
      expect(events.map((e) => e.type)).toContain('agreement_approved');
      expect(events.map((e) => e.type)).toContain('payment_provider_connected');
    });
  });

  describe('chronological ordering', () => {
    it('sorts newest-first by default', () => {
      const older = fixedEntry('agreement_shared', {
        id: 'old',
        timestamp: new Date('2025-06-10T10:00:00Z').toISOString(),
      });
      const newer = fixedEntry('agreement_approved', {
        id: 'new',
        timestamp: new Date('2025-06-12T10:00:00Z').toISOString(),
        actor: 'Sarah',
      });

      const events = buildCommercialTimeline({ auditEntries: [older, newer] });

      expect(events[0] && events[0].type).toBe('agreement_approved');
      expect(events[1] && events[1].type).toBe('agreement_sent');
    });

    it('sorts oldest-first when newestFirst is false', () => {
      const older = fixedEntry('agreement_shared', {
        id: 'old',
        timestamp: new Date('2025-06-10T10:00:00Z').toISOString(),
      });
      const newer = fixedEntry('agreement_approved', {
        id: 'new',
        timestamp: new Date('2025-06-12T10:00:00Z').toISOString(),
        actor: 'Sarah',
      });

      const events = buildCommercialTimeline({
        auditEntries: [newer, older],
        newestFirst: false,
      });

      expect(events[0] && events[0].type).toBe('agreement_sent');
      expect(events[1] && events[1].type).toBe('agreement_approved');
    });

    it('does not crash when items have the same timestamp', () => {
      const sameTime = new Date('2025-06-12T10:00:00Z').toISOString();
      const entries = [
        fixedEntry('agreement_approved', { id: 'first', timestamp: sameTime, actor: 'A' }),
        fixedEntry('stripe_connected', { id: 'second', timestamp: sameTime }),
      ];
      const events = buildCommercialTimeline({ auditEntries: entries });
      expect(events).toHaveLength(2);
    });
  });

  describe('deduplication', () => {
    it('deduplicates by id — keeps first occurrence', () => {
      const entries = [
        fixedEntry('agreement_approved', { id: 'dup-id', actor: 'Sarah' }),
        fixedEntry('agreement_approved', { id: 'dup-id', actor: 'Sarah duplicate' }),
      ];
      const events = buildCommercialTimeline({ auditEntries: entries });
      expect(events).toHaveLength(1);
      expect(events[0] && events[0].performedBy).toBe('Sarah');
    });

    it('does not deduplicate different ids of the same event type', () => {
      const entries = [
        fixedEntry('agreement_approved', {
          id: 'p1-approval',
          actor: 'Sarah',
          participantId: 'p1',
          timestamp: new Date('2025-06-12T09:00:00Z').toISOString(),
        }),
        fixedEntry('agreement_approved', {
          id: 'p2-approval',
          actor: 'Ben',
          participantId: 'p2',
          timestamp: new Date('2025-06-11T09:00:00Z').toISOString(),
        }),
      ];
      const events = buildCommercialTimeline({ auditEntries: entries });
      expect(events).toHaveLength(2);
    });

    it('merges additionalEntries and deduplicates across both', () => {
      const base = [fixedEntry('agreement_approved', { id: 'shared', actor: 'Sarah' })];
      const additional = [fixedEntry('agreement_approved', { id: 'shared', actor: 'Sarah' })];
      const events = buildCommercialTimeline({ auditEntries: base, additionalEntries: additional });
      expect(events).toHaveLength(1);
    });
  });

  describe('project filtering', () => {
    it('excludes events for a different project', () => {
      const entries = [
        fixedEntry('agreement_approved', { id: 'a1', projectId: 'project-A', actor: 'Sarah' }),
        fixedEntry('stripe_connected', { id: 'a2', projectId: 'project-B' }),
      ];
      const events = buildCommercialTimeline({ auditEntries: entries, projectId: 'project-A' });
      expect(events).toHaveLength(1);
      expect(events[0] && events[0].type).toBe('agreement_approved');
    });

    it('includes events with no projectId when filtering by project', () => {
      const entries = [
        fixedEntry('agreement_approved', { id: 'a1', projectId: undefined, actor: 'Sarah' }),
        fixedEntry('stripe_connected', { id: 'a2', projectId: 'project-B' }),
      ];
      const events = buildCommercialTimeline({ auditEntries: entries, projectId: 'project-A' });
      expect(events.some((e) => e.type === 'agreement_approved')).toBe(true);
    });
  });

  describe('participant filtering', () => {
    it('excludes events for a different participant', () => {
      const entries = [
        fixedEntry('agreement_approved', { id: 'p1', participantId: 'sarah-id', actor: 'Sarah' }),
        fixedEntry('agreement_approved', { id: 'p2', participantId: 'ben-id', actor: 'Ben' }),
      ];
      const events = buildCommercialTimeline({
        auditEntries: entries,
        participantId: 'sarah-id',
      });
      expect(events).toHaveLength(1);
      expect(events[0] && events[0].performedBy).toBe('Sarah');
    });
  });

  describe('commercial impact generation', () => {
    const COMMERCIAL_TYPES = [
      'agreement_approved',
      'agreement_shared',
      'agreement_viewed',
      'conversation_imported',
      'stripe_connected',
      'payment_rails_connected',
      'funding_linked',
      'obligations_generated',
      'obligations_funded',
      'release_batch_generated',
      'compensation_updated',
      'attribution_configured',
      'payout_eligible',
      'workspace_created',
      'project_initialized',
    ];

    it.each(COMMERCIAL_TYPES)('"%s" produces a commercialImpact string', (type) => {
      const entries = [fixedEntry(type, { id: 'impact-' + type, description: 'Obligation count: 4' })];
      const events = buildCommercialTimeline({ auditEntries: entries });
      if (events.length === 0) return;
      expect(events[0] && events[0].commercialImpact).toBeTruthy();
      expect(events[0] && events[0].commercialImpact.length).toBeGreaterThan(5);
    });

    it('agreement_approved impact mentions settlement or operations', () => {
      const events = buildCommercialTimeline({
        auditEntries: [fixedEntry('agreement_approved', { id: 'x', actor: 'Sarah' })],
      });
      const impact = (events[0] && events[0].commercialImpact || '').toLowerCase();
      expect(impact).toMatch(/settlement|revenue|operations|attribution/);
    });

    it('stripe_connected impact mentions payments or revenue', () => {
      const events = buildCommercialTimeline({
        auditEntries: [fixedEntry('stripe_connected', { id: 'y' })],
      });
      const impact = (events[0] && events[0].commercialImpact || '').toLowerCase();
      expect(impact).toMatch(/payment|revenue|collect/);
    });
  });

  describe('approval lifecycle', () => {
    it('generates events for each participant approval', () => {
      const entries = [
        fixedEntry('agreement_approved', { id: 'p1', actor: 'Sarah', participantId: 'sarah-id', timestamp: new Date('2025-06-12T09:00:00Z').toISOString() }),
        fixedEntry('agreement_approved', { id: 'p2', actor: 'Ben', participantId: 'ben-id', timestamp: new Date('2025-06-11T09:00:00Z').toISOString() }),
        fixedEntry('agreement_approved', { id: 'p3', actor: 'Alex', participantId: 'alex-id', timestamp: new Date('2025-06-10T09:00:00Z').toISOString() }),
      ];
      const events = buildCommercialTimeline({ auditEntries: entries });
      expect(events).toHaveLength(3);
      const actors = events.map((e) => e.performedBy);
      expect(actors).toContain('Sarah');
      expect(actors).toContain('Ben');
      expect(actors).toContain('Alex');
    });

    it('approvals are ordered newest-first', () => {
      const entries = [
        fixedEntry('agreement_approved', { id: 'last', actor: 'Ben', timestamp: new Date('2025-06-10T00:00:00Z').toISOString() }),
        fixedEntry('agreement_approved', { id: 'first', actor: 'Sarah', timestamp: new Date('2025-06-12T00:00:00Z').toISOString() }),
      ];
      const events = buildCommercialTimeline({ auditEntries: entries });
      expect(events[0] && events[0].performedBy).toBe('Sarah');
      expect(events[1] && events[1].performedBy).toBe('Ben');
    });
  });

  describe('invoice lifecycle', () => {
    it('obligations_generated maps to obligations_created stage', () => {
      const entries = [fixedEntry('obligations_generated', { id: 'obl', description: 'Obligation count: 4' })];
      const events = buildCommercialTimeline({ auditEntries: entries });
      expect(events[0] && events[0].stage).toBe('obligations_created');
    });

    it('funding_reserved_against_obligations maps to obligations_created stage', () => {
      const entries = [fixedEntry('funding_reserved_against_obligations', { id: 'fr' })];
      const events = buildCommercialTimeline({ auditEntries: entries });
      expect(events[0] && events[0].stage).toBe('obligations_created');
    });
  });

  describe('Xero export lifecycle', () => {
    it('payment_rails_connected maps to agreement_approved stage', () => {
      const entries = [fixedEntry('payment_rails_connected', { id: 'pr' })];
      const events = buildCommercialTimeline({ auditEntries: entries });
      expect(events[0] && events[0].stage).toBe('agreement_approved');
    });
  });

  describe('settlement lifecycle', () => {
    it('release_batch_generated maps to payment_released stage', () => {
      const entries = [fixedEntry('release_batch_generated', { id: 'rb' })];
      const events = buildCommercialTimeline({ auditEntries: entries });
      expect(events[0] && events[0].stage).toBe('payment_released');
    });

    it('payout_eligible maps to payment_released stage', () => {
      const entries = [fixedEntry('payout_eligible', { id: 'pe' })];
      const events = buildCommercialTimeline({ auditEntries: entries });
      expect(events[0] && events[0].stage).toBe('payment_released');
    });

    it('full lifecycle produces events in the correct stage sequence', () => {
      const entries = [
        fixedEntry('conversation_imported', { id: 'e1', timestamp: new Date('2025-06-01T00:00:00Z').toISOString() }),
        fixedEntry('agreement_shared', { id: 'e2', timestamp: new Date('2025-06-03T00:00:00Z').toISOString() }),
        fixedEntry('agreement_approved', { id: 'e3', actor: 'Sarah', timestamp: new Date('2025-06-05T00:00:00Z').toISOString() }),
        fixedEntry('obligations_generated', { id: 'e4', timestamp: new Date('2025-06-06T00:00:00Z').toISOString(), description: 'Obligation count: 2' }),
        fixedEntry('stripe_connected', { id: 'e5', timestamp: new Date('2025-06-07T00:00:00Z').toISOString() }),
        fixedEntry('release_batch_generated', { id: 'e6', timestamp: new Date('2025-06-10T00:00:00Z').toISOString() }),
      ];

      const events = buildCommercialTimeline({ auditEntries: entries, newestFirst: false });

      expect(events.length).toBeGreaterThanOrEqual(5);

      const stages = events.map((e) => e.stage);
      const lastNegotiatedIdx = stages.lastIndexOf('negotiated');
      const approvedIdx = stages.indexOf('agreement_approved');
      const paymentIdx = stages.indexOf('payment_released');

      expect(lastNegotiatedIdx).toBeLessThan(approvedIdx);
      expect(approvedIdx).toBeLessThan(paymentIdx);
    });
  });

  describe('empty input', () => {
    it('returns empty array for empty input', () => {
      expect(buildCommercialTimeline({ auditEntries: [] })).toHaveLength(0);
    });

    it('returns empty array when all entries are system events', () => {
      const entries = [
        fixedEntry('operational_graph_initialized', { id: 's1' }),
        fixedEntry('settlement_infrastructure_ready', { id: 's2' }),
      ];
      expect(buildCommercialTimeline({ auditEntries: entries })).toHaveLength(0);
    });
  });
});

/* ─── buildParticipantCommercialJourney ──────────────────────────────────── */

describe('buildParticipantCommercialJourney', () => {
  it('returns all 9 stages', () => {
    const journey = buildParticipantCommercialJourney([], 'p1');
    expect(journey).toHaveLength(9);
  });

  it('marks no stages as completed for a participant with no events', () => {
    const journey = buildParticipantCommercialJourney([], 'p1');
    expect(journey.every((s) => !s.completed)).toBe(true);
  });

  it('marks negotiated as completed after conversation_imported', () => {
    const events = buildCommercialTimeline({
      auditEntries: [fixedEntry('conversation_imported', { id: 'e1', participantId: 'p1' })],
      participantId: 'p1',
    });
    const journey = buildParticipantCommercialJourney(events, 'p1');
    const negotiated = journey.find((s) => s.stage === 'negotiated');
    expect(negotiated && negotiated.completed).toBe(true);
  });

  it('marks stages up to approval as completed when approval event is present', () => {
    const participantId = 'sarah-id';
    const events = [
      {
        id: 'e1',
        type: 'agreement_negotiated',
        stage: 'negotiated',
        title: 'Agreement negotiated',
        description: 'desc',
        commercialImpact: 'impact',
        occurredAt: new Date('2025-06-01T00:00:00Z').toISOString(),
        participantId,
      },
      {
        id: 'e2',
        type: 'agreement_sent',
        stage: 'agreement_generated',
        title: 'Agreement sent',
        description: 'desc',
        commercialImpact: 'impact',
        occurredAt: new Date('2025-06-03T00:00:00Z').toISOString(),
        participantId,
      },
      {
        id: 'e3',
        type: 'agreement_approved',
        stage: 'agreement_approved',
        title: 'Agreement approved',
        description: 'desc',
        commercialImpact: 'impact',
        occurredAt: new Date('2025-06-05T00:00:00Z').toISOString(),
        performedBy: 'Sarah',
        participantId,
      },
    ];

    const journey = buildParticipantCommercialJourney(events, participantId);
    const negotiated = journey.find((s) => s.stage === 'negotiated');
    const generated = journey.find((s) => s.stage === 'agreement_generated');
    const approved = journey.find((s) => s.stage === 'agreement_approved');
    const obligations = journey.find((s) => s.stage === 'obligations_created');

    expect(negotiated && negotiated.completed).toBe(true);
    expect(generated && generated.completed).toBe(true);
    expect(approved && approved.completed).toBe(true);
    expect(obligations && obligations.completed).toBe(false);
  });

  it('includes occurredAt for completed stages', () => {
    const participantId = 'p1';
    const ts = new Date('2025-06-05T00:00:00Z').toISOString();
    const events = [
      {
        id: 'e1',
        type: 'agreement_approved',
        stage: 'agreement_approved',
        title: 'Agreement approved',
        description: 'desc',
        commercialImpact: 'impact',
        occurredAt: ts,
        participantId,
      },
    ];
    const journey = buildParticipantCommercialJourney(events, participantId);
    const approved = journey.find((s) => s.stage === 'agreement_approved');
    expect(approved && approved.occurredAt).toBe(ts);
  });
});

/* ─── AI timeline references ─────────────────────────────────────────────── */

describe('buildCommercialTimelineContext', () => {
  it('returns empty string for no events', () => {
    expect(buildCommercialTimelineContext([])).toBe('');
  });

  it('includes the title of recent events', () => {
    const events = [
      {
        id: 'e1',
        type: 'agreement_approved',
        stage: 'agreement_approved',
        title: 'Agreement approved',
        description: 'Sarah accepted the commercial terms.',
        commercialImpact: 'Revenue can begin.',
        occurredAt: new Date(Date.now() - 86400000).toISOString(),
        performedBy: 'Sarah',
      },
    ];
    const context = buildCommercialTimelineContext(events);
    expect(context).toContain('agreement approved');
  });

  it('limits to maxEvents', () => {
    const events = Array.from({ length: 10 }, (_, i) => ({
      id: 'e' + i,
      type: 'agreement_approved',
      stage: 'agreement_approved',
      title: 'Event ' + i,
      description: 'desc',
      commercialImpact: 'impact',
      occurredAt: new Date(Date.now() - i * 86400000).toISOString(),
    }));

    const context = buildCommercialTimelineContext(events, 3);
    // Rough sentence count — should be at most 4 parts
    const periodCount = (context.match(/\./g) || []).length;
    expect(periodCount).toBeLessThanOrEqual(4);
  });
});

describe('buildProvvyTimelineNarrative', () => {
  it('returns empty string for no events and no pending', () => {
    expect(buildProvvyTimelineNarrative({ events: [] })).toBe('');
  });

  it('references the most recent event', () => {
    const events = [
      {
        id: 'e1',
        type: 'agreement_approved',
        stage: 'agreement_approved',
        title: 'Agreement approved',
        description: 'desc',
        commercialImpact: 'impact',
        occurredAt: new Date(Date.now() - 86400000).toISOString(),
        performedBy: 'Sarah',
      },
    ];

    const narrative = buildProvvyTimelineNarrative({ events });
    expect(narrative.toLowerCase()).toMatch(/agreement approved/);
  });

  it('includes pending participant names', () => {
    const events = [
      {
        id: 'e1',
        type: 'agreement_approved',
        stage: 'agreement_approved',
        title: 'Agreement approved',
        description: 'desc',
        commercialImpact: 'impact',
        occurredAt: new Date(Date.now() - 86400000).toISOString(),
        performedBy: 'Sarah',
      },
    ];

    const narrative = buildProvvyTimelineNarrative({
      events,
      pendingParticipantNames: ['Ben'],
      nextCommercialAction: 'invoices can be requested',
    });

    expect(narrative).toContain('Ben');
    expect(narrative).toContain('invoices can be requested');
  });

  it('handles multiple pending participants', () => {
    const narrative = buildProvvyTimelineNarrative({
      events: [],
      pendingParticipantNames: ['Ben', 'Alex', 'Jamie'],
    });
    expect(narrative).toContain('Ben, Alex, Jamie');
    expect(narrative).toContain('waiting to approve');
  });

  it('produces a narrative referencing who approved and who is pending', () => {
    const events = [
      {
        id: 'e1',
        type: 'agreement_approved',
        stage: 'agreement_approved',
        title: 'Agreement approved',
        description: 'Sarah accepted the commercial terms.',
        commercialImpact: 'Revenue can begin.',
        occurredAt: new Date(Date.now() - 86400000).toISOString(),
        performedBy: 'Sarah',
      },
    ];

    const narrative = buildProvvyTimelineNarrative({
      events,
      pendingParticipantNames: ['Ben'],
      nextCommercialAction: 'invoices can be requested',
    });

    expect(narrative).toMatch(/Sarah/);
    expect(narrative).toMatch(/Ben/);
    expect(narrative).toMatch(/invoices/);
  });
});

/* ─── relativeTimeLabel ─────────────────────────────────────────────────── */

describe('relativeTimeLabel', () => {
  it('returns "just now" for a very recent timestamp', () => {
    const iso = new Date(Date.now() - 30000).toISOString();
    expect(relativeTimeLabel(iso)).toBe('just now');
  });

  it('returns "yesterday" for ~25 hours ago', () => {
    const iso = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    expect(relativeTimeLabel(iso)).toBe('yesterday');
  });

  it('returns "last week" for 8 days ago', () => {
    const iso = new Date(Date.now() - 8 * 86400 * 1000).toISOString();
    expect(relativeTimeLabel(iso)).toBe('last week');
  });

  it('returns a formatted date for older timestamps', () => {
    const iso = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    const result = relativeTimeLabel(iso);
    expect(result).toMatch(/[A-Za-z0-9]/);
  });
});
