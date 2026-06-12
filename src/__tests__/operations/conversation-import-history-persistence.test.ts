import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { ConversationImportAuditRecord } from '@/lib/operations/audit/conversation-import-audit-types';
import {
  appendConversationImportToDeal,
  deriveConversationImportAuditTimeline,
  materializeConversationImportHistoryForDeal,
  mergeConversationImportHistoryOnDeal,
} from '@/lib/operations/audit/conversation-import-audit';

function baseDeal(): RecentDeal {
  return {
    id: 'deal-audit-1',
    dealName: 'Audit Trail Project',
    partner: 'Partner',
    value: 10_000,
    introducer: '',
    closer: '',
    status: 'Pending',
    lastUpdated: '2026-05-20T10:00:00.000Z',
    paymentStatus: 'Not Paid',
  };
}

function importRecord(label: string, index: number): ConversationImportAuditRecord {
  const importedAt = new Date(Date.UTC(2026, 4, 20, 10, index, 0)).toISOString();
  return {
    id: `import-${label}-${index}`,
    importedAt,
    extractedAt: importedAt,
    sourceType: 'WhatsApp',
    extractorVersion: 'v1',
    entryPoint: 'participant_add',
    rawConversationText: `Conversation ${label} body text`,
    extractionSummary: {
      oneLiner: `Import ${label}`,
      participantCount: 1,
      fixedFeeObligationCount: 0,
      revenueShareObligationCount: 1,
      hybridParticipantCount: 0,
      attributionCount: 0,
      agreementTypeLabel: '1 revenue share',
      overallConfidence: 'high',
    },
    parties: [
      {
        name: `Party ${label}`,
        role: 'Contractor',
        participationModel: 'revenue_share',
        revenueSharePct: 10,
        partyConfidence: 'high',
        nameConfidence: 'high',
        participationModelConfidence: 'high',
        amountConfidence: 'high',
      },
    ],
  };
}

/** Simulates syncPilotSnapshotForUser deal merge + GET materialize (page refresh). */
function simulatePersistAndReload(
  stored: RecentDeal | null,
  incoming: RecentDeal
): RecentDeal {
  const merged = mergeConversationImportHistoryOnDeal(stored, incoming);
  return materializeConversationImportHistoryForDeal(merged);
}

describe('conversation import history persistence', () => {
  it('append-only: four imports yield history length 4 and four timeline events', () => {
    let deal = baseDeal();
    const labels = ['A', 'B', 'C', 'D'] as const;

    for (let i = 0; i < labels.length; i++) {
      deal = appendConversationImportToDeal(deal, importRecord(labels[i]!, i));
    }

    expect(deal.conversationImportHistory).toHaveLength(4);
    expect(deal.conversationImportHistory!.map((r) => r.rawConversationText)).toEqual([
      'Conversation A body text',
      'Conversation B body text',
      'Conversation C body text',
      'Conversation D body text',
    ]);

    const timeline = deriveConversationImportAuditTimeline([deal], deal.id);
    expect(timeline).toHaveLength(4);
    expect(timeline.every((e) => e.type === 'conversation_imported')).toBe(true);
    expect(new Set(timeline.map((e) => e.conversationImport?.importId)).size).toBe(4);
  });

  it('survives stale snapshot save that omits conversationImportHistory (participant update path)', () => {
    let stored = baseDeal();
    const labels = ['A', 'B', 'C', 'D'] as const;

    for (let i = 0; i < labels.length; i++) {
      stored = appendConversationImportToDeal(stored, importRecord(labels[i]!, i));
      stored = simulatePersistAndReload(stored, stored);
    }

    expect(stored.conversationImportHistory).toHaveLength(4);

    const staleParticipantSave: RecentDeal = {
      ...stored,
      conversationImportHistory: undefined,
      dealName: 'Updated project title only',
    };
    const afterStaleSave = simulatePersistAndReload(stored, staleParticipantSave);

    expect(afterStaleSave.conversationImportHistory).toHaveLength(4);
    expect(afterStaleSave.dealName).toBe('Updated project title only');

    const timeline = deriveConversationImportAuditTimeline([afterStaleSave], afterStaleSave.id);
    expect(timeline).toHaveLength(4);
  });

  it('after simulated full page refresh, timeline still lists all imports', () => {
    let deal = baseDeal();
    for (const [i, label] of ['A', 'B', 'C', 'D'].entries()) {
      deal = appendConversationImportToDeal(deal, importRecord(label, i));
    }

    const persistedPayload = { ...deal };
    const reloaded = materializeConversationImportHistoryForDeal(
      JSON.parse(JSON.stringify(persistedPayload)) as RecentDeal
    );

    expect(reloaded.conversationImportHistory).toHaveLength(4);
    const timeline = deriveConversationImportAuditTimeline([reloaded], reloaded.id);
    expect(timeline).toHaveLength(4);
    expect(timeline[0]?.conversationImport?.rawConversationText).toBe('Conversation D body text');
  });

  it('never replaces history when incoming carries a shorter history array', () => {
    let deal = baseDeal();
    deal = appendConversationImportToDeal(deal, importRecord('A', 0));
    deal = appendConversationImportToDeal(deal, importRecord('B', 1));
    deal = appendConversationImportToDeal(deal, importRecord('C', 2));

    const maliciousIncoming: RecentDeal = {
      ...deal,
      conversationImportHistory: [importRecord('D', 3)],
    };

    const merged = mergeConversationImportHistoryOnDeal(deal, maliciousIncoming);
    expect(merged.conversationImportHistory).toHaveLength(4);
    expect(merged.conversationImportHistory!.map((r) => r.id)).toEqual(
      expect.arrayContaining([
        'import-A-0',
        'import-B-1',
        'import-C-2',
        'import-D-3',
      ])
    );
  });

  it('materializes legacy importedConversation into history without using it as timeline fallback', () => {
    const legacyOnly: RecentDeal = {
      ...baseDeal(),
      importedConversation: 'Legacy thread only',
      importedAt: '2026-01-01T00:00:00.000Z',
    };

    const materialized = materializeConversationImportHistoryForDeal(legacyOnly);
    expect(materialized.conversationImportHistory).toHaveLength(1);
    expect(materialized.conversationImportHistory![0]?.rawConversationText).toBe('Legacy thread only');

    const timeline = deriveConversationImportAuditTimeline([legacyOnly], legacyOnly.id);
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.conversationImport?.importId).toBe(`legacy-${legacyOnly.id}`);
  });
});
