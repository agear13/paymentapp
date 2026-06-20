import {
  AuditEventType,
  AuditSeverity,
  createAuditLog,
  queryAuditLogs,
} from '@/lib/audit/audit-log';

const mockAuditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
const mockAuditFindMany = jest.fn().mockResolvedValue([
  {
    id: 'audit-1',
    event_type: AuditEventType.PAYOUT_PAID,
    severity: AuditSeverity.INFO,
    user_id: 'user-1',
    organization_id: 'org-1',
    entity_type: 'payout',
    entity_id: '00000000-0000-0000-0000-000000000001',
    action: 'mark_paid',
    correlation_id: 'corr-1',
    old_values: { status: 'PENDING' },
    new_values: { status: 'PAID' },
    metadata: null,
    ip_address: '127.0.0.1',
    user_agent: 'jest',
    created_at: new Date('2026-06-08T12:00:00Z'),
  },
]);

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    audit_logs: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
      findMany: (...args: unknown[]) => mockAuditFindMany(...args),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

describe('audit log persistence', () => {
  beforeEach(() => {
    mockAuditCreate.mockClear();
    mockAuditFindMany.mockClear();
  });

  it('persists audit records without throwing', async () => {
    await expect(
      createAuditLog({
        eventType: AuditEventType.PAYOUT_PAID,
        severity: AuditSeverity.INFO,
        userId: 'user-1',
        organizationId: 'org-1',
        resource: 'payout',
        resourceId: '00000000-0000-0000-0000-000000000001',
        action: 'mark_paid',
        oldValue: JSON.stringify({ status: 'PENDING' }),
        newValue: JSON.stringify({ status: 'PAID' }),
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        correlationId: 'corr-1',
        timestamp: new Date(),
      })
    ).resolves.toBeUndefined();

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate.mock.calls[0][0].data.event_type).toBe(AuditEventType.PAYOUT_PAID);
  });

  it('queryAuditLogs returns persisted rows', async () => {
    const rows = await queryAuditLogs({
      organizationId: 'org-1',
      eventTypes: [AuditEventType.PAYOUT_PAID],
      limit: 10,
    });

    expect(mockAuditFindMany).toHaveBeenCalled();
    expect(rows).toHaveLength(1);
    expect(rows[0].eventType).toBe(AuditEventType.PAYOUT_PAID);
    expect(rows[0].organizationId).toBe('org-1');
  });

  it('audit failures never break callers', async () => {
    mockAuditCreate.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      createAuditLog({
        eventType: AuditEventType.SECURITY_CSRF_VIOLATION,
        severity: AuditSeverity.WARNING,
        resource: '/api/test',
        timestamp: new Date(),
      })
    ).resolves.toBeUndefined();
  });
});
