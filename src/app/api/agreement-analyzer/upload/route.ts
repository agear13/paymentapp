/**
 * POST /api/agreement-analyzer/upload
 * Public lead-generation funnel — stores agreement file and creates DB records.
 */

import { NextRequest, NextResponse } from 'next/server';

import { parseAttributionPayload } from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution';
import { createAgreementProcessingJob } from '@/lib/agreement-analyzer/jobs/create-job.server';
import { submitAgreementUpload } from '@/lib/agreement-analyzer/submit-agreement.server';
import {
  AGREEMENT_BUSINESS_TYPES,
  normalizeAgreementEmail,
  validateAgreementFile,
} from '@/lib/agreement-analyzer/validation';
import { UploadStorageError } from '@/lib/agreement-analyzer/upload-storage/types';
import { loggers } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapUploadError(error: unknown): { status: number; message: string } {
  if (error instanceof UploadStorageError) {
    switch (error.code) {
      case 'misconfigured':
        return {
          status: 503,
          message: 'Upload storage is temporarily unavailable. Please try again later.',
        };
      default:
        return { status: 500, message: 'Failed to store your agreement. Please try again.' };
    }
  }
  return { status: 500, message: 'Something went wrong. Please try again.' };
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'public');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    const firstName = parseOptionalString(formData.get('firstName'));
    const lastName = parseOptionalString(formData.get('lastName'));
    const email = parseOptionalString(formData.get('email'));
    const companyName = parseOptionalString(formData.get('companyName'));
    const businessType = parseOptionalString(formData.get('businessType'));
    const attribution = parseAttributionPayload(formData.get('attribution'));

    if (!firstName) {
      return NextResponse.json({ error: 'First name is required.' }, { status: 400 });
    }
    if (!lastName) {
      return NextResponse.json({ error: 'Last name is required.' }, { status: 400 });
    }
    if (!email || !EMAIL_PATTERN.test(normalizeAgreementEmail(email))) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }
    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required.' }, { status: 400 });
    }
    if (!businessType) {
      return NextResponse.json({ error: 'Business type is required.' }, { status: 400 });
    }
    if (
      businessType &&
      !(AGREEMENT_BUSINESS_TYPES as readonly string[]).includes(businessType)
    ) {
      return NextResponse.json({ error: 'Please select a valid business type.' }, { status: 400 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'An agreement file is required.' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const validation = validateAgreementFile(bytes, file.name, file.type || '');
    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    const result = await submitAgreementUpload({
      firstName,
      lastName,
      email,
      companyName,
      businessType,
      attribution,
      bytes,
      mimeType: validation.mimeType,
      sanitizedFilename: validation.sanitizedFilename,
    });

    loggers.api.info('Agreement analyzer upload captured', {
      leadId: result.leadId,
      uploadId: result.uploadId,
      reportId: result.reportId,
      mimeType: validation.mimeType,
      sizeBytes: bytes.length,
    });

    const job = await createAgreementProcessingJob({
      uploadId: result.uploadId,
      reportId: result.reportId,
    });

    return NextResponse.json({
      success: true,
      uploadId: result.uploadId,
      reportId: result.reportId,
      reportAccessToken: result.reportAccessToken,
      reportUrl: `/agreement-analyzer/report/${result.reportAccessToken}`,
      jobId: job.jobId,
    });
  } catch (error: unknown) {
    const mapped = mapUploadError(error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    loggers.api.error('agreement-analyzer upload failed', error, { message });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
