import 'server-only';

import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { prisma } from '@/lib/server/prisma';
import { buildIncentiveDecisionRecord } from '@/lib/commercial-incentive/decision';
import { EARLY_PAYMENT_INCENTIVE_DISCLAIMER } from '@/lib/commercial-incentive/policy';
import { recommendEarlyPaymentIncentive } from '@/lib/commercial-incentive/recommend';
import {
  getEarlyPaymentIncentiveDecision,
  saveEarlyPaymentIncentiveDecision,
} from '@/lib/commercial-incentive/store.server';
import type { EarlyPaymentIncentiveView } from '@/lib/commercial-incentive/types';
import { AGREEMENT_INTELLIGENCE_SLUG } from '@/lib/workflows/agreement-intelligence/participant-coordination';

function originalDueLabels(result: ExtractionResult | null): string[] {
  if (!result) return [];
  return (result.paymentTerms ?? [])
    .map((term) => term.dueCondition.value?.trim() || term.description.value?.trim() || '')
    .filter(Boolean);
}

async function loadCurrentAgreement(input: {
  organizationId: string;
  workflowId?: string;
  agreementId?: string;
}) {
  const workflow = input.workflowId
    ? await prisma.organization_workflows.findFirst({
        where: {
          id: input.workflowId,
          organization_id: input.organizationId,
          template_slug: AGREEMENT_INTELLIGENCE_SLUG,
        },
        include: {
          agreements: {
            orderBy: [{ is_current: 'desc' }, { updated_at: 'desc' }],
          },
        },
      })
    : await prisma.organization_workflows.findFirst({
        where: {
          organization_id: input.organizationId,
          template_slug: AGREEMENT_INTELLIGENCE_SLUG,
        },
        orderBy: { updated_at: 'desc' },
        include: {
          agreements: {
            orderBy: [{ is_current: 'desc' }, { updated_at: 'desc' }],
          },
        },
      });

  if (!workflow) return null;

  const agreement = input.agreementId
    ? workflow.agreements.find((row) => row.id === input.agreementId) ?? null
    : workflow.agreements.find((row) => row.is_current) ?? workflow.agreements[0] ?? null;

  return { workflow, agreement };
}

function extractionOf(agreement: { extraction_result: unknown } | null): ExtractionResult | null {
  if (!agreement?.extraction_result || typeof agreement.extraction_result !== 'object') {
    return null;
  }
  return agreement.extraction_result as ExtractionResult;
}

export async function getEarlyPaymentIncentiveView(input: {
  organizationId: string;
  workflowId?: string;
  agreementId?: string;
}): Promise<EarlyPaymentIncentiveView> {
  const loaded = await loadCurrentAgreement(input);
  const extraction = extractionOf(loaded?.agreement ?? null);
  const agreementId = loaded?.agreement?.id ?? null;
  const workflowId = loaded?.workflow.id ?? null;
  const recommendation = recommendEarlyPaymentIncentive(extraction);
  const decision =
    agreementId && loaded
      ? await getEarlyPaymentIncentiveDecision(input.organizationId, agreementId)
      : null;

  return {
    agreementId,
    workflowId,
    hasExtraction: Boolean(extraction),
    originalDueLabels: originalDueLabels(extraction),
    recommendation,
    decision,
    disclaimer: EARLY_PAYMENT_INCENTIVE_DISCLAIMER,
  };
}

export async function decideEarlyPaymentIncentive(input: {
  organizationId: string;
  userId: string;
  action: 'approve' | 'dismiss';
  workflowId?: string;
  agreementId?: string;
}): Promise<EarlyPaymentIncentiveView> {
  const loaded = await loadCurrentAgreement(input);
  if (!loaded?.agreement || !loaded.workflow) {
    throw Object.assign(new Error('No agreement found'), { code: 'NOT_FOUND', status: 404 });
  }

  const extraction = extractionOf(loaded.agreement);
  const recommendation = recommendEarlyPaymentIncentive(extraction);
  if (!recommendation) {
    throw Object.assign(new Error('No early-payment incentive opportunity on this agreement'), {
      code: 'NO_RECOMMENDATION',
      status: 409,
    });
  }

  const record = buildIncentiveDecisionRecord({
    recommendation,
    action: input.action,
    sourceAgreementId: loaded.agreement.id,
    workflowId: loaded.workflow.id,
    decidedByUserId: input.userId,
  });

  await saveEarlyPaymentIncentiveDecision({
    organizationId: input.organizationId,
    userId: input.userId,
    record,
  });

  return getEarlyPaymentIncentiveView({
    organizationId: input.organizationId,
    workflowId: loaded.workflow.id,
    agreementId: loaded.agreement.id,
  });
}
