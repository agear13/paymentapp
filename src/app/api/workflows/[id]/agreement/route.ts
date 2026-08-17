import { NextRequest } from 'next/server';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { requireEntitlement } from '@/lib/entitlements/gate-api.server';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import {
  approveWorkflowAgreementStructure,
  getWorkflowAgreementContext,
  retryWorkflowAgreementBootstrap,
  runWorkflowAgreementExtraction,
  submitPastedAgreement,
  submitUploadedAgreement,
} from '@/lib/workflows/agreement-intelligence/agreement-service.server';
import { WorkflowAgreementError } from '@/lib/workflows/agreement-intelligence/types';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import type { ReviewFormState } from '@/lib/ai-extractor/review-form-types';

function mapAgreementError(error: unknown) {
  if (error instanceof WorkflowAgreementError) {
    return apiError(error.message, error.status, error.code);
  }
  throw error;
}

async function requireAiImportEntitlement(
  organizationId: string,
  userId: string,
  userEmail: string | null
) {
  return requireEntitlement({
    organizationId,
    userId,
    userEmail: userEmail ?? undefined,
    feature: 'ai_import',
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const entitlementBlock = await requireAiImportEntitlement(
    access.organizationId,
    access.userId,
    access.userEmail
  );
  if (entitlementBlock) return entitlementBlock;

  const { id } = await context.params;

  try {
    const contextData = await getWorkflowAgreementContext(access.organizationId, id, access.userId);
    return apiResponse(contextData);
  } catch (error) {
    return mapAgreementError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const entitlementBlock = await requireAiImportEntitlement(
    access.organizationId,
    access.userId,
    access.userEmail
  );
  if (entitlementBlock) return entitlementBlock;

  const { id } = await context.params;

  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return apiError('A file is required', 400);
      }
      const contextData = await submitUploadedAgreement({
        organizationId: access.organizationId,
        workflowId: id,
        file,
      });
      return apiResponse(contextData);
    }

    const body = (await request.json()) as { text?: string; title?: string };
    const contextData = await submitPastedAgreement({
      organizationId: access.organizationId,
      workflowId: id,
      text: typeof body.text === 'string' ? body.text : '',
      title: typeof body.title === 'string' ? body.title : null,
    });
    return apiResponse(contextData);
  } catch (error) {
    return mapAgreementError(error);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const entitlementBlock = await requireAiImportEntitlement(
    access.organizationId,
    access.userId,
    access.userEmail
  );
  if (entitlementBlock) return entitlementBlock;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      reviewForm?: ReviewFormState;
      extractionResult?: ExtractionResult;
    };
    if (!body.reviewForm || !body.extractionResult) {
      return apiError('reviewForm and extractionResult are required', 400);
    }

    const contextData = await approveWorkflowAgreementStructure({
      organizationId: access.organizationId,
      workflowId: id,
      userId: access.userId,
      reviewForm: body.reviewForm,
      extractionResult: body.extractionResult,
    });
    return apiResponse(contextData);
  } catch (error) {
    return mapAgreementError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const entitlementBlock = await requireAiImportEntitlement(
    access.organizationId,
    access.userId,
    access.userEmail
  );
  if (entitlementBlock) return entitlementBlock;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as { action?: string; force?: boolean };
    if (body.action === 'extract') {
      const contextData = await runWorkflowAgreementExtraction(
        access.organizationId,
        id,
        undefined,
        { force: body.force === true }
      );
      return apiResponse(contextData);
    }
    if (body.action === 'bootstrap') {
      const contextData = await retryWorkflowAgreementBootstrap({
        organizationId: access.organizationId,
        workflowId: id,
        userId: access.userId,
      });
      return apiResponse(contextData);
    }
    return apiError('Unsupported action', 400);
  } catch (error) {
    return mapAgreementError(error);
  }
}
