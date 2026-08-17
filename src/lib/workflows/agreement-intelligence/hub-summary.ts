import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import type { OrganizationWorkflowLifecycleStatus } from '@prisma/client';
import { buildExtractionSummary } from '@/lib/ai-extractor/extraction-summary';
import { parseAgreementIntelligenceConfiguration } from '@/lib/workflows/agreement-intelligence/configuration';
import type {
  WorkflowAgreementHubSummary,
  WorkflowAgreementRecord,
} from '@/lib/workflows/agreement-intelligence/types';
import {
  canApproveStructure,
  canRetryBootstrap,
  canRetryExtraction,
  canReviewExtraction,
  canUploadAgreement,
  isOperationalWorkflow,
} from '@/lib/workflows/agreement-intelligence/lifecycle';

function resolveSettlementSchedule(result: ExtractionResult | null): string | null {
  if (!result) return null;

  for (const rule of result.settlementRules ?? []) {
    const trigger = rule.trigger.value?.trim();
    if (trigger) return trigger;
  }

  for (const term of result.paymentTerms ?? []) {
    const due = term.dueCondition.value?.trim();
    if (due) return due;
  }

  return null;
}

function resolveApprovalRequired(
  result: ExtractionResult | null,
  configApprovalRequired: boolean
): boolean | null {
  if (!result) return null;
  const blockers = result.commercialGraph?.commercialStructure?.settlementBlockers ?? [];
  if (blockers.some((blocker) => /approv/i.test(blocker))) {
    return true;
  }
  return configApprovalRequired;
}

export function buildWorkflowAgreementHubSummary(input: {
  lifecycleStatus: OrganizationWorkflowLifecycleStatus;
  configuration: unknown;
  agreement: WorkflowAgreementRecord | null;
}): WorkflowAgreementHubSummary {
  const config = parseAgreementIntelligenceConfiguration(input.configuration);
  const result = input.agreement?.extractionResult ?? null;
  const summary = result ? buildExtractionSummary(result) : null;

  return {
    title: input.agreement?.title ?? result?.projectName.value ?? null,
    lifecycleStatus: input.lifecycleStatus,
    extractionStatus: input.agreement?.extractionStatus ?? null,
    participantCount: summary?.participantCount ?? 0,
    obligationCount:
      (summary?.fixedFeeObligationCount ?? 0) + (summary?.revenueShareObligationCount ?? 0),
    revenueShareCount: summary?.revenueShareObligationCount ?? 0,
    settlementSchedule: resolveSettlementSchedule(result),
    approvalRequired: resolveApprovalRequired(result, config.operatorApprovalRequired),
    hasAgreement: input.agreement !== null,
    canReview: canReviewExtraction(input.lifecycleStatus),
    canApprove: canApproveStructure(input.lifecycleStatus),
    canUpload: canUploadAgreement(input.lifecycleStatus),
    canRetryExtraction: canRetryExtraction(input.lifecycleStatus),
    canRetryBootstrap: canRetryBootstrap(input.lifecycleStatus),
    isOperational: isOperationalWorkflow(input.lifecycleStatus),
  };
}
