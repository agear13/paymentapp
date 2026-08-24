import 'server-only';

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  mapReviewToParticipants,
  mapReviewToRecentDeal,
  mergeExtractedCompensationIntoExistingParticipant,
} from '@/lib/ai-extractor/extraction-mapper';
import { buildConversationImportAuditRecord } from '@/lib/operations/audit/conversation-import-audit';
import {
  getPilotSnapshotForUser,
  syncPilotSnapshotForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { refreshProjectObligationsAfterParticipantPersist } from '@/lib/onboarding/refresh-onboarding-project-obligations.server';
import { prisma } from '@/lib/server/prisma';
import { compensationKindOf } from '@/lib/workflows/agreement-intelligence/participant-coordination';
import { referralManagementDealId } from '@/lib/workflows/referral-management/constants';
import type { ApprovedAgreementStructure } from '@/lib/workflows/agreement-intelligence/types';
import { proveSourceOrganizationFromWorkflow } from '@/lib/workflows/prove-source-organization.server';

export type AgreementIntelligenceBootstrapResult = {
  pilotDealId: string;
  participantCount: number;
  obligationCount: number;
};

export function agreementIntelligencePilotDealId(agreementOrWorkflowId: string): string {
  return `aiwf-${agreementOrWorkflowId}`;
}

/** Consumed once per dev-server process — used by Playwright golden-path verification only. */
let e2eForcedBootstrapFailureConsumed = false;

export function resetE2eBootstrapFailureHook(): void {
  e2eForcedBootstrapFailureConsumed = false;
}

function maybeThrowE2eForcedBootstrapFailure(): void {
  if (process.env.E2E_FORCE_BOOTSTRAP_FAIL !== '1' || e2eForcedBootstrapFailureConsumed) {
    return;
  }
  e2eForcedBootstrapFailureConsumed = true;
  throw new Error('E2E forced bootstrap failure');
}

function stableParticipantId(organizationWorkflowId: string, partyId: string): string {
  const sanitized = partyId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 48);
  return `aiwf-p-${organizationWorkflowId.replace(/-/g, '').slice(0, 8)}-${sanitized}`.slice(0, 255);
}

function mapApprovedStructureToDeal(
  approved: ApprovedAgreementStructure,
  dealId: string
): RecentDeal {
  const importRecord = buildConversationImportAuditRecord({
    form: approved.reviewForm,
    result: approved.extractionResult,
    entryPoint: 'workflow_agreement',
    sourceType: approved.reviewForm.sourceType,
  });
  const deal = mapReviewToRecentDeal(approved.reviewForm, importRecord);
  const settlementTrigger =
    approved.extractionResult.settlementRules?.[0]?.trigger.value?.trim() ??
    approved.extractionResult.paymentTerms?.[0]?.dueCondition.value?.trim();

  return {
    ...deal,
    id: dealId,
    payoutTrigger: settlementTrigger ?? deal.payoutTrigger ?? 'Manual',
    createdVia: 'agreement_intelligence_workflow',
    setupStatus: 'configuring',
  };
}

function normalizeParticipantEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function findReusableCompensatedParticipant(
  existingParticipants: DemoParticipant[],
  email: string | null | undefined,
  eligibleDealIds: Set<string>,
  claimedIds: Set<string>
): DemoParticipant | null {
  const normalized = normalizeParticipantEmail(email);
  if (!normalized) return null;
  const matches = existingParticipants.filter((participant) => {
    if (claimedIds.has(participant.id)) return false;
    if (!eligibleDealIds.has(participant.dealId ?? '')) return false;
    if (normalizeParticipantEmail(participant.email) !== normalized) return false;
    return compensationKindOf(participant) != null;
  });
  if (matches.length === 0) return null;
  return matches.find((participant) => Boolean(participant.referralCode?.trim())) ?? matches[0];
}

function mergeParticipantsForDeal(
  existingParticipants: DemoParticipant[],
  nextParticipants: DemoParticipant[],
  dealId: string
): DemoParticipant[] {
  const nextIds = new Set(nextParticipants.map((participant) => participant.id));
  const others = existingParticipants.filter(
    (participant) => participant.dealId !== dealId && !nextIds.has(participant.id)
  );
  const existingForDeal = existingParticipants.filter((participant) => participant.dealId === dealId);
  const existingById = new Map(existingForDeal.map((participant) => [participant.id, participant]));

  const mergedForDeal = nextParticipants.map((built) => {
    const existing = existingById.get(built.id);
    if (!existing) return built;
    return {
      ...mergeExtractedCompensationIntoExistingParticipant(existing, built),
      id: existing.id,
      inviteToken: existing.inviteToken,
      referralCode: existing.referralCode,
      customerCommerceUrl: existing.customerCommerceUrl,
      name: built.name,
      email: built.email || existing.email,
      roleDetails: built.roleDetails ?? existing.roleDetails,
      payoutDueDate: built.payoutDueDate ?? existing.payoutDueDate,
      participantNotes: built.participantNotes ?? existing.participantNotes,
      extractedObligations: built.extractedObligations ?? existing.extractedObligations,
    };
  });

  return [...others, ...mergedForDeal];
}

/**
 * Persist approved Agreement Intelligence structure into the existing pilot commercial graph.
 * Reuses the same deal/participant/obligations pipeline as workspace conversation import.
 */
export async function bootstrapAgreementIntelligenceCommercialGraph(input: {
  userId: string;
  organizationWorkflowId: string;
  approvedStructure: ApprovedAgreementStructure;
  existingPilotDealId?: string | null;
  /** Retry path must never re-trigger the one-shot Playwright bootstrap failure hook. */
  skipE2eForcedFailure?: boolean;
}): Promise<AgreementIntelligenceBootstrapResult> {
  if (!input.skipE2eForcedFailure) {
    maybeThrowE2eForcedBootstrapFailure();
  }

  const pilotDealId =
    input.existingPilotDealId?.trim() ||
    agreementIntelligencePilotDealId(input.organizationWorkflowId);

  const deal = mapApprovedStructureToDeal(input.approvedStructure, pilotDealId);
  const originalsById = new Map(
    input.approvedStructure.extractionResult.parties.map((party) => [party.id, party])
  );
  const builtParticipants = mapReviewToParticipants(
    input.approvedStructure.reviewForm,
    deal,
    originalsById,
    input.approvedStructure.extractionResult.settlementEvents
  );
  const reviewPartyIds = input.approvedStructure.reviewForm.parties
    .filter((party) => party.name.trim().length > 0)
    .map((party) => party.id);

  const snapshot = await getPilotSnapshotForUser(input.userId);
  const workflow = await prisma.organization_workflows.findUnique({
    where: { id: input.organizationWorkflowId },
    select: { id: true, organization_id: true },
  });
  const orgWorkflows = workflow
    ? await prisma.organization_workflows.findMany({
        where: { organization_id: workflow.organization_id },
        select: { id: true },
      })
    : [{ id: input.organizationWorkflowId }];
  const eligibleDealIds = new Set<string>([
    pilotDealId,
    ...orgWorkflows.flatMap((row) => [
      agreementIntelligencePilotDealId(row.id),
      referralManagementDealId(row.id),
    ]),
  ]);

  const claimedIds = new Set<string>();
  const participants = builtParticipants.map((built, index) => {
    const reusable =
      compensationKindOf(built) != null
        ? findReusableCompensatedParticipant(
            snapshot.participants,
            built.email,
            eligibleDealIds,
            claimedIds
          )
        : null;
    if (reusable) {
      claimedIds.add(reusable.id);
      return {
        ...mergeExtractedCompensationIntoExistingParticipant(reusable, built),
        id: reusable.id,
        dealId: pilotDealId,
        inviteToken: reusable.inviteToken,
        referralCode: reusable.referralCode,
        customerCommerceUrl: reusable.customerCommerceUrl,
        name: built.name,
        email: built.email?.trim() ? built.email : reusable.email,
      };
    }
    const partyId = reviewPartyIds[index] ?? built.id;
    return {
      ...built,
      id: stableParticipantId(input.organizationWorkflowId, partyId),
    };
  });

  const mergedDeals = [
    deal,
    ...snapshot.deals.filter((existingDeal) => existingDeal.id !== pilotDealId),
  ];
  const mergedParticipants = mergeParticipantsForDeal(
    snapshot.participants,
    participants,
    pilotDealId
  );

  const existingIds = new Set(snapshot.participants.map((row) => row.id));
  const newParticipantIds = new Set(
    mergedParticipants.filter((row) => !existingIds.has(row.id)).map((row) => row.id)
  );
  const sourceOrganizationId = await proveSourceOrganizationFromWorkflow(
    input.organizationWorkflowId,
    input.userId
  );

  await syncPilotSnapshotForUser(
    input.userId,
    mergedDeals,
    mergedParticipants,
    sourceOrganizationId && newParticipantIds.size > 0
      ? {
          sourceOrganizationIdForNewIds: {
            organizationId: sourceOrganizationId,
            participantIds: newParticipantIds,
          },
        }
      : undefined
  );
  await refreshProjectObligationsAfterParticipantPersist(input.userId, pilotDealId);

  const refreshed = await getPilotSnapshotForUser(input.userId);
  const obligationRows = await countObligationsForDeal(input.userId, pilotDealId);

  return {
    pilotDealId,
    participantCount: refreshed.participants.filter((participant) => participant.dealId === pilotDealId)
      .length,
    obligationCount: obligationRows,
  };
}

async function countObligationsForDeal(userId: string, dealId: string): Promise<number> {
  return prisma.deal_network_pilot_obligations.count({
    where: { user_id: userId, deal_id: dealId },
  });
}

export async function retryAgreementIntelligenceBootstrap(input: {
  userId: string;
  organizationWorkflowId: string;
  approvedStructure: ApprovedAgreementStructure;
  pilotDealId?: string | null;
}): Promise<AgreementIntelligenceBootstrapResult> {
  return bootstrapAgreementIntelligenceCommercialGraph({
    userId: input.userId,
    organizationWorkflowId: input.organizationWorkflowId,
    approvedStructure: input.approvedStructure,
    existingPilotDealId: input.pilotDealId,
    skipE2eForcedFailure: true,
  });
}
