import { deriveWorkspaceTasks, groupTasksBySeverity } from '@/lib/mission-control/workspace-task-engine';
import { deriveMissionControl } from '@/lib/mission-control/derive-mission-control';
import type { QueueTask } from '@/components/operations/operational-queue';
import type { BusinessFinancialSnapshot } from '@/lib/commercial/business-financial-snapshot';
import type { WorkspaceTimelineEvent } from '@/lib/workspace-timeline/types';

function makePriority(id: string, priority: QueueTask['priority'] = 'high'): QueueTask {
  return {
    id,
    priority,
    title: `Priority ${id}`,
    context: 'Beach Festival',
    estimatedMinutes: 3,
    impact: 'Settlement blocked until resolved.',
    ctaLabel: 'Review',
    ctaHref: '/dashboard/projects/beach',
  };
}

function makeTimelineEvent(overrides: Partial<WorkspaceTimelineEvent> = {}): WorkspaceTimelineEvent {
  return {
    id: 'evt-1',
    type: 'invoice_due',
    date: '2026-07-10',
    title: 'Invoice overdue',
    subtitle: 'Customer payment',
    projectId: 'p1',
    projectName: 'Beach Festival',
    participantId: null,
    participantName: null,
    sourceEntity: { kind: 'payment_link', id: 'pl1', label: 'Invoice', href: '/dashboard/payment-links/pl1' },
    status: 'overdue',
    importance: 'critical',
    layer: 'commercial',
    currency: 'AUD',
    amount: 6500,
    direction: 'incoming',
    metadata: {},
    lineage: [],
    explanation: {
      whyThisMatters: 'Outstanding invoice affects forecast.',
      recommendedAction: 'Follow up customer',
      commercialConsequence: null,
      accountingConsequence: null,
      settlementConsequence: null,
    },
    commercialLayer: null,
    accountingLayer: null,
    settlementLayer: null,
    linkedEntities: [],
    actions: [{ label: 'Open invoice', href: '/dashboard/payment-links/pl1' }],
    tags: [],
    entityKey: 'payment_link:pl1',
    ...overrides,
  };
}

describe('deriveWorkspaceTasks', () => {
  it('maps business priorities into workspace tasks', () => {
    const business = {
      priorities: [makePriority('connect-xero', 'critical')],
      projectRecords: [],
    } as unknown as BusinessFinancialSnapshot;

    const tasks = deriveWorkspaceTasks({
      business,
      timelineEvents: [],
      healthSnapshots: [],
      currentDate: '2026-07-10',
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Priority connect-xero');
    expect(tasks[0].severity).toBe('high');
    expect(tasks[0].status).toBe('blocked');
  });

  it('derives timeline tasks with recommended actions', () => {
    const tasks = deriveWorkspaceTasks({
      business: null,
      timelineEvents: [makeTimelineEvent()],
      healthSnapshots: [],
      currentDate: '2026-07-11',
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].recommendedAction).toBe('Follow up customer');
    expect(tasks[0].status).toBe('overdue');
  });

  it('deduplicates tasks by id', () => {
    const business = {
      priorities: [makePriority('dup')],
      projectRecords: [],
    } as unknown as BusinessFinancialSnapshot;

    const tasks = deriveWorkspaceTasks({
      business,
      timelineEvents: [],
      healthSnapshots: [],
    });

    const grouped = groupTasksBySeverity(tasks);
    const all = [...grouped.high, ...grouped.medium, ...grouped.low];
    const ids = all.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('deriveMissionControl', () => {
  it('limits timeline preview to eight events', () => {
    const events = Array.from({ length: 12 }, (_, i) =>
      makeTimelineEvent({
        id: `evt-${i}`,
        date: '2026-07-10',
        importance: i % 2 === 0 ? 'high' : 'medium',
      })
    );

    const result = deriveMissionControl({
      business: null,
      timelineEvents: events,
      healthSnapshots: [],
      currentDate: '2026-07-10',
    });

    expect(result.timelinePreview.length).toBeLessThanOrEqual(8);
  });
});
