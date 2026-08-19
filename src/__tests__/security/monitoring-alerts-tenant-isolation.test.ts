import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/organization/resolve-organization-api.server', () => ({
  resolveSessionOrganizationId: jest.fn(),
}));

jest.mock('@/lib/monitoring/alert-rules', () => ({
  evaluateAllAlerts: jest.fn(),
  getAlertRules: jest.fn(() => []),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/lib/auth/admin.server', () => ({
  checkAdminAuth: jest.fn(),
}));

jest.mock('@/lib/jobs/cron-request-auth', () => ({
  verifyCronRequest: jest.fn(() => ({ error: 'unauthorized' })),
  cronAuthFailureResponse: jest.fn(),
}));

import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { resolveSessionOrganizationId } from '@/lib/organization/resolve-organization-api.server';
import { evaluateAllAlerts } from '@/lib/monitoring/alert-rules';
import { GET } from '@/app/api/monitoring/alerts/route';

const mockGetCurrentUserForApi = getCurrentUserForApi as jest.Mock;
const mockResolveSessionOrganizationId = resolveSessionOrganizationId as jest.Mock;
const mockEvaluateAllAlerts = evaluateAllAlerts as jest.Mock;

const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('GET /api/monitoring/alerts tenant isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUserForApi.mockResolvedValue({
      user: { id: 'merchant-a' },
      response: null,
    });
    mockEvaluateAllAlerts.mockResolvedValue({
      alerts: [],
      criticalCount: 0,
      warningCount: 0,
    });
  });

  it('always evaluates alerts for the session organization, even when organization_id is omitted', async () => {
    mockResolveSessionOrganizationId.mockResolvedValue({
      organizationId: ORG_A,
      response: null,
    });

    const response = await GET(new NextRequest('http://localhost/api/monitoring/alerts'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockEvaluateAllAlerts).toHaveBeenCalledWith(ORG_A);
    expect(mockEvaluateAllAlerts).not.toHaveBeenCalledWith(undefined);
    expect(body.data.organizationId).toBe(ORG_A);
  });

  it('does not return another organization\'s alerts from a client-supplied organization_id', async () => {
    mockResolveSessionOrganizationId.mockResolvedValue({
      organizationId: null,
      response: new Response(
        JSON.stringify({
          error: 'organization_id does not match authenticated workspace',
          code: 'ORGANIZATION_MISMATCH',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      ),
    });

    const response = await GET(
      new NextRequest(
        `http://localhost/api/monitoring/alerts?organization_id=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`
      )
    );

    expect(response.status).toBe(403);
    expect(mockEvaluateAllAlerts).not.toHaveBeenCalled();
  });
});
