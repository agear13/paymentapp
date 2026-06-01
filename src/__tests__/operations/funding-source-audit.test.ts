import { buildFundingSourceAuditEntry } from '@/lib/operations/audit/funding-source-audit';
import {
  appendOperationalAuditEntry,
  resetOperationalAuditStoreForTests,
  getOperationalAuditEntries,
} from '@/hooks/use-operational-audit-store';

describe('funding source audit timeline', () => {
  beforeEach(() => {
    resetOperationalAuditStoreForTests();
  });

  it('builds add/update/remove entries with amount, currency, and name', () => {
    const source = {
      id: 'fs-1',
      name: 'Sponsor wire',
      amount: 12000,
      currency: 'USD',
      status: 'confirmed' as const,
    };
    const entry = buildFundingSourceAuditEntry({
      projectId: 'proj-1',
      action: 'added',
      source,
      timestamp: '2026-05-20T12:00:00.000Z',
    });
    expect(entry.type).toBe('funding_linked');
    expect(entry.title).toBe('Funding source added');
    expect(entry.description).toContain('Sponsor wire');
    expect(entry.description).toContain('USD');
    expect(entry.description).toContain('12,000');
    expect(entry.projectId).toBe('proj-1');
  });

  it('merges client audit entries so refresh does not drop funding events', () => {
    appendOperationalAuditEntry(
      buildFundingSourceAuditEntry({
        projectId: 'proj-1',
        action: 'removed',
        source: {
          id: 'fs-2',
          name: 'Invoice A',
          amount: 500,
          currency: 'AUD',
          status: 'forecast',
        },
      })
    );
    expect(getOperationalAuditEntries()).toHaveLength(1);
    expect(getOperationalAuditEntries()[0]?.description).toContain('Invoice A');
  });
});
