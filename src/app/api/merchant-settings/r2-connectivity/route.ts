/**
 * Temporary R2 connectivity diagnostic — same S3Client config as logo upload.
 * GET /api/merchant-settings/r2-connectivity?organizationId=...
 *
 * Performs HeadBucket only. Does not upload, delete, or modify objects.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { apiError } from '@/lib/api/middleware';
import { log } from '@/lib/logger';
import { probeR2BucketConnectivity } from '@/lib/storage/r2-connectivity-diagnostics.server';

export async function GET(request: NextRequest) {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response!;

  const organizationId = request.nextUrl.searchParams.get('organizationId');
  if (!organizationId) {
    return apiError('Organization ID is required', 400);
  }

  const canManageSettings = await hasOrganizationPermission(
    auth.user.id,
    organizationId,
    'manage_settings'
  );
  if (!canManageSettings) {
    return apiError('Forbidden - insufficient organization permissions', 403);
  }

  const result = await probeR2BucketConnectivity();

  const logPayload = {
    context: 'merchant-settings.r2-connectivity',
    userId: auth.user.id,
    organizationId,
    provider: result.provider,
    operation: result.operation,
    bucket: result.bucket,
    accountIdRedacted: result.accountIdRedacted,
    s3SigningEndpointUsed: result.s3SigningEndpointUsed,
    configuredR2Endpoint: result.configuredR2Endpoint,
    region: result.region,
    failureClass: result.failureClass,
    ...(result.error ?? {}),
  };

  if (result.success) {
    log.info(logPayload, 'R2 connectivity check: SUCCESS');
    return NextResponse.json({
      success: true,
      message: 'R2 connectivity check: SUCCESS',
      provider: result.provider,
      operation: result.operation,
      bucket: result.bucket,
      accountIdRedacted: result.accountIdRedacted,
      s3SigningEndpointUsed: result.s3SigningEndpointUsed,
      configuredR2Endpoint: result.configuredR2Endpoint,
      region: result.region,
    });
  }

  log.error(logPayload, 'R2 connectivity check: FAILED');

  return NextResponse.json(
    {
      success: false,
      message: 'R2 connectivity check: FAILED',
      provider: result.provider,
      operation: result.operation,
      bucket: result.bucket,
      accountIdRedacted: result.accountIdRedacted,
      s3SigningEndpointUsed: result.s3SigningEndpointUsed,
      configuredR2Endpoint: result.configuredR2Endpoint,
      region: result.region,
      failureClass: result.failureClass,
      error: result.error,
    },
    { status: 503 }
  );
}
