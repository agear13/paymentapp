import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/organization/resolve-organization-api.server', () => ({
  resolveSessionOrganizationId: jest.fn(),
}));

jest.mock('@/lib/auth/organization-access', () => ({
  hasOrganizationPermission: jest.fn(),
}));

jest.mock('@/lib/auth/mfa.server', () => ({
  getMfaAssuranceSnapshot: jest.fn(),
}));

jest.mock('@/lib/audit/auth-audit.server', () => ({
  recordAuthAuditEvent: jest.fn(),
}));

import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { resolveSessionOrganizationId } from '@/lib/organization/resolve-organization-api.server';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { getMfaAssuranceSnapshot } from '@/lib/auth/mfa.server';
import { requirePaymentConfigurationAccess } from '@/lib/auth/step-up.server';

const mockGetCurrentUserForApi = getCurrentUserForApi as jest.Mock;
const mockResolveSessionOrganizationId = resolveSessionOrganizationId as jest.Mock;
const mockHasOrganizationPermission = hasOrganizationPermission as jest.Mock;
const mockGetMfaAssuranceSnapshot = getMfaAssuranceSnapshot as jest.Mock;

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222';

function request(): NextRequest {
  return new NextRequest('http://localhost/api/merchant-settings', { method: 'PATCH' });
}

describe('requirePaymentConfigurationAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUserForApi.mockResolvedValue({
      user: { id: 'owner-1', email: 'owner@example.com' },
      response: null,
    });
    mockResolveSessionOrganizationId.mockResolvedValue({
      organizationId: ORG_ID,
      response: null,
    });
    mockHasOrganizationPermission.mockResolvedValue(true);
  });

  it('blocks an OWNER without MFA from payment configuration changes', async () => {
    mockGetMfaAssuranceSnapshot.mockResolvedValue({
      verifiedTotpCount: 0,
      currentLevel: 'aal1',
      methods: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
    });

    const result = await requirePaymentConfigurationAccess(request());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('MFA_ENROLLMENT_REQUIRED');
    expect(result.response.status).toBe(403);
  });

  it('blocks a stolen session that is enrolled but has no recent TOTP step-up', async () => {
    mockGetMfaAssuranceSnapshot.mockResolvedValue({
      verifiedTotpCount: 1,
      currentLevel: 'aal2',
      methods: [
        { method: 'password', timestamp: Math.floor(Date.now() / 1000) },
        { method: 'totp', timestamp: Math.floor(Date.now() / 1000) - 601 },
      ],
    });

    const result = await requirePaymentConfigurationAccess(request());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('STEP_UP_REQUIRED');
  });

  it('allows an OWNER with recent AAL2 TOTP', async () => {
    mockGetMfaAssuranceSnapshot.mockResolvedValue({
      verifiedTotpCount: 1,
      currentLevel: 'aal2',
      methods: [
        { method: 'password', timestamp: Math.floor(Date.now() / 1000) },
        { method: 'totp', timestamp: Math.floor(Date.now() / 1000) },
      ],
    });

    const result = await requirePaymentConfigurationAccess(request());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.organizationId).toBe(ORG_ID);
  });

  it('rejects a client-supplied organization id that does not match the session org', async () => {
    mockResolveSessionOrganizationId.mockResolvedValue({
      organizationId: null,
      response: NextResponse.json(
        { error: 'organization_id does not match authenticated workspace', code: 'ORGANIZATION_MISMATCH' },
        { status: 403 }
      ),
    });

    const result = await requirePaymentConfigurationAccess(request(), OTHER_ORG_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    expect(mockHasOrganizationPermission).not.toHaveBeenCalled();
  });
});
