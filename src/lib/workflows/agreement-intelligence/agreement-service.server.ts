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
import {
  bootstrapAgreementIntelligenceCommercialGraph,
  agreementIntelligencePilotDealId,
} from '@/lib/workflows/agreement-intelligence/bootstrap-agreement-intelligence.server';
import { buildWorkflowOperationalHubSummary } from '@/lib/workflows/agreement-intelligence/operational-hub-summary.server';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  filterCompensatedParticipants,
  isParticipantSetupComplete,
  resolvePostBootstrapLifecycle,
} from '@/lib/workflows/agreement-intelligence/participant-setup.server';
import { isWorkflowLockedForInput } from '@/lib/workflows/agreement-intelligence/lifecycle';
import type {
  ApprovedAgreementStructure,
  WorkflowAgreementRecord,
  WorkflowOperationalHubSummary,
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
    pilotDealId: row.pilot_deal_id,
    bootstrapError: row.bootstrap_error,
    bootstrappedAt: row.bootstrapped_at?.toISOString() ?? null,
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

async function finalizeWorkflowActivation(input: {
  workflowId: string;
  agreementId: string;
  userId: string;
  pilotDealId: string;
  operatorApprovalRequired: boolean;
}): Promise<OrganizationWorkflowLifecycleStatus> {
  const snapshot = await getPilotSnapshotForUser(input.userId);
  const compensatedParticipants = filterCompensatedParticipants(
    snapshot.participants.filter((participant) => participant.dealId === input.pilotDealId)
  );
  const lifecycleStatus = resolvePostBootstrapLifecycle({
    compensatedParticipants,
    operatorApprovalRequired: input.operatorApprovalRequired,
  });

  await prisma.organization_workflow_agreements.update({
    where: { id: input.agreementId },
    data: {
      bootstrapped_at: new Date(),
      bootstrap_error: null,
    },
  });
  await setWorkflowLifecycle(input.workflowId, lifecycleStatus);
  return lifecycleStatus;
}

async function maybeAdvanceParticipantSetupToActive(input: {
  workflowId: string;
  userId: string;
  lifecycleStatus: OrganizationWorkflowLifecycleStatus;
  pilotDealId: string | null;
  operatorApprovalRequired: boolean;
}): Promise<OrganizationWorkflowLifecycleStatus> {
  if (input.lifecycleStatus !== 'PARTICIPANT_SETUP' || !input.pilotDealId) {
    return input.lifecycleStatus;
  }

  const snapshot = await getPilotSnapshotForUser(input.userId);
  const compensatedParticipants = filterCompensatedParticipants(
    snapshot.participants.filter((participant) => participant.dealId === input.pilotDealId)
  );

  if (
    !isParticipantSetupComplete({
      compensatedParticipants,
      operatorApprovalRequired: input.operatorApprovalRequired,
    })
  ) {
    return 'PARTICIPANT_SETUP';
  }

  await setWorkflowLifecycle(input.workflowId, 'ACTIVE');
  return 'ACTIVE';
}

function buildStorageKey(organizationId: string, workflowId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return `workflow-agreements/${organizationId}/${workflowId}/${randomUUID()}-${safeName}`;
}

async function buildAgreementContextResponse(
  organizationId: string,
  workflowId: string,
  userId?: string
) {
  const row = await getWorkflowRow(organizationId, workflowId);
  const configuration = parseAgreementIntelligenceConfiguration(row.configuration);
  let lifecycleStatus = row.lifecycle_status;
  const agreementRecord = row.agreement;

  if (userId && lifecycleStatus === 'PARTICIPANT_SETUP' && agreementRecord?.pilot_deal_id) {
    lifecycleStatus = await maybeAdvanceParticipantSetupToActive({
      workflowId,
      userId,
      lifecycleStatus,
      pilotDealId: agreementRecord.pilot_deal_id,
      operatorApprovalRequired: configuration.operatorApprovalRequired,
    });
  }

  const agreement = agreementRecord ? serializeAgreement(agreementRecord) : null;
  const hubSummary = buildWorkflowAgreementHubSummary({
    lifecycleStatus,
    configuration: row.configuration,
    agreement,
  });

  let operationalSummary: WorkflowOperationalHubSummary | null = null;
  if (userId) {
    const approvedStructure = agreement?.approvedStructure ?? null;
    operationalSummary = await buildWorkflowOperationalHubSummary({
      userId,
      lifecycleStatus,
      pilotDealId: agreement?.pilotDealId ?? null,
      agreementTitle: agreement?.title ?? agreement?.extractionResult?.projectName.value ?? null,
      extractionSettlement: hubSummary.settlementSchedule,
      operatorApprovalRequired: configuration.operatorApprovalRequired,
      reviewForm: approvedStructure?.reviewForm ?? null,
      commercialGraph:
        approvedStructure?.commercialGraph ?? agreement?.commercialGraph ?? null,
      agreementMeta: agreement
        ? {
            createdAt: agreement.createdAt,
            extractedAt: agreement.extractedAt,
            approvedAt: agreement.approvedAt,
            bootstrappedAt: agreement.bootstrappedAt,
            sourceType: agreement.sourceType,
          }
        : null,
      workflowDeploymentStatus: row.status === 'PAUSED' ? 'PAUSED' : 'DEPLOYED',
      organizationId,
    });
  }

  return {
    workflowId: row.id,
    lifecycleStatus,
    configuration,
    agreement,
    hubSummary,
    operationalSummary,
  };
}

export async function getWorkflowAgreementContext(
  organizationId: string,
  workflowId: string,
  userId?: string
) {
  return buildAgreementContextResponse(organizationId, workflowId, userId);
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

  const workflow = await prisma.organization_workflows.findUnique({
    where: { id: input.workflowId },
    select: { lifecycle_status: true },
  });
  if (workflow && isWorkflowLockedForInput(workflow.lifecycle_status)) {
    throw new WorkflowAgreementError(
      'Agreement cannot be replaced while the workflow is active or activating.',
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
        pilot_deal_id: null,
        bootstrap_error: null,
        bootstrapped_at: null,
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
  if (isWorkflowLockedForInput(row.lifecycle_status)) {
    throw new WorkflowAgreementError('Workflow structure is already approved or active', 'INVALID_STATE', 409);
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
  if (isWorkflowLockedForInput(row.lifecycle_status)) {
    throw new WorkflowAgreementError('Workflow structure is already approved or active', 'INVALID_STATE', 409);
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
    (row.lifecycle_status === 'ACTIVE' ||
      row.lifecycle_status === 'BOOTSTRAPPING' ||
      row.lifecycle_status === 'BOOTSTRAP_FAILED') &&
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

  const pilotDealId =
    row.agreement.pilot_deal_id?.trim() ||
    agreementIntelligencePilotDealId(input.workflowId);

  await prisma.organization_workflow_agreements.update({
    where: { id: row.agreement.id },
    data: {
      extraction_status: 'APPROVED',
      approved_structure: approvedStructure,
      approved_at: new Date(),
      approved_by_user_id: input.userId,
      commercial_graph: commercialGraph,
      extraction_result: approvedStructure.extractionResult,
      pilot_deal_id: pilotDealId,
      bootstrap_error: null,
    },
  });
  await setWorkflowLifecycle(input.workflowId, 'BOOTSTRAPPING');

  try {
    await bootstrapAgreementIntelligenceCommercialGraph({
      userId: input.userId,
      organizationWorkflowId: input.workflowId,
      approvedStructure,
      existingPilotDealId: pilotDealId,
    });

    const configuration = parseAgreementIntelligenceConfiguration(row.configuration);
    await finalizeWorkflowActivation({
      workflowId: input.workflowId,
      agreementId: row.agreement.id,
      userId: input.userId,
      pilotDealId,
      operatorApprovalRequired: configuration.operatorApprovalRequired,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to bootstrap commercial workflow';
    await prisma.organization_workflow_agreements.update({
      where: { id: row.agreement.id },
      data: { bootstrap_error: message },
    });
    await setWorkflowLifecycle(input.workflowId, 'BOOTSTRAP_FAILED');
  }

  return getWorkflowAgreementContext(input.organizationId, input.workflowId, input.userId);
}

export async function retryWorkflowAgreementBootstrap(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
}) {
  const row = await getWorkflowRow(input.organizationId, input.workflowId);
  if (
    row.lifecycle_status !== 'BOOTSTRAP_FAILED' &&
    row.lifecycle_status !== 'ACTIVE' &&
    row.lifecycle_status !== 'PARTICIPANT_SETUP'
  ) {
    throw new WorkflowAgreementError(
      'Commercial bootstrap can only be retried after a failed activation or on an active workflow',
      'INVALID_STATE',
      409
    );
  }
  if (!row.agreement) {
    throw new WorkflowAgreementError('No agreement found for this workflow', 'NOT_FOUND', 404);
  }

  const approvedStructure = parseJsonField<ApprovedAgreementStructure>(
    row.agreement.approved_structure
  );
  if (!approvedStructure) {
    throw new WorkflowAgreementError(
      'Approved structure is missing — approve the agreement before retrying bootstrap',
      'INVALID_STATE',
      409
    );
  }

  const pilotDealId =
    row.agreement.pilot_deal_id?.trim() ||
    agreementIntelligencePilotDealId(input.workflowId);

  await setWorkflowLifecycle(input.workflowId, 'BOOTSTRAPPING');

  try {
    await bootstrapAgreementIntelligenceCommercialGraph({
      userId: input.userId,
      organizationWorkflowId: input.workflowId,
      approvedStructure,
      existingPilotDealId: pilotDealId,
      skipE2eForcedFailure: true,
    });

    const configuration = parseAgreementIntelligenceConfiguration(row.configuration);
    await finalizeWorkflowActivation({
      workflowId: input.workflowId,
      agreementId: row.agreement.id,
      userId: input.userId,
      pilotDealId,
      operatorApprovalRequired: configuration.operatorApprovalRequired,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to bootstrap commercial workflow';
    await prisma.organization_workflow_agreements.update({
      where: { id: row.agreement.id },
      data: { bootstrap_error: message },
    });
    await setWorkflowLifecycle(input.workflowId, 'BOOTSTRAP_FAILED');
  }

  return getWorkflowAgreementContext(input.organizationId, input.workflowId, input.userId);
}

export async function refreshWorkflowActivation(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
}) {
  const row = await getWorkflowRow(input.organizationId, input.workflowId);
  if (
    row.lifecycle_status !== 'PARTICIPANT_SETUP' &&
    row.lifecycle_status !== 'ACTIVE'
  ) {
    throw new WorkflowAgreementError(
      'Activation refresh is only available after commercial bootstrap',
      'INVALID_STATE',
      409
    );
  }

  const configuration = parseAgreementIntelligenceConfiguration(row.configuration);
  await maybeAdvanceParticipantSetupToActive({
    workflowId: input.workflowId,
    userId: input.userId,
    lifecycleStatus: row.lifecycle_status,
    pilotDealId: row.agreement?.pilot_deal_id ?? null,
    operatorApprovalRequired: configuration.operatorApprovalRequired,
  });

  return getWorkflowAgreementContext(input.organizationId, input.workflowId, input.userId);
}
