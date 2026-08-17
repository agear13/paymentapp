import type {
  organization_workflow_agreements,
  OrganizationWorkflowLifecycleStatus,
  WorkflowAgreementExtractionStatus,
  WorkflowAgreementSourceType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { extractAgreementFromText } from '@/lib/ai-extractor/extraction-service';
import { buildCommercialGraph } from '@/lib/ai-extractor/commercial-graph';
import type { CommercialGraphSnapshot } from '@/lib/ai-extractor/commercial-graph-types';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { ExtractionResponseError } from '@/lib/ai-extractor/parse-extraction-response';
import { extractDocumentText } from '@/lib/agreement-analyzer/extraction/document-parsers.server';
import { getAgreementUploadStorage } from '@/lib/agreement-analyzer/upload-storage';
import { UploadStorageError } from '@/lib/agreement-analyzer/upload-storage/types';
import {
  validateAgreementFile,
  type AgreementAllowedMime,
} from '@/lib/agreement-analyzer/validation';
import { prisma } from '@/lib/server/prisma';
import { getOrganizationWorkflowById } from '@/lib/workflows/organization-workflows.server';
import { parseAgreementIntelligenceConfiguration } from '@/lib/workflows/agreement-intelligence/configuration';
import { buildWorkflowAgreementHubSummary } from '@/lib/workflows/agreement-intelligence/hub-summary';
import type {
  ApprovedAgreementStructure,
  WorkflowAgreementRecord,
} from '@/lib/workflows/agreement-intelligence/types';
import { WorkflowAgreementError } from '@/lib/workflows/agreement-intelligence/types';
import type { ReviewFormState } from '@/lib/ai-extractor/review-form-types';

const AGREEMENT_INTELLIGENCE_SLUG = 'agreement-intelligence';
const MAX_PASTE_CHARS = 50_000;

function parseJsonField<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  return value as T;
}

function serializeAgreement(row: organization_workflow_agreements): WorkflowAgreementRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationWorkflowId: row.organization_workflow_id,
    sourceType: row.source_type,
    title: row.title,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    storageKey: row.storage_key,
    sourceText: row.source_text,
    extractionStatus: row.extraction_status,
    extractionResult: parseJsonField<ExtractionResult>(row.extraction_result),
    commercialGraph: parseJsonField<CommercialGraphSnapshot>(row.commercial_graph),
    approvedStructure: parseJsonField<ApprovedAgreementStructure>(row.approved_structure),
    extractionError: row.extraction_error,
    extractedAt: row.extracted_at?.toISOString() ?? null,
    approvedAt: row.approved_at?.toISOString() ?? null,
    approvedByUserId: row.approved_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function requireAgreementIntelligenceWorkflow(
  organizationId: string,
  workflowId: string
) {
  const workflow = await getOrganizationWorkflowById(organizationId, workflowId);
  if (workflow.templateSlug !== AGREEMENT_INTELLIGENCE_SLUG) {
    throw new WorkflowAgreementError(
      'This endpoint is only available for Agreement Intelligence workflows',
      'NOT_AGREEMENT_INTELLIGENCE',
      400
    );
  }
  return workflow;
}

async function getWorkflowRow(organizationId: string, workflowId: string) {
  const row = await prisma.organization_workflows.findFirst({
    where: { id: workflowId, organization_id: organizationId },
    include: { agreement: true },
  });
  if (!row) {
    throw new WorkflowAgreementError('Workflow not found', 'NOT_FOUND', 404);
  }
  if (row.template_slug !== AGREEMENT_INTELLIGENCE_SLUG) {
    throw new WorkflowAgreementError(
      'This endpoint is only available for Agreement Intelligence workflows',
      'NOT_AGREEMENT_INTELLIGENCE',
      400
    );
  }
  return row;
}

async function setWorkflowLifecycle(
  workflowId: string,
  lifecycleStatus: OrganizationWorkflowLifecycleStatus
) {
  await prisma.organization_workflows.update({
    where: { id: workflowId },
    data: { lifecycle_status: lifecycleStatus },
  });
}

function buildStorageKey(organizationId: string, workflowId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return `workflow-agreements/${organizationId}/${workflowId}/${randomUUID()}-${safeName}`;
}

export async function getWorkflowAgreementContext(
  organizationId: string,
  workflowId: string
) {
  const row = await getWorkflowRow(organizationId, workflowId);
  const agreement = row.agreement ? serializeAgreement(row.agreement) : null;
  const configuration = parseAgreementIntelligenceConfiguration(row.configuration);
  const hubSummary = buildWorkflowAgreementHubSummary({
    lifecycleStatus: row.lifecycle_status,
    configuration: row.configuration,
    agreement,
  });

  return {
    workflowId: row.id,
    lifecycleStatus: row.lifecycle_status,
    configuration,
    agreement,
    hubSummary,
  };
}

export async function updateWorkflowConfiguration(
  organizationId: string,
  workflowId: string,
  configuration: Record<string, unknown>
) {
  await requireAgreementIntelligenceWorkflow(organizationId, workflowId);
  const parsed = parseAgreementIntelligenceConfiguration(configuration);

  const row = await prisma.organization_workflows.update({
    where: { id: workflowId },
    data: { configuration: parsed },
    include: { agreement: true },
  });

  const agreement = row.agreement ? serializeAgreement(row.agreement) : null;
  return {
    workflowId: row.id,
    lifecycleStatus: row.lifecycle_status,
    configuration: parsed,
    agreement,
    hubSummary: buildWorkflowAgreementHubSummary({
      lifecycleStatus: row.lifecycle_status,
      configuration: row.configuration,
      agreement,
    }),
  };
}

async function upsertAgreementInput(input: {
  organizationId: string;
  workflowId: string;
  sourceType: WorkflowAgreementSourceType;
  title: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  storageKey?: string | null;
  sourceText: string;
}) {
  const existing = await prisma.organization_workflow_agreements.findUnique({
    where: { organization_workflow_id: input.workflowId },
  });

  if (existing?.extraction_status === 'APPROVED') {
    throw new WorkflowAgreementError(
      'Agreement structure is already approved. Upload a new agreement after resetting in a future phase.',
      'INVALID_STATE',
      409
    );
  }

  if (existing) {
    const row = await prisma.organization_workflow_agreements.update({
      where: { id: existing.id },
      data: {
        source_type: input.sourceType,
        title: input.title,
        original_filename: input.originalFilename ?? null,
        mime_type: input.mimeType ?? null,
        file_size_bytes: input.fileSizeBytes ?? null,
        storage_key: input.storageKey ?? null,
        source_text: input.sourceText,
        extraction_status: 'PENDING',
        extraction_result: null,
        commercial_graph: null,
        approved_structure: null,
        extraction_error: null,
        extracted_at: null,
        approved_at: null,
        approved_by_user_id: null,
      },
    });
    return serializeAgreement(row);
  }

  const row = await prisma.organization_workflow_agreements.create({
    data: {
      organization_id: input.organizationId,
      organization_workflow_id: input.workflowId,
      source_type: input.sourceType,
      title: input.title,
      original_filename: input.originalFilename ?? null,
      mime_type: input.mimeType ?? null,
      file_size_bytes: input.fileSizeBytes ?? null,
      storage_key: input.storageKey ?? null,
      source_text: input.sourceText,
      extraction_status: 'PENDING',
    },
  });
  return serializeAgreement(row);
}

export async function submitPastedAgreement(input: {
  organizationId: string;
  workflowId: string;
  text: string;
  title?: string | null;
}) {
  const row = await getWorkflowRow(input.organizationId, input.workflowId);
  if (row.lifecycle_status === 'APPROVED') {
    throw new WorkflowAgreementError('Workflow structure is already approved', 'INVALID_STATE', 409);
  }

  const text = input.text.trim();
  if (!text) {
    throw new WorkflowAgreementError('Agreement text is required', 'INVALID_INPUT', 400);
  }
  if (text.length > MAX_PASTE_CHARS) {
    throw new WorkflowAgreementError(
      `Agreement text is too long (max ${MAX_PASTE_CHARS.toLocaleString()} characters)`,
      'INVALID_INPUT',
      400
    );
  }

  const agreement = await upsertAgreementInput({
    organizationId: input.organizationId,
    workflowId: input.workflowId,
    sourceType: 'PASTE',
    title: input.title?.trim() || null,
    sourceText: text,
  });

  await setWorkflowLifecycle(input.workflowId, 'EXTRACTING');
  return runWorkflowAgreementExtraction(input.organizationId, input.workflowId, agreement.id);
}

export async function submitUploadedAgreement(input: {
  organizationId: string;
  workflowId: string;
  file: File;
}) {
  const row = await getWorkflowRow(input.organizationId, input.workflowId);
  if (row.lifecycle_status === 'APPROVED') {
    throw new WorkflowAgreementError('Workflow structure is already approved', 'INVALID_STATE', 409);
  }

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const validation = validateAgreementFile(bytes, input.file.name, input.file.type);
  if (!validation.ok) {
    throw new WorkflowAgreementError(validation.message, 'INVALID_INPUT', 400);
  }

  const storageKey = buildStorageKey(input.organizationId, input.workflowId, validation.sanitizedFilename);
  try {
    await getAgreementUploadStorage().upload({
      storageKey,
      bytes,
      mimeType: validation.mimeType,
      originalFilename: validation.sanitizedFilename,
    });
  } catch (error) {
    if (error instanceof UploadStorageError) {
      throw new WorkflowAgreementError(
        'Failed to store agreement document',
        'INVALID_INPUT',
        error.code === 'misconfigured' ? 503 : 500
      );
    }
    throw error;
  }

  let sourceText: string;
  try {
    const parsed = await extractDocumentText(bytes, validation.mimeType as AgreementAllowedMime);
    sourceText = parsed.text.trim();
  } catch (error) {
    await getAgreementUploadStorage().delete(storageKey).catch(() => undefined);
    throw new WorkflowAgreementError(
      error instanceof Error ? error.message : 'Could not read agreement document',
      'INVALID_INPUT',
      422
    );
  }

  if (!sourceText) {
    await getAgreementUploadStorage().delete(storageKey).catch(() => undefined);
    throw new WorkflowAgreementError('No readable text found in document', 'INVALID_INPUT', 422);
  }
  if (sourceText.length > MAX_PASTE_CHARS) {
    await getAgreementUploadStorage().delete(storageKey).catch(() => undefined);
    throw new WorkflowAgreementError(
      `Extracted text is too long (max ${MAX_PASTE_CHARS.toLocaleString()} characters)`,
      'INVALID_INPUT',
      400
    );
  }

  const agreement = await upsertAgreementInput({
    organizationId: input.organizationId,
    workflowId: input.workflowId,
    sourceType: 'PDF',
    title: validation.sanitizedFilename.replace(/\.[^.]+$/, ''),
    originalFilename: validation.sanitizedFilename,
    mimeType: validation.mimeType,
    fileSizeBytes: bytes.length,
    storageKey,
    sourceText,
  });

  await setWorkflowLifecycle(input.workflowId, 'EXTRACTING');
  return runWorkflowAgreementExtraction(input.organizationId, input.workflowId, agreement.id);
}

export async function runWorkflowAgreementExtraction(
  organizationId: string,
  workflowId: string,
  agreementId?: string,
  options?: { force?: boolean }
) {
  const row = await getWorkflowRow(organizationId, workflowId);
  const agreementRow =
    agreementId != null
      ? await prisma.organization_workflow_agreements.findFirst({
          where: { id: agreementId, organization_id: organizationId, organization_workflow_id: workflowId },
        })
      : row.agreement;

  if (!agreementRow) {
    throw new WorkflowAgreementError('No agreement has been provided yet', 'INVALID_STATE', 400);
  }

  if (agreementRow.extraction_status === 'APPROVED') {
    throw new WorkflowAgreementError('Agreement structure is already approved', 'INVALID_STATE', 409);
  }

  if (
    !options?.force &&
    agreementRow.extraction_status === 'READY_FOR_REVIEW' &&
    agreementRow.extraction_result
  ) {
    return getWorkflowAgreementContext(organizationId, workflowId);
  }

  if (
    !options?.force &&
    agreementRow.extraction_status === 'APPROVED'
  ) {
    return getWorkflowAgreementContext(organizationId, workflowId);
  }

  if (
    !options?.force &&
    row.lifecycle_status === 'READY_FOR_REVIEW' &&
    agreementRow.extraction_result
  ) {
    return getWorkflowAgreementContext(organizationId, workflowId);
  }

  if (
    !options?.force &&
    row.lifecycle_status === 'APPROVED' &&
    agreementRow.approved_structure
  ) {
    return getWorkflowAgreementContext(organizationId, workflowId);
  }

  if (
    !options?.force &&
    agreementRow.extraction_status === 'EXTRACTING' &&
    row.lifecycle_status === 'EXTRACTING'
  ) {
    return getWorkflowAgreementContext(organizationId, workflowId);
  }

  const sourceText = agreementRow.source_text?.trim();
  if (!sourceText) {
    throw new WorkflowAgreementError('Agreement text is missing', 'INVALID_STATE', 400);
  }

  await prisma.organization_workflow_agreements.update({
    where: { id: agreementRow.id },
    data: {
      extraction_status: 'EXTRACTING',
      extraction_error: null,
    },
  });
  await setWorkflowLifecycle(workflowId, 'EXTRACTING');

  try {
    const extractionResult = await extractAgreementFromText(sourceText);
    const commercialGraph = buildCommercialGraph(extractionResult);
    const enrichedResult: ExtractionResult = {
      ...extractionResult,
      commercialGraph,
    };

    await prisma.organization_workflow_agreements.update({
      where: { id: agreementRow.id },
      data: {
        extraction_status: 'READY_FOR_REVIEW' satisfies WorkflowAgreementExtractionStatus,
        extraction_result: enrichedResult,
        commercial_graph: commercialGraph,
        extraction_error: null,
        extracted_at: new Date(),
        title:
          agreementRow.title ??
          extractionResult.projectName.value?.trim() ??
          agreementRow.original_filename,
      },
    });
    await setWorkflowLifecycle(workflowId, 'READY_FOR_REVIEW');

    return getWorkflowAgreementContext(organizationId, workflowId);
  } catch (error) {
    const message =
      error instanceof ExtractionResponseError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Extraction failed';

    await prisma.organization_workflow_agreements.update({
      where: { id: agreementRow.id },
      data: {
        extraction_status: 'FAILED',
        extraction_error: message,
      },
    });
    await setWorkflowLifecycle(workflowId, 'EXTRACTION_FAILED');

    throw new WorkflowAgreementError(message, 'EXTRACTION_FAILED', 422);
  }
}

export async function approveWorkflowAgreementStructure(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  reviewForm: ReviewFormState;
  extractionResult: ExtractionResult;
}) {
  const row = await getWorkflowRow(input.organizationId, input.workflowId);
  if (row.lifecycle_status !== 'READY_FOR_REVIEW') {
    throw new WorkflowAgreementError(
      'Agreement structure can only be approved after extraction review',
      'INVALID_STATE',
      409
    );
  }
  if (!row.agreement) {
    throw new WorkflowAgreementError('No agreement found for this workflow', 'NOT_FOUND', 404);
  }
  if (row.agreement.extraction_status !== 'READY_FOR_REVIEW') {
    throw new WorkflowAgreementError(
      'Agreement extraction is not ready for approval',
      'INVALID_STATE',
      409
    );
  }

  const commercialGraph =
    input.extractionResult.commercialGraph ??
    buildCommercialGraph(input.extractionResult);

  const approvedStructure: ApprovedAgreementStructure = {
    reviewForm: input.reviewForm,
    extractionResult: {
      ...input.extractionResult,
      commercialGraph,
    },
    commercialGraph,
    approvedAt: new Date().toISOString(),
    approvedByUserId: input.userId,
  };

  await prisma.organization_workflow_agreements.update({
    where: { id: row.agreement.id },
    data: {
      extraction_status: 'APPROVED',
      approved_structure: approvedStructure,
      approved_at: new Date(),
      approved_by_user_id: input.userId,
      commercial_graph: commercialGraph,
      extraction_result: approvedStructure.extractionResult,
    },
  });
  await setWorkflowLifecycle(input.workflowId, 'APPROVED');

  return getWorkflowAgreementContext(input.organizationId, input.workflowId);
}
