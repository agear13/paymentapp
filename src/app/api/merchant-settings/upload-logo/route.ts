/**
 * Logo Upload API Endpoint
 * POST /api/merchant-settings/upload-logo
 * Uploads organization logos to persistent object storage (R2 in production).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { apiError } from '@/lib/api/middleware';
import { log } from '@/lib/logger';
import { uploadAsset, getPublicAssetUrl } from '@/lib/storage/storage-service';
import { StorageServiceError } from '@/lib/storage/types';
import { resolveRequestOrigin } from '@/lib/runtime/customer-facing-url';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024;

function isAllowedLogoFile(file: File): { valid: boolean; extension: string | null } {
  const mimeType = (file.type || '').toLowerCase();
  const extension = (file.name || '').toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';

  if (ALLOWED_TYPES.includes(mimeType)) {
    return {
      valid: true,
      extension: ALLOWED_EXTENSIONS.includes(extension) ? extension : null,
    };
  }

  if (ALLOWED_EXTENSIONS.includes(extension)) {
    return { valid: true, extension };
  }

  return { valid: false, extension: null };
}

export type SafeLogoUploadStorageErrorDiagnostics = {
  storageErrorCode?: string;
  errorName?: string;
  errorMessage?: string;
  awsErrorCode?: string;
  httpStatus?: number;
  requestId?: string;
  causeName?: string;
  causeMessage?: string;
};

const DIAGNOSTIC_MESSAGE_MAX_LENGTH = 500;

function redactDiagnosticString(value: string): string {
  let redacted = value
    .replace(/authorization\s*:\s*[^\s,;]+(?:\s+[^\s,;]+)*/gi, 'Authorization: [redacted]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [redacted]')
    .replace(/AWS4-HMAC-SHA256\s+Credential=[^,\s]+/gi, 'AWS4-HMAC-SHA256 Credential=[redacted]')
    .replace(/\b(AKIA[0-9A-Z]{16})\b/g, '[redacted-access-key]')
    .replace(/\b(secret[_-]?access[_-]?key\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/\b(R2_SECRET_ACCESS_KEY\s*[:=]\s*)\S+/gi, '$1[redacted]');

  if (redacted.length > DIAGNOSTIC_MESSAGE_MAX_LENGTH) {
    redacted = `${redacted.slice(0, DIAGNOSTIC_MESSAGE_MAX_LENGTH)}…`;
  }

  return redacted;
}

function readAwsLikeErrorFields(error: unknown): {
  errorName?: string;
  errorMessage?: string;
  awsErrorCode?: string;
  httpStatus?: number;
  requestId?: string;
} {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const record = error as Record<string, unknown>;
  const metadata =
    record.$metadata && typeof record.$metadata === 'object'
      ? (record.$metadata as Record<string, unknown>)
      : undefined;

  const errorName = typeof record.name === 'string' ? redactDiagnosticString(record.name) : undefined;
  const errorMessage =
    typeof record.message === 'string' ? redactDiagnosticString(record.message) : undefined;

  const awsErrorCode =
    typeof record.Code === 'string'
      ? redactDiagnosticString(record.Code)
      : errorName && errorName !== 'StorageServiceError' && errorName !== 'Error'
        ? errorName
        : undefined;

  const httpStatus =
    typeof metadata?.httpStatusCode === 'number' ? metadata.httpStatusCode : undefined;
  const requestId =
    typeof metadata?.requestId === 'string' ? redactDiagnosticString(metadata.requestId) : undefined;

  return {
    errorName,
    errorMessage,
    awsErrorCode,
    httpStatus,
    requestId,
  };
}

/** @internal Exported for focused diagnostics tests — do not expose to clients. */
export function buildSafeLogoUploadStorageErrorDiagnostics(
  error: unknown
): SafeLogoUploadStorageErrorDiagnostics {
  if (error instanceof StorageServiceError) {
    const causeFields = error.cause ? readAwsLikeErrorFields(error.cause) : {};

    return {
      storageErrorCode: error.code,
      errorName: error.name,
      errorMessage: redactDiagnosticString(error.message),
      awsErrorCode: causeFields.awsErrorCode,
      httpStatus: causeFields.httpStatus,
      requestId: causeFields.requestId,
      causeName: causeFields.errorName,
      causeMessage: causeFields.errorMessage,
    };
  }

  const fields = readAwsLikeErrorFields(error);
  return {
    errorName: fields.errorName,
    errorMessage: fields.errorMessage,
    awsErrorCode: fields.awsErrorCode,
    httpStatus: fields.httpStatus,
    requestId: fields.requestId,
  };
}

function mapStorageError(error: unknown): { status: number; message: string } {
  if (error instanceof StorageServiceError) {
    switch (error.code) {
      case 'invalid_mime':
      case 'invalid_extension':
        return { status: 400, message: error.message };
      case 'oversized':
        return { status: 400, message: 'File too large. Maximum size is 2MB' };
      case 'misconfigured':
        return {
          status: 503,
          message:
            'Logo storage is temporarily unavailable. Contact support or try again later.',
        };
      default:
        return { status: 500, message: 'Failed to upload logo. Please try again.' };
    }
  }
  return { status: 500, message: 'Failed to upload logo' };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getCurrentUserForApi(request);
    if (!auth.user) return auth.response!;
    const user = auth.user;

    const formData = await request.formData();
    const file = formData.get('logo') as File;
    const organizationId = formData.get('organizationId') as string;

    log.info(
      {
        hasFile: !!file,
        organizationId,
        userId: user.id,
      },
      'Logo upload request received'
    );

    if (!file) {
      return apiError('No file provided', 400);
    }

    if (!organizationId) {
      log.error({ userId: user.id }, 'Organization ID missing in upload request');
      return apiError('Organization ID is required', 400);
    }

    const canManageSettings = await hasOrganizationPermission(
      user.id,
      organizationId,
      'manage_settings'
    );
    if (!canManageSettings) {
      return apiError('Forbidden - insufficient organization permissions', 403);
    }

    const fileValidation = isAllowedLogoFile(file);
    if (!fileValidation.valid) {
      return apiError('Invalid file type. Allowed types: PNG, JPG, JPEG, WEBP', 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError('File too large. Maximum size is 2MB', 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const requestOrigin = resolveRequestOrigin(request);

    const uploaded = await uploadAsset({
      category: 'merchant-logos',
      organizationId,
      bytes,
      mimeType: file.type || 'image/png',
      originalFilename: file.name,
      visibility: 'public',
      context: 'merchant-settings.upload-logo',
    });

    const publicUrl =
      uploaded.publicUrl ??
      getPublicAssetUrl(uploaded.storageKey, 'merchant-logos', { requestOrigin });

    if (!publicUrl) {
      throw new StorageServiceError(
        'upload_failed',
        'Logo uploaded but public URL could not be resolved. Check R2_PUBLIC_URL configuration.'
      );
    }

    log.info(
      {
        userId: user.id,
        organizationId,
        storageKey: uploaded.storageKey,
        bucket: uploaded.bucket,
        provider: uploaded.provider,
        fileSize: file.size,
        fileType: file.type,
        requestOrigin,
      },
      'Logo uploaded successfully'
    );

    return NextResponse.json({
      success: true,
      url: publicUrl,
      storageKey: uploaded.storageKey,
      bucket: uploaded.bucket,
      filename: file.name,
    });
  } catch (error: unknown) {
    const mapped = mapStorageError(error);
    log.error(
      {
        context: 'merchant-settings.upload-logo.storage_failure',
        ...buildSafeLogoUploadStorageErrorDiagnostics(error),
      },
      'Failed to upload logo'
    );
    return apiError(mapped.message, mapped.status);
  }
}
