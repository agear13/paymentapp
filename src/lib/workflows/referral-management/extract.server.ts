import 'server-only';

import { extractAgreementFromText } from '@/lib/ai-extractor/extraction-service';
import { ExtractionResponseError } from '@/lib/ai-extractor/parse-extraction-response';
import { extractDocumentText } from '@/lib/agreement-analyzer/extraction/document-parsers.server';
import {
  validateAgreementFile,
  type AgreementAllowedMime,
} from '@/lib/agreement-analyzer/validation';
import { prisma } from '@/lib/server/prisma';
import { mapExtractionToReferralPreview } from '@/lib/workflows/referral-management/import-from-extraction';
import { ReferralManagementError } from '@/lib/workflows/referral-management/promoter.server';
import { REFERRAL_MANAGEMENT_SLUG } from '@/lib/workflows/referral-management/constants';

const MAX_PASTE_CHARS = 50_000;

async function requireReferralManagementForExtract(input: {
  organizationId: string;
  workflowId: string;
}) {
  const row = await prisma.organization_workflows.findFirst({
    where: { id: input.workflowId, organization_id: input.organizationId },
  });
  if (!row) {
    throw new ReferralManagementError('Workflow not found', 'NOT_FOUND', 404);
  }
  if (row.template_slug !== REFERRAL_MANAGEMENT_SLUG) {
    throw new ReferralManagementError(
      'This endpoint is only available for Referral Management workflows',
      'INVALID_TEMPLATE',
      400
    );
  }
  if (row.status === 'PAUSED') {
    throw new ReferralManagementError(
      'Workflow is paused. Resume before importing a referral relationship.',
      'INVALID_STATE',
      409
    );
  }
}

async function catalogForOrganization(organizationId: string) {
  return prisma.organization_services.findMany({
    where: { organization_id: organizationId, active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

async function previewFromText(input: {
  organizationId: string;
  sourceText: string;
  sourceLabel: string;
}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ReferralManagementError(
      'Extraction service not configured',
      'NOT_CONFIGURED',
      503
    );
  }
  const text = input.sourceText.trim();
  if (!text) {
    throw new ReferralManagementError('Paste agreement or conversation text to continue.', 'INVALID_INPUT', 400);
  }
  if (text.length > MAX_PASTE_CHARS) {
    throw new ReferralManagementError(
      'Text is too long (max 50,000 characters)',
      'INVALID_INPUT',
      400
    );
  }

  try {
    const extraction = await extractAgreementFromText(text);
    const catalog = await catalogForOrganization(input.organizationId);
    return mapExtractionToReferralPreview({
      extraction,
      catalog,
      sourceLabel: input.sourceLabel,
    });
  } catch (error) {
    if (error instanceof ExtractionResponseError) {
      throw new ReferralManagementError(error.message, 'EXTRACTION_FAILED', 422);
    }
    throw error;
  }
}

export async function extractReferralRelationshipsFromText(input: {
  organizationId: string;
  workflowId: string;
  text: string;
  sourceLabel?: string;
}) {
  await requireReferralManagementForExtract(input);
  return previewFromText({
    organizationId: input.organizationId,
    sourceText: input.text,
    sourceLabel: input.sourceLabel?.trim() || 'Pasted agreement or conversation',
  });
}

export async function extractReferralRelationshipsFromFile(input: {
  organizationId: string;
  workflowId: string;
  file: File;
}) {
  await requireReferralManagementForExtract(input);

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const validation = validateAgreementFile(bytes, input.file.name, input.file.type);
  if (!validation.ok) {
    throw new ReferralManagementError(validation.message, 'INVALID_INPUT', 400);
  }

  let sourceText: string;
  try {
    const parsed = await extractDocumentText(bytes, validation.mimeType as AgreementAllowedMime);
    sourceText = parsed.text.trim();
  } catch (error) {
    throw new ReferralManagementError(
      error instanceof Error ? error.message : 'Could not read this document.',
      'INVALID_INPUT',
      400
    );
  }

  if (!sourceText) {
    throw new ReferralManagementError(
      'No readable text was found in this document.',
      'INVALID_INPUT',
      400
    );
  }

  return previewFromText({
    organizationId: input.organizationId,
    sourceText,
    sourceLabel: `Uploaded ${input.file.name || 'agreement'}`,
  });
}
