import { NextRequest } from 'next/server';

import { GET } from '@/app/api/merchant-settings/r2-connectivity/route';

const mockProbe = jest.fn();
const mockLogInfo = jest.fn();
const mockLogError = jest.fn();

jest.mock('@/lib/logger', () => ({
  log: {
    info: (...args: unknown[]) => mockLogInfo(...args),
    error: (...args: unknown[]) => mockLogError(...args),
  },
}));

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/auth/organization-access', () => ({
  hasOrganizationPermission: jest.fn(),
}));

jest.mock('@/lib/storage/r2-connectivity-diagnostics.server', () => ({
  probeR2BucketConnectivity: (...args: unknown[]) => mockProbe(...args),
}));

import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';

const mockGetCurrentUserForApi = getCurrentUserForApi as jest.Mock;
const mockHasOrganizationPermission = hasOrganizationPermission as jest.Mock;

describe('GET /api/merchant-settings/r2-connectivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUserForApi.mockResolvedValue({
      user: { id: 'user-1' },
      response: null,
    });
    mockHasOrganizationPermission.mockResolvedValue(true);
  });

  it('returns safe diagnostics and logs SUCCESS without secrets', async () => {
    mockProbe.mockResolvedValue({
      success: true,
      provider: 'r2',
      operation: 'HeadBucket',
      bucket: 'provvypay-assets',
      accountIdRedacted: '81ba…8841',
      s3SigningEndpointUsed: 'https://81ba3ac215bbde6352beec7e6ef28841.r2.cloudflarestorage.com',
      configuredR2Endpoint: 'https://override.example.com',
      region: 'auto',
    });

    const request = new NextRequest(
      'http://localhost/api/merchant-settings/r2-connectivity?organizationId=org-123'
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('R2 connectivity check: SUCCESS');
    expect(body.bucket).toBe('provvypay-assets');
    expect(body.accountIdRedacted).toBe('81ba…8841');
    expect(JSON.stringify(body)).not.toMatch(/secret/i);
    expect(mockLogInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'merchant-settings.r2-connectivity',
        bucket: 'provvypay-assets',
        s3SigningEndpointUsed: 'https://81ba3ac215bbde6352beec7e6ef28841.r2.cloudflarestorage.com',
      }),
      'R2 connectivity check: SUCCESS'
    );
  });

  it('returns classified failure diagnostics without exposing secrets', async () => {
    mockProbe.mockResolvedValue({
      success: false,
      provider: 'r2',
      operation: 'HeadBucket',
      bucket: 'provvypay-assets',
      accountIdRedacted: '81ba…8841',
      s3SigningEndpointUsed: 'https://81ba3ac215bbde6352beec7e6ef28841.r2.cloudflarestorage.com',
      configuredR2Endpoint: null,
      region: 'auto',
      failureClass: 'SignatureDoesNotMatch',
      error: {
        awsErrorCode: 'SignatureDoesNotMatch',
        httpStatus: 403,
        requestId: 'req-123',
        causeName: 'SignatureDoesNotMatch',
        causeMessage: 'The request signature we calculated does not match',
      },
    });

    const request = new NextRequest(
      'http://localhost/api/merchant-settings/r2-connectivity?organizationId=org-123'
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.failureClass).toBe('SignatureDoesNotMatch');
    expect(body.error.awsErrorCode).toBe('SignatureDoesNotMatch');
    expect(JSON.stringify(body)).not.toMatch(/R2_SECRET_ACCESS_KEY/);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        failureClass: 'SignatureDoesNotMatch',
        awsErrorCode: 'SignatureDoesNotMatch',
      }),
      'R2 connectivity check: FAILED'
    );
  });
});
