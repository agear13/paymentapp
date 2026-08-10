import { NextRequest } from 'next/server';

import {
  buildSafeLogoUploadStorageErrorDiagnostics,
  POST,
} from '@/app/api/merchant-settings/upload-logo/route';
import { StorageServiceError } from '@/lib/storage/types';

const mockLogError = jest.fn();

jest.mock('@/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: (...args: unknown[]) => mockLogError(...args),
  },
}));

jest.mock('@/lib/auth/api-session.server', () => ({
  getCurrentUserForApi: jest.fn(),
}));

jest.mock('@/lib/auth/organization-access', () => ({
  hasOrganizationPermission: jest.fn(),
}));

jest.mock('@/lib/storage/storage-service', () => ({
  uploadAsset: jest.fn(),
  getPublicAssetUrl: jest.fn(),
}));

jest.mock('@/lib/runtime/customer-facing-url', () => ({
  resolveRequestOrigin: jest.fn().mockReturnValue('https://app.example.com'),
}));

import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { uploadAsset } from '@/lib/storage/storage-service';

const mockGetCurrentUserForApi = getCurrentUserForApi as jest.Mock;
const mockHasOrganizationPermission = hasOrganizationPermission as jest.Mock;
const mockUploadAsset = uploadAsset as jest.Mock;

describe('upload-logo storage error diagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUserForApi.mockResolvedValue({
      user: { id: 'user-1' },
      response: null,
    });
    mockHasOrganizationPermission.mockResolvedValue(true);
  });

  it('extracts AWS/R2 cause fields without exposing credentials', () => {
    const awsCause = Object.assign(new Error('Access Denied'), {
      name: 'AccessDenied',
      Code: 'AccessDenied',
      $metadata: {
        httpStatusCode: 403,
        requestId: 'r2-req-abc123',
      },
    });

    const storageError = new StorageServiceError('upload_failed', 'R2 upload failed', {
      cause: awsCause,
    });

    const diagnostics = buildSafeLogoUploadStorageErrorDiagnostics(storageError);

    expect(diagnostics).toEqual({
      storageErrorCode: 'upload_failed',
      errorName: 'StorageServiceError',
      errorMessage: 'R2 upload failed',
      awsErrorCode: 'AccessDenied',
      httpStatus: 403,
      requestId: 'r2-req-abc123',
      causeName: 'AccessDenied',
      causeMessage: 'Access Denied',
    });
    expect(JSON.stringify(diagnostics)).not.toMatch(/secret/i);
    expect(JSON.stringify(diagnostics)).not.toMatch(/AKIA/);
  });

  it('redacts sensitive substrings from diagnostic messages', () => {
    const awsCause = Object.assign(new Error('Authorization: Bearer super-secret-token'), {
      name: 'InvalidAccessKeyId',
      $metadata: {
        httpStatusCode: 403,
        requestId: 'req-sensitive',
      },
    });

    const diagnostics = buildSafeLogoUploadStorageErrorDiagnostics(
      new StorageServiceError('upload_failed', 'R2 upload failed', { cause: awsCause })
    );

    expect(diagnostics.causeMessage).toBe('Authorization: [redacted]');
    expect(diagnostics.causeMessage).not.toContain('super-secret-token');
  });

  it('logs safe storage diagnostics and keeps the client response unchanged', async () => {
    const awsCause = Object.assign(new Error('The specified bucket does not exist.'), {
      name: 'NoSuchBucket',
      Code: 'NoSuchBucket',
      $metadata: {
        httpStatusCode: 404,
        requestId: 'r2-req-missing-bucket',
      },
    });

    mockUploadAsset.mockRejectedValue(
      new StorageServiceError('upload_failed', 'R2 upload failed', { cause: awsCause })
    );

    const formData = new FormData();
    formData.append('logo', new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' }));
    formData.append('organizationId', 'org-123');

    const request = new NextRequest('http://localhost/api/merchant-settings/upload-logo', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to upload logo. Please try again.' });
    expect(body.awsErrorCode).toBeUndefined();
    expect(body.requestId).toBeUndefined();
    expect(body.causeMessage).toBeUndefined();

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'merchant-settings.upload-logo.storage_failure',
        storageErrorCode: 'upload_failed',
        awsErrorCode: 'NoSuchBucket',
        httpStatus: 404,
        requestId: 'r2-req-missing-bucket',
        causeName: 'NoSuchBucket',
        causeMessage: 'The specified bucket does not exist.',
      }),
      'Failed to upload logo'
    );

    const loggedPayload = mockLogError.mock.calls[0][0] as Record<string, unknown>;
    expect(loggedPayload).not.toHaveProperty('organizationId');
    expect(loggedPayload).not.toHaveProperty('authorization');
    expect(JSON.stringify(loggedPayload)).not.toMatch(/secret/i);
  });
});
