import 'server-only';

import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

import { getAgreementUploadStorage } from '@/lib/agreement-analyzer/upload-storage';
import { generateReportAccessToken } from '@/lib/agreement-analyzer/report-token.server';
import {
  extensionForAgreementMime,
  normalizeAgreementEmail,
  type AgreementAllowedMime,
} from '@/lib/agreement-analyzer/validation';
import { buildLeadAttributionCreateData } from '@/lib/agreement-analyzer/attribution/lead-attribution.server';
import type { AgreementAnalyzerAttributionInput } from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution-types';
import { prisma } from '@/lib/server/prisma';

export type SubmitAgreementLeadInput = {
  firstName: string;
  lastName: string;
  email: string;
  companyName?: string | null;
  businessType?: string | null;
  source?: string | null;
  attribution?: AgreementAnalyzerAttributionInput | null;
};

export type SubmitAgreementUploadInput = SubmitAgreementLeadInput & {
  bytes: Buffer;
  mimeType: AgreementAllowedMime;
  sanitizedFilename: string;
};

export type SubmitAgreementResult = {
  uploadId: string;
  reportId: string;
  reportAccessToken: string;
  leadId: string;
};

function buildAgreementStorageKey(extension: string, now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const id = randomUUID();
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return `agreements/${year}/${month}/${id}${ext}`;
}

async function createReportWithUniqueToken(tx: Prisma.TransactionClient, uploadId: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await tx.agreement_obligation_reports.create({
        data: {
          upload_id: uploadId,
          status: 'PENDING',
          report_access_token: generateReportAccessToken(),
        } as Prisma.agreement_obligation_reportsUncheckedCreateInput,
        select: { id: true, report_access_token: true },
      });
    } catch (error) {
      const isUniqueViolation =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002';
      if (!isUniqueViolation || attempt === 4) throw error;
    }
  }
  throw new Error('Failed to allocate a unique report access token');
}

export async function submitAgreementUpload(
  input: SubmitAgreementUploadInput
): Promise<SubmitAgreementResult> {
  const normalizedEmail = normalizeAgreementEmail(input.email);
  const extension = extensionForAgreementMime(input.mimeType);
  const storageKey = buildAgreementStorageKey(extension);
  const storage = getAgreementUploadStorage();

  await storage.upload({
    storageKey,
    bytes: input.bytes,
    mimeType: input.mimeType,
    originalFilename: input.sanitizedFilename,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const existingLead = await tx.obligation_report_leads.findFirst({
        where: { email: normalizedEmail },
        orderBy: { created_at: 'desc' },
      });

      const lead =
        existingLead ??
        (await tx.obligation_report_leads.create({
          data: {
            first_name: input.firstName.trim(),
            last_name: input.lastName.trim(),
            email: normalizedEmail,
            company_name: input.companyName?.trim() || null,
            business_type: input.businessType?.trim() || null,
            source: input.source?.trim() || 'agreement-analyzer',
            lifecycle_stage: 'NEW',
            ...buildLeadAttributionCreateData(input.attribution),
          },
        }));

      if (existingLead) {
        await tx.obligation_report_leads.update({
          where: { id: existingLead.id },
          data: {
            first_name: input.firstName.trim(),
            last_name: input.lastName.trim(),
            company_name: input.companyName?.trim() || null,
            business_type: input.businessType?.trim() || null,
            updated_at: new Date(),
          },
        });
      }

      const now = new Date();
      const upload = await tx.agreement_uploads.create({
        data: {
          lead_id: lead.id,
          original_filename: input.sanitizedFilename,
          mime_type: input.mimeType,
          file_size_bytes: input.bytes.length,
          storage_key: storageKey,
          storage_url: null,
          upload_status: 'UPLOADED',
          uploaded_at: now,
        },
        select: { id: true },
      });

      const report = await createReportWithUniqueToken(tx, upload.id);

      if (!report.report_access_token) {
        throw new Error('Report access token was not generated.');
      }

      return {
        leadId: lead.id,
        uploadId: upload.id,
        reportId: report.id,
        reportAccessToken: report.report_access_token,
      };
    });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
}
