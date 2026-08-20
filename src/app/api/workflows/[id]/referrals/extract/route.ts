import { NextRequest } from 'next/server';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import { requireReferralManagementEntitlement } from '@/lib/entitlements/gate-referral-admin.server';
import { requireEntitlement } from '@/lib/entitlements/gate-api.server';
import {
  extractReferralRelationshipsFromFile,
  extractReferralRelationshipsFromText,
} from '@/lib/workflows/referral-management/extract.server';
import { ReferralManagementError } from '@/lib/workflows/referral-management/promoter.server';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const referralEntitlement = await requireReferralManagementEntitlement({
    organizationId: access.organizationId,
    userId: access.userId,
    userEmail: access.userEmail,
  });
  if (referralEntitlement) return referralEntitlement;

  const extractEntitlement = await requireEntitlement({
    organizationId: access.organizationId,
    userId: access.userId,
    userEmail: access.userEmail,
    feature: 'ai_import',
  });
  if (extractEntitlement) return extractEntitlement;

  const { id } = await context.params;
  const contentType = request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File) || file.size === 0) {
        return apiError('Upload an agreement file to continue.', 400, 'INVALID_INPUT');
      }
      const preview = await extractReferralRelationshipsFromFile({
        organizationId: access.organizationId,
        workflowId: id,
        file,
      });
      return apiResponse(preview);
    }

    const body = (await request.json().catch(() => null)) as { text?: string; sourceLabel?: string } | null;
    const preview = await extractReferralRelationshipsFromText({
      organizationId: access.organizationId,
      workflowId: id,
      text: typeof body?.text === 'string' ? body.text : '',
      sourceLabel: typeof body?.sourceLabel === 'string' ? body.sourceLabel : undefined,
    });
    return apiResponse(preview);
  } catch (error) {
    if (error instanceof ReferralManagementError) {
      return apiError(error.message, error.status, error.code);
    }
    throw error;
  }
}
