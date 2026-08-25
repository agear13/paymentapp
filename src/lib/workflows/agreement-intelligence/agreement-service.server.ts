import type {
  organization_workflow_agreements,
  OrganizationWorkflowLifecycleStatus,
  Prisma,
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
import {
  agreementDrivesWorkflowLifecycle,
  canStartNewExtraction,
  lifecycleForAgreementView,
  pickCurrentAgreement,
  shouldCreateNewCurrentAgreement,
  toAgreementCollectionItem,
} from '@/lib/workflows/agreement-intelligence/agreement-collection';
import type {
  AgreementCollectionItem,
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
    isCurrent: row.is_current ?? true,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const WORKFLOW_AGREEMENTS_INCLUDE = {
  agreements: {
    orderBy: [{ is_current: 'desc' as const }, { updated_at: 'desc' as const }],
  },
};

function attachedAgreements(row: {
  agreements?: organization_workflow_agreements[] | null;
  agreement?: organization_workflow_agreements | null;
}): organization_workflow_agreements[] {
  if (Array.isArray(row.agreements)) return row.agreements;
  if (row.agreement) return [{ ...row.agreement, is_current: row.agreement.is_current ?? true }];
  return [];
}

function resolveCurrentAgreement(row: {
  agreements?: organization_workflow_agreements[] | null;
  agreement?: organization_workflow_agreements | null;
}): organization_workflow_agreements | null {
  return pickCurrentAgreement(attachedAgreements(row));
}

async function resolveTargetAgreement(
  row: {
    agreements?: organization_workflow_agreements[] | null;
    agreement?: organization_workflow_agreements | null;
  },
  organizationId: string,
  workflowId: string,
  agreementId?: string | null
): Promise<organization_workflow_agreements | null> {
  if (!agreementId) {
    return resolveCurrentAgreement(row);
  }

  const attached = attachedAgreements(row).find((item) => item.id === agreementId);
  if (attached) return attached;

  return prisma.organization_workflow_agreements.findFirst({
    where: {
      id: agreementId,
      organization_id: organizationId,
      organization_workflow_id: workflowId,
    },
  });
}

async function lockWorkflowRow(tx: Prisma.TransactionClient, workflowId: string) {
  await tx.$queryRaw`
    SELECT id FROM organization_workflows
    WHERE id = ${workflowId}::uuid
    FOR UPDATE
  `;
}

const CURRENT_AGREEMENT_LOOKUP = {
  is_current: true as const,
};

async function findCurrentAgreementRow(
  client: Prisma.TransactionClient | typeof prisma,
  workflowId: string
) {
  return client.organization_workflow_agreements.findFirst({
    where: { organization_workflow_id: workflowId, ...CURRENT_AGREEMENT_LOOKUP },
    orderBy: { updated_at: 'desc' },
  });
}

async function setWorkflowLifecycleIfCurrent(
  workflowId: string,
  lifecycleStatus: OrganizationWorkflowLifecycleStatus,
  drivesWorkflow: boolean
) {
  if (!drivesWorkflow) return;
  await setWorkflowLifecycle(workflowId, lifecycleStatus);
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
    include: WORKFLOW_AGREEMENTS_INCLUDE,
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
  return {
    ...row,
    agreement: resolveCurrentAgreement(row),
  };
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
  syncWorkflowLifecycle?: boolean;
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
  await setWorkflowLifecycleIfCurrent(
    input.workflowId,
    lifecycleStatus,
    input.syncWorkflowLifecycle !== false
  );
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
  userId?: string,
  agreementId?: string
) {
  const row = await getWorkflowRow(organizationId, workflowId);
  const configuration = parseAgreementIntelligenceConfiguration(row.configuration);
  let lifecycleStatus = row.lifecycle_status;
  const currentRecord = resolveCurrentAgreement(row);
  let agreementRecord = currentRecord;

  if (agreementId) {
    agreementRecord =
      attachedAgreements(row).find((item) => item.id === agreementId) ??
      (await prisma.organization_workflow_agreements.findFirst({
        where: {
          id: agreementId,
          organization_id: organizationId,
          organization_workflow_id: workflowId,
        },
      }));
    if (!agreementRecord) {
      throw new WorkflowAgreementError('Agreement not found', 'NOT_FOUND', 404);
    }
  }

  let viewLifecycle = lifecycleForAgreementView({
    isCurrent: agreementDrivesWorkflowLifecycle(agreementRecord, currentRecord),
    workflowLifecycle: lifecycleStatus,
    extractionStatus: agreementRecord?.extraction_status ?? 'PENDING',
    bootstrappedAt: agreementRecord?.bootstrapped_at?.toISOString() ?? null,
    bootstrapError: agreementRecord?.bootstrap_error ?? null,
  });

  if (
    userId &&
    viewLifecycle === 'PARTICIPANT_SETUP' &&
    agreementRecord?.pilot_deal_id &&
    (agreementRecord.is_current ?? true)
  ) {
    const advanced = await maybeAdvanceParticipantSetupToActive({
      workflowId,
      userId,
      lifecycleStatus,
      pilotDealId: agreementRecord.pilot_deal_id,
      operatorApprovalRequired: configuration.operatorApprovalRequired,
    });
    if (advanced !== lifecycleStatus) {
      lifecycleStatus = advanced;
      viewLifecycle = lifecycleForAgreementView({
        isCurrent: agreementDrivesWorkflowLifecycle(agreementRecord, currentRecord),
        workflowLifecycle: lifecycleStatus,
        extractionStatus: agreementRecord?.extraction_status ?? 'PENDING',
        bootstrappedAt: agreementRecord?.bootstrapped_at?.toISOString() ?? null,
        bootstrapError: agreementRecord?.bootstrap_error ?? null,
      });
    }
  }

  const agreement = agreementRecord ? serializeAgreement(agreementRecord) : null;
  const hubSummary = buildWorkflowAgreementHubSummary({
    lifecycleStatus: agreement ? viewLifecycle : lifecycleStatus,
    configuration: row.configuration,
    agreement,
  });
  if (agreement && !agreement.isCurrent) {
    hubSummary.canUpload = false;
  }

  let operationalSummary: WorkflowOperationalHubSummary | null = null;
  if (userId) {
    const approvedStructure = agreement?.approvedStructure ?? null;
    operationalSummary = await buildWorkflowOperationalHubSummary({
      userId,
      lifecycleStatus: agreement ? viewLifecycle : lifecycleStatus,
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
    lifecycleStatus: agreementId && agreement ? viewLifecycle : lifecycleStatus,
    configuration,
    agreement,
    hubSummary,
    operationalSummary,
  };
}

export async function getWorkflowAgreementContext(
  organizationId: string,
  workflowId: string,
  userId?: string,
  agreementId?: string
) {
  return buildAgreementContextResponse(organizationId, workflowId, userId, agreementId);
}

export async function listWorkflowAgreements(
  organizationId: string,
  workflowId: string
): Promise<{
  workflowId: string;
  lifecycleStatus: OrganizationWorkflowLifecycleStatus;
  currentAgreementId: string | null;
  canStartNew: boolean;
  agreements: AgreementCollectionItem[];
}> {
  const row = await getWorkflowRow(organizationId, workflowId);
  const current = resolveCurrentAgreement(row);
  return {
    workflowId: row.id,
    lifecycleStatus: row.lifecycle_status,
    currentAgreementId: current?.id ?? null,
    canStartNew: canStartNewExtraction({
      current: current ? serializeAgreement(current) : null,
      workflowLifecycle: row.lifecycle_status,
    }),
    agreements: attachedAgreements(row)
      .slice()
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
      .map(toAgreementCollectionItem),
  };
}

export async function startNewWorkflowAgreement(
  organizationId: string,
  workflowId: string
) {
  const row = await getWorkflowRow(organizationId, workflowId);
  const current = resolveCurrentAgreement(row);
  if (
    !canStartNewExtraction({
      current: current ? serializeAgreement(current) : null,
      workflowLifecycle: row.lifecycle_status,
    })
  ) {
    throw new WorkflowAgreementError(
      'Finish the extraction already in progress before starting a new one.',
      'INVALID_STATE',
      409
    );
  }

  // Intent signal only: AWAITING_INPUT + preserved current row. Do not demote
  // or insert until paste/upload succeeds inside upsertAgreementInput.
  await setWorkflowLifecycle(workflowId, 'AWAITING_INPUT');
  return buildAgreementContextResponse(organizationId, workflowId);
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
    include: WORKFLOW_AGREEMENTS_INCLUDE,
  });

  const agreementRow = resolveCurrentAgreement(row);
  const agreement = agreementRow ? serializeAgreement(agreementRow) : null;
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
  return prisma.$transaction(async (tx) => {
    await lockWorkflowRow(tx, input.workflowId);

    const workflow = await tx.organization_workflows.findUnique({
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

    const existing = await findCurrentAgreementRow(tx, input.workflowId);
    const openNewRow = shouldCreateNewCurrentAgreement({
      current: existing,
      workflowLifecycle: workflow?.lifecycle_status ?? 'AWAITING_INPUT',
    });

    const replacementFields = {
      source_type: input.sourceType,
      title: input.title,
      original_filename: input.originalFilename ?? null,
      mime_type: input.mimeType ?? null,
      file_size_bytes: input.fileSizeBytes ?? null,
      storage_key: input.storageKey ?? null,
      source_text: input.sourceText,
      extraction_status: 'PENDING' as const,
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
      is_current: true,
    };

    if (!openNewRow && existing) {
      if (existing.extraction_status === 'APPROVED') {
        throw new WorkflowAgreementError(
          'Agreement structure is already approved. Start a new extraction to keep this agreement and add another.',
          'INVALID_STATE',
          409
        );
      }
      await tx.organization_workflow_agreements.updateMany({
        where: {
          organization_workflow_id: input.workflowId,
          is_current: true,
          id: { not: existing.id },
        },
        data: { is_current: false },
      });
      const row = await tx.organization_workflow_agreements.update({
        where: { id: existing.id },
        data: replacementFields,
      });
      return serializeAgreement(row);
    }

    await tx.organization_workflow_agreements.updateMany({
      where: { organization_workflow_id: input.workflowId, is_current: true },
      data: { is_current: false },
    });
    const row = await tx.organization_workflow_agreements.create({
      data: {
        organization_id: input.organizationId,
        organization_workflow_id: input.workflowId,
        ...replacementFields,
      },
    });
    return serializeAgreement(row);
  });
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
  const current = resolveCurrentAgreement(row);
  const agreementRow = await resolveTargetAgreement(
    row,
    organizationId,
    workflowId,
    agreementId
  );

  if (!agreementRow) {
    throw new WorkflowAgreementError('No agreement has been provided yet', 'INVALID_STATE', 400);
  }

  const drivesWorkflow = agreementDrivesWorkflowLifecycle(agreementRow, current);

  if (agreementRow.extraction_status === 'APPROVED') {
    throw new WorkflowAgreementError('Agreement structure is already approved', 'INVALID_STATE', 409);
  }

  if (
    !options?.force &&
    agreementRow.extraction_status === 'READY_FOR_REVIEW' &&
    agreementRow.extraction_result
  ) {
    return getWorkflowAgreementContext(organizationId, workflowId, undefined, agreementRow.id);
  }

  if (
    !options?.force &&
    (row.lifecycle_status === 'ACTIVE' ||
      row.lifecycle_status === 'BOOTSTRAPPING' ||
      row.lifecycle_status === 'BOOTSTRAP_FAILED') &&
    agreementRow.approved_structure &&
    drivesWorkflow
  ) {
    return getWorkflowAgreementContext(organizationId, workflowId, undefined, agreementRow.id);
  }

  if (
    !options?.force &&
    agreementRow.extraction_status === 'EXTRACTING' &&
    (drivesWorkflow ? row.lifecycle_status === 'EXTRACTING' : true)
  ) {
    return getWorkflowAgreementContext(organizationId, workflowId, undefined, agreementRow.id);
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
  await setWorkflowLifecycleIfCurrent(workflowId, 'EXTRACTING', drivesWorkflow);

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
    await setWorkflowLifecycleIfCurrent(workflowId, 'READY_FOR_REVIEW', drivesWorkflow);

    return getWorkflowAgreementContext(organizationId, workflowId, undefined, agreementRow.id);
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
    await setWorkflowLifecycleIfCurrent(workflowId, 'EXTRACTION_FAILED', drivesWorkflow);

    throw new WorkflowAgreementError(message, 'EXTRACTION_FAILED', 422);
  }
}

export async function approveWorkflowAgreementStructure(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  reviewForm: ReviewFormState;
  extractionResult: ExtractionResult;
  agreementId?: string;
}) {
  const row = await getWorkflowRow(input.organizationId, input.workflowId);
  const current = resolveCurrentAgreement(row);
  const targetAgreement = await resolveTargetAgreement(
    row,
    input.organizationId,
    input.workflowId,
    input.agreementId
  );
  const drivesWorkflow = agreementDrivesWorkflowLifecycle(targetAgreement, current);

  if (!targetAgreement) {
    throw new WorkflowAgreementError('No agreement found for this workflow', 'NOT_FOUND', 404);
  }
  if (targetAgreement.extraction_status !== 'READY_FOR_REVIEW') {
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
    targetAgreement.pilot_deal_id?.trim() ||
    agreementIntelligencePilotDealId(targetAgreement.id);

  await prisma.organization_workflow_agreements.update({
    where: { id: targetAgreement.id },
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
  await setWorkflowLifecycleIfCurrent(input.workflowId, 'BOOTSTRAPPING', drivesWorkflow);

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
      agreementId: targetAgreement.id,
      userId: input.userId,
      pilotDealId,
      operatorApprovalRequired: configuration.operatorApprovalRequired,
      syncWorkflowLifecycle: drivesWorkflow,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to bootstrap commercial workflow';
    await prisma.organization_workflow_agreements.update({
      where: { id: targetAgreement.id },
      data: { bootstrap_error: message },
    });
    await setWorkflowLifecycleIfCurrent(input.workflowId, 'BOOTSTRAP_FAILED', drivesWorkflow);
  }

  return getWorkflowAgreementContext(
    input.organizationId,
    input.workflowId,
    input.userId,
    targetAgreement.id
  );
}

export async function retryWorkflowAgreementBootstrap(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  agreementId?: string;
}) {
  const row = await getWorkflowRow(input.organizationId, input.workflowId);
  const current = resolveCurrentAgreement(row);
  const targetAgreement = await resolveTargetAgreement(
    row,
    input.organizationId,
    input.workflowId,
    input.agreementId
  );
  if (!targetAgreement) {
    throw new WorkflowAgreementError('No agreement found for this workflow', 'NOT_FOUND', 404);
  }

  const drivesWorkflow = agreementDrivesWorkflowLifecycle(targetAgreement, current);

  if (drivesWorkflow) {
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
  }

  const approvedStructure = parseJsonField<ApprovedAgreementStructure>(
    targetAgreement.approved_structure
  );
  if (!approvedStructure) {
    throw new WorkflowAgreementError(
      'Approved structure is missing — approve the agreement before retrying bootstrap',
      'INVALID_STATE',
      409
    );
  }

  const pilotDealId =
    targetAgreement.pilot_deal_id?.trim() ||
    agreementIntelligencePilotDealId(targetAgreement.id);

  await setWorkflowLifecycleIfCurrent(input.workflowId, 'BOOTSTRAPPING', drivesWorkflow);

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
      agreementId: targetAgreement.id,
      userId: input.userId,
      pilotDealId,
      operatorApprovalRequired: configuration.operatorApprovalRequired,
      syncWorkflowLifecycle: drivesWorkflow,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to bootstrap commercial workflow';
    await prisma.organization_workflow_agreements.update({
      where: { id: targetAgreement.id },
      data: { bootstrap_error: message },
    });
    await setWorkflowLifecycleIfCurrent(input.workflowId, 'BOOTSTRAP_FAILED', drivesWorkflow);
  }

  return getWorkflowAgreementContext(
    input.organizationId,
    input.workflowId,
    input.userId,
    targetAgreement.id
  );
}

export async function refreshWorkflowActivation(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  agreementId?: string;
}) {
  const row = await getWorkflowRow(input.organizationId, input.workflowId);
  const current = resolveCurrentAgreement(row);
  const targetAgreement = await resolveTargetAgreement(
    row,
    input.organizationId,
    input.workflowId,
    input.agreementId
  );
  const drivesWorkflow = agreementDrivesWorkflowLifecycle(targetAgreement, current);

  if (drivesWorkflow) {
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
      pilotDealId: targetAgreement?.pilot_deal_id ?? null,
      operatorApprovalRequired: configuration.operatorApprovalRequired,
    });
  }

  return getWorkflowAgreementContext(
    input.organizationId,
    input.workflowId,
    input.userId,
    targetAgreement?.id ?? input.agreementId
  );
}
