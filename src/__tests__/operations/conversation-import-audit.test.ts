import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import type { ReviewFormState } from '@/lib/ai-extractor/review-form-types';
import {
  appendConversationImportToDeal,
  buildConversationImportAuditRecord,
  conversationImportToAuditEntry,
  deriveConversationImportAuditTimeline,
  formatPartyCompensationTerms,
} from '@/lib/operations/audit/conversation-import-audit';

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' | 'absent' = 'high') {
  return { value, confidence };
}

function sampleResult(): ExtractionResult {
  return {
    projectName: field('Summer Fest'),
    projectDescription: field('Live event'),
    projectValue: field(50000),
    currency: field('AUD'),
    counterparty: field('Promoter Co'),
    parties: [
      {
        id: 'p1',
        name: field('Damn Good Times Ltd'),
        email: field(''),
        role: field('Partner'),
        participationModel: field('revenue_share' as const),
        fixedAmount: field(null),
        revenueSharePct: field(10),
        notes: field(null),
      },
    ],
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: 'whatsapp',
    extractedAt: '2026-05-20T10:00:00.000Z',
  };
}

function sampleForm(): ReviewFormState {
  return {
    entryPoint: 'project_create',
    existingDealId: undefined,
    sourceType: 'whatsapp',
    projectName: 'Summer Fest',
    projectDescription: 'Live event',
    projectValue: 50000,
    currency: 'AUD',
    counterparty: 'Promoter Co',
    parties: [
      {
        id: 'p1',
        name: 'Damn Good Times Ltd',
        email: '',
        role: 'Partner',
        participationModel: 'revenue_share',
        fixedAmount: null,
        revenueSharePct: 10,
        notes: '',
      },
    ],
    duplicateResolutions: {},
    rawConversationText: "We'll pay 10% of ticket sales to Damn Good Times Ltd",
  };
}

describe('conversation import audit', () => {
  it('builds persisted import record with conversation text and summary', () => {
    const record = buildConversationImportAuditRecord({
      form: sampleForm(),
      result: sampleResult(),
      entryPoint: 'project_create',
      sourceType: 'whatsapp',
    });

    expect(record.rawConversationText).toContain('10% of ticket sales');
    expect(record.extractionSummary.participantCount).toBe(1);
    expect(record.extractionSummary.agreementTypeLabel).toContain('revenue share');
    expect(record.parties[0]?.revenueSharePct).toBe(10);
    expect(formatPartyCompensationTerms(record.parties[0]!)).toBe('10% revenue share');
  });

  it('maps import record to CONVERSATION_IMPORTED audit entry', () => {
    const record = buildConversationImportAuditRecord({
      form: sampleForm(),
      result: sampleResult(),
      entryPoint: 'project_create',
      sourceType: 'whatsapp',
    });
    const entry = conversationImportToAuditEntry('deal-1', record);

    expect(entry.type).toBe('conversation_imported');
    expect(entry.title).toBe('Conversation imported');
    expect(entry.conversationImport?.rawConversationText).toContain('ticket sales');
    expect(entry.description).toContain('1 participant');
  });

  it('derives timeline from deal conversationImportHistory', () => {
    const record = buildConversationImportAuditRecord({
      form: sampleForm(),
      result: sampleResult(),
      entryPoint: 'project_create',
      sourceType: 'whatsapp',
    });
    const deal: RecentDeal = appendConversationImportToDeal(
      {
        id: 'deal-1',
        dealName: 'Summer Fest',
        partner: 'Promoter',
        value: 50000,
        introducer: '',
        closer: '',
        status: 'Pending',
        lastUpdated: '2026-05-20T10:00:00.000Z',
        paymentStatus: 'Not Paid',
      },
      record
    );

    const timeline = deriveConversationImportAuditTimeline([deal], 'deal-1');
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.type).toBe('conversation_imported');
    expect(timeline[0]?.conversationImport?.parties).toHaveLength(1);
  });

  it('falls back to legacy importedConversation on deal without history', () => {
    const deal: RecentDeal = {
      id: 'deal-legacy',
      dealName: 'Legacy',
      partner: 'X',
      value: 0,
      introducer: '',
      closer: '',
      status: 'Pending',
      lastUpdated: '2026-01-01T00:00:00.000Z',
      paymentStatus: 'Not Paid',
      importedConversation: 'Old WhatsApp thread content',
      importedAt: '2026-01-01T00:00:00.000Z',
    };
    const timeline = deriveConversationImportAuditTimeline([deal], 'deal-legacy');
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.conversationImport?.rawConversationText).toBe('Old WhatsApp thread content');
  });
});
