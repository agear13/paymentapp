import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { sendEmail } from '@/lib/email/client';
import {
  buildExtractionExportDocument,
  extractionExportFilename,
  serializeExtractionExport,
} from '@/lib/ai-extractor/extraction-export';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { buildAgreementExtractionShareEmail } from '@/lib/email/templates/agreement-extraction-share';
import { AGREEMENT_INTELLIGENCE_SLUG } from '@/lib/workflows/agreement-intelligence/participant-coordination';
import { WorkflowAgreementError } from '@/lib/workflows/agreement-intelligence/types';
import { getOrganizationWorkflowById } from '@/lib/workflows/organization-workflows.server';

function asExtractionResult(value: unknown): ExtractionResult | null {
  if (!value || typeof value !== 'object') return null;
  if (!Array.isArray((value as ExtractionResult).parties)) return null;
  return value as ExtractionResult;
}

export async function shareWorkflowAgreementExtraction(input: {
  organizationId: string;
  workflowId: string;
  to: string;
  senderName?: string | null;
}): Promise<{ sent: true; emailId: string } | { sent: false; error: string }> {
  const workflow = await getOrganizationWorkflowById(input.organizationId, input.workflowId);
  if (workflow.templateSlug !== AGREEMENT_INTELLIGENCE_SLUG) {
    throw new WorkflowAgreementError(
      'This endpoint is only available for Agreement Intelligence workflows',
      'NOT_AGREEMENT_INTELLIGENCE',
      400
    );
  }

  const row = await prisma.organization_workflow_agreements.findUnique({
    where: { organization_workflow_id: input.workflowId },
  });
  const extraction = asExtractionResult(row?.extraction_result);
  if (!row || !extraction) {
    throw new WorkflowAgreementError(
      'No structured extraction is available to share yet.',
      'INVALID_STATE',
      409
    );
  }

  const document = buildExtractionExportDocument({
    result: extraction,
    title: row.title,
  });
  const message = buildAgreementExtractionShareEmail({
    document,
    senderName: input.senderName,
  });
  const filename = extractionExportFilename(document.title);
  const result = await sendEmail({
    to: input.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    attachments: [
      {
        filename,
        content: Buffer.from(serializeExtractionExport(document), 'utf8').toString('base64'),
        contentType: 'application/json',
      },
    ],
  });

  if (!result.success) {
    return {
      sent: false,
      error: result.error ?? 'Email provider did not send the extraction.',
    };
  }

  return { sent: true, emailId: result.id };
}
