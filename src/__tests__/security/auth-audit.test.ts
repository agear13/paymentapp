import { NextRequest } from 'next/server';
import { POST as authAuditPost } from '@/app/api/auth/audit/route';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { AuditEventType } from '@/lib/audit/audit-log';

const mockAuditCreate = jest.fn().mockResolvedValue({ id: 'audit-auth-1' });

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    audit_logs: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

jest.mock('@/lib/rate-limit', () => ({
  applyRateLimit: jest.fn().mockResolvedValue({ success: true }),
}));

describe('authentication audit logging', () => {
  beforeEach(() => {
    mockAuditCreate.mockClear();
  });

  it('records login failure via /api/auth/audit', async () => {
    const request = new NextRequest('http://localhost/api/auth/audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventType: AuditEventType.AUTH_LOGIN_FAILED,
        email: 'user@example.com',
        success: false,
        reason: 'Invalid credentials',
      }),
    });

    const response = await authAuditPost(request);
    expect(response.status).toBe(200);
    expect(mockAuditCreate).toHaveBeenCalled();
    expect(mockAuditCreate.mock.calls[0][0].data.event_type).toBe(AuditEventType.AUTH_LOGIN_FAILED);
  });

  it('recordAuthAuditEvent never throws on persistence failure', async () => {
    mockAuditCreate.mockRejectedValueOnce(new Error('db down'));

    expect(() =>
      recordAuthAuditEvent({
        eventType: AuditEventType.AUTH_LOGOUT,
        userId: 'user-1',
        email: 'user@example.com',
      })
    ).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  it('stores membership change events with organization context', async () => {
    await recordAuthAuditEvent({
      eventType: AuditEventType.ORG_MEMBERSHIP_CHANGED,
      userId: 'user-1',
      organizationId: '00000000-0000-0000-0000-000000000001',
      metadata: { role: 'OWNER' },
    });

    expect(mockAuditCreate).toHaveBeenCalled();
    const payloads = mockAuditCreate.mock.calls.map((call) => call[0].data);
    expect(
      payloads.some((row) => row.event_type === AuditEventType.ORG_MEMBERSHIP_CHANGED)
    ).toBe(true);
  });
});
