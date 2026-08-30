import 'server-only';

import { Prisma } from '@prisma/client';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { log } from '@/lib/logger';
import { prisma } from '@/lib/server/prisma';
import { resolveOrganizationIdForPilotDeal } from '@/lib/referrals/ensure-referral-issuance';
import { openCommercialNetwork } from '@/lib/commercial-network/commercial-network';
import {
  cantonWorkflowFromProjection,
  mergeCantonWorkflowIntoDeal,
  readCantonWorkflowFromDeal,
  type CantonWorkflowPersistedState,
} from '@/lib/commercial-network/canton-workflow-persistence';
import {
  buildRequiredParticipantsForDeal,
  cantonRequiredPartiesEqual,
  cantonRequiredPartiesMissing,
  resolveCantonPartyForParticipant,
  resolveCantonPlatformParty,
} from '@/lib/commercial-network/server/canton-party-mapping.server';
import { resolveCantonLedgerMode } from '@/lib/commercial-network/providers/canton/resolve-canton-ledger-mode';
import { setCommercialNetworkConfig } from '@/lib/commercial-network/network-config';
import type { CantonCommercialNetworkProvider } from '@/lib/commercial-network/providers/canton/canton-provider';
import {
  dealRowToRecentDeal,
  getPilotParticipantsForDeal,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { isProjectWorkspaceParticipant } from '@/lib/projects/participant-entitlement';

export type CantonWorkflowSyncResult = {
  ok: boolean;
  stage?: string;
  workflow?: CantonWorkflowPersistedState | null;
  error?: string;
  proposalContractId?: string;
  agreementContractId?: string;
  settlementReadyContractId?: string;
  commandId?: string;
};

function ensureOrgUsesCantonProvider(organizationId: string): void {
  setCommercialNetworkConfig(organizationId, { provider: 'canton' });
}

async function loadDealContext(dealId: string): Promise<{
  deal: RecentDeal;
  operatorUserId: string;
  organizationId: string;
  participants: DemoParticipant[];
} | null> {
  const row = await prisma.deal_network_pilot_deals.findUnique({
    where: { id: dealId },
  });
  if (!row) return null;

  const organizationId = await resolveOrganizationIdForPilotDeal(row.user_id, dealId);
  if (!organizationId) return null;

  const deal = dealRowToRecentDeal(row);
  const participants = await getPilotParticipantsForDeal(dealId);

  return {
    deal,
    operatorUserId: row.user_id,
    organizationId,
    participants,
  };
}

async function persistCantonWorkflowState(
  dealId: string,
  workflow: CantonWorkflowPersistedState
): Promise<void> {
  const row = await prisma.deal_network_pilot_deals.findUnique({
    where: { id: dealId },
    select: { deal_payload: true },
  });
  if (!row) return;

  const deal = dealRowToRecentDeal({ id: dealId, deal_payload: row.deal_payload });
  const merged = mergeCantonWorkflowIntoDeal(deal, workflow);

  await prisma.deal_network_pilot_deals.update({
    where: { id: dealId },
    data: {
      deal_payload: merged as unknown as Prisma.InputJsonValue,
    },
  });
}

async function persistParticipantCantonParties(
  participants: DemoParticipant[]
): Promise<void> {
  await Promise.all(
    participants.map(async (participant) => {
      const cantonParty = resolveCantonPartyForParticipant(participant);
      const next = {
        ...participant,
        cantonParty,
      } as DemoParticipant & { cantonParty: string };

      await prisma.deal_network_pilot_participants.update({
        where: { id: participant.id },
        data: {
          participant_payload: next as unknown as Prisma.InputJsonValue,
        },
      });
    })
  );
}

function openCantonNetwork(organizationId: string, projectId: string) {
  ensureOrgUsesCantonProvider(organizationId);
  return openCommercialNetwork({ organizationId, projectId });
}

function asCantonProvider(
  network: ReturnType<typeof openCommercialNetwork>
): CantonCommercialNetworkProvider {
  return network.provider as CantonCommercialNetworkProvider;
}

function agreementParticipantsForCanton(participants: DemoParticipant[]): DemoParticipant[] {
  return participants.filter((p) => isProjectWorkspaceParticipant(p));
}

async function persistProjection(
  dealId: string,
  projection: NonNullable<Awaited<ReturnType<CantonCommercialNetworkProvider['projectAgreement']>>>,
  commandId: string
): Promise<CantonWorkflowPersistedState> {
  const workflow = cantonWorkflowFromProjection({
    projection,
    ledgerMode: resolveCantonLedgerMode(),
    lastCommandId: commandId,
  });
  await persistCantonWorkflowState(dealId, workflow);
  return workflow;
}

/**
 * Create (or revise) CommercialAgreementProposal so every current People-flow
 * participant is a required Canton party. An existing proposal is reused only
 * when its required set already matches; otherwise we archive it and create a
 * new revision. Bound agreements cannot gain new required parties in place.
 */
export async function syncCantonProposalOnAgreementShare(input: {
  dealId: string;
}): Promise<CantonWorkflowSyncResult> {
  const ctx = await loadDealContext(input.dealId);
  if (!ctx) {
    return { ok: false, error: 'Deal not found' };
  }

  const cantonParticipants = agreementParticipantsForCanton(ctx.participants);
  if (cantonParticipants.length === 0) {
    return { ok: false, error: 'No project workspace participants for Canton proposal' };
  }

  await persistParticipantCantonParties(cantonParticipants);

  const requiredParticipants = buildRequiredParticipantsForDeal(ctx.deal, cantonParticipants);
  if (requiredParticipants.length === 0) {
    return { ok: false, error: 'No required Canton parties for this deal' };
  }

  const existing = readCantonWorkflowFromDeal(ctx.deal);
  if (existing?.agreementContractId) {
    const missingOnBound = cantonRequiredPartiesMissing(
      requiredParticipants,
      existing.requiredParticipants
    );
    if (missingOnBound.length === 0) {
      return {
        ok: true,
        stage: existing.stage,
        workflow: existing,
        agreementContractId: existing.agreementContractId,
        proposalContractId: existing.proposalContractId ?? undefined,
      };
    }
    return {
      ok: false,
      error:
        'CommercialAgreement is already bound without this participant as a required party. Withdraw and create a new proposal revision before they can Accept.',
    };
  }

  if (
    existing?.proposalContractId &&
    cantonRequiredPartiesEqual(existing.requiredParticipants, requiredParticipants)
  ) {
    return {
      ok: true,
      stage: existing.stage,
      workflow: existing,
      proposalContractId: existing.proposalContractId,
    };
  }

  const platformParty = existing?.platformParty || resolveCantonPlatformParty();
  const revision =
    existing?.proposalContractId && existing.sharedTerms?.revision != null
      ? existing.sharedTerms.revision + 1
      : 0;
  const commandId = `sca-create-${Date.now()}`;

  const network = openCantonNetwork(ctx.organizationId, ctx.deal.id);
  const provider = asCantonProvider(network);
  provider.hydratePersistedWorkflow(existing ?? {
    provvypayAgreementId: ctx.deal.id,
    stage: 'Proposed',
    platformParty,
    requiredParticipants,
    acceptedParties: [],
    sharedTerms: {
      provvypayAgreementId: ctx.deal.id,
      revision,
      title: ctx.deal.dealName,
      currency: ctx.deal.projectValueCurrency ?? 'AUD',
      summary: ctx.deal.projectDescription ?? ctx.deal.dealName,
    },
    proposalContractId: null,
    agreementContractId: null,
    settlementReadyContractId: null,
  });

  const created = await network.createSharedCommercialAgreement({
    agreementId: ctx.deal.id,
    organizationId: ctx.organizationId,
    name: ctx.deal.dealName,
    partner: ctx.deal.partner ?? null,
    payload: {
      platformParty,
      platformDisplayName: 'Provvypay Platform',
      requiredParticipants,
      currency: ctx.deal.projectValueCurrency ?? 'AUD',
      summary: ctx.deal.projectDescription ?? ctx.deal.dealName,
      revision,
    },
    occurredAt: new Date().toISOString(),
  });

  if (!created.ok) {
    log.error('Canton proposal creation failed', undefined, {
      dealId: ctx.deal.id,
      error: created.error,
    });
    return { ok: false, error: created.error };
  }

  const projection = await provider.projectAgreement(ctx.deal.id);
  if (!projection) {
    return { ok: false, error: 'Canton projection missing after proposal create' };
  }

  const workflow = await persistProjection(ctx.deal.id, projection, commandId);

  log.info('Canton CommercialAgreementProposal created', {
    dealId: ctx.deal.id,
    proposalContractId: workflow.proposalContractId,
    stage: workflow.stage,
    ledgerMode: resolveCantonLedgerMode(),
  });

  return {
    ok: true,
    stage: workflow.stage,
    workflow,
    proposalContractId: workflow.proposalContractId ?? undefined,
    commandId,
  };
}

/**
 * Exercise Accept when participant approves from /participant/[token].
 */
export async function syncCantonParticipantApproval(input: {
  dealId: string;
  participant: DemoParticipant;
  note?: string;
  approverUserId?: string | null;
}): Promise<CantonWorkflowSyncResult> {
  const ctx = await loadDealContext(input.dealId);
  if (!ctx) {
    return { ok: false, error: 'Deal not found' };
  }

  const proposal = await syncCantonProposalOnAgreementShare({ dealId: input.dealId });
  if (!proposal.ok) {
    return proposal;
  }

  const refreshed = await loadDealContext(input.dealId);
  let workflow = refreshed
    ? readCantonWorkflowFromDeal(refreshed.deal)
    : proposal.workflow ?? null;

  const mappedParticipant =
    refreshed?.participants.find((p) => p.id === input.participant.id) ?? input.participant;
  const cantonParty = resolveCantonPartyForParticipant(mappedParticipant);
  if (workflow?.acceptedParties.includes(cantonParty) && workflow.agreementContractId) {
    return {
      ok: true,
      stage: workflow.stage,
      workflow,
      agreementContractId: workflow.agreementContractId,
    };
  }

  const commandId = `sca-accept-${Date.now()}`;
  const network = openCantonNetwork(ctx.organizationId, ctx.deal.id);
  const provider = asCantonProvider(network);

  if (workflow) {
    provider.hydratePersistedWorkflow(workflow);
  }

  const approved = await network.submitParticipantApproval({
    agreementId: ctx.deal.id,
    participantId: cantonParty,
    proposalContractId: workflow?.proposalContractId ?? undefined,
    note: input.note,
    approverUserId: input.approverUserId,
    occurredAt: new Date().toISOString(),
  });

  if (!approved.ok) {
    log.error('Canton Accept exercise failed', undefined, {
      dealId: ctx.deal.id,
      participantId: input.participant.id,
      cantonParty,
      error: approved.error,
    });
    return { ok: false, error: approved.error };
  }

  const projection = await provider.projectAgreement(ctx.deal.id);
  if (!projection) {
    return { ok: false, error: 'Canton projection missing after Accept' };
  }

  const nextWorkflow = await persistProjection(ctx.deal.id, projection, commandId);

  log.info('Canton Accept exercised', {
    dealId: ctx.deal.id,
    participantId: input.participant.id,
    cantonParty,
    stage: nextWorkflow.stage,
    agreementContractId: nextWorkflow.agreementContractId,
    proposalContractId: nextWorkflow.proposalContractId,
    ledgerMode: resolveCantonLedgerMode(),
  });

  return {
    ok: true,
    stage: nextWorkflow.stage,
    workflow: nextWorkflow,
    proposalContractId: nextWorkflow.proposalContractId ?? undefined,
    agreementContractId: nextWorkflow.agreementContractId ?? undefined,
    commandId,
  };
}

/**
 * Exercise DeclareSettlementReady when operator initiates settlement.
 */
export async function syncCantonSettlementReady(input: {
  dealId: string;
}): Promise<CantonWorkflowSyncResult> {
  const ctx = await loadDealContext(input.dealId);
  if (!ctx) {
    return { ok: false, error: 'Deal not found' };
  }

  const workflow = readCantonWorkflowFromDeal(ctx.deal);
  if (workflow?.stage === 'SettlementReady' && workflow.settlementReadyContractId) {
    return {
      ok: true,
      stage: 'SettlementReady',
      workflow,
      settlementReadyContractId: workflow.settlementReadyContractId,
    };
  }

  if (!workflow?.agreementContractId) {
    if (!isDealReadyForCantonSettlementReady(ctx.participants)) {
      return {
        ok: false,
        error: 'CommercialAgreement not bound — not all participants have approved',
      };
    }
    return {
      ok: false,
      error: 'CommercialAgreement contract id missing from persisted workflow',
    };
  }

  const platformParty = workflow.platformParty || resolveCantonPlatformParty();
  const commandId = `sca-ready-${Date.now()}`;

  const network = openCantonNetwork(ctx.organizationId, ctx.deal.id);
  const provider = asCantonProvider(network);
  provider.hydratePersistedWorkflow(workflow);

  const ready = await network.submitSettlementApproval({
    agreementId: ctx.deal.id,
    agreementContractId: workflow.agreementContractId,
    approvedBy: platformParty,
    note: 'Provvypay Platform declares Settlement Ready',
    occurredAt: new Date().toISOString(),
  });

  if (!ready.ok) {
    log.error('Canton DeclareSettlementReady failed', undefined, {
      dealId: ctx.deal.id,
      error: ready.error,
    });
    return { ok: false, error: ready.error };
  }

  const projection = await provider.projectAgreement(ctx.deal.id);
  const nextWorkflow = projection
    ? await persistProjection(ctx.deal.id, projection, commandId)
    : {
        ...workflow,
        stage: 'SettlementReady' as const,
        settlementReadyContractId: ready.data.settlementId ?? null,
        updatedAt: new Date().toISOString(),
        lastCommandId: commandId,
        ledgerMode: resolveCantonLedgerMode(),
      };

  if (!projection) {
    await persistCantonWorkflowState(ctx.deal.id, nextWorkflow);
  }

  log.info('Canton SettlementReady created', {
    dealId: ctx.deal.id,
    settlementReadyContractId: nextWorkflow.settlementReadyContractId,
    ledgerMode: resolveCantonLedgerMode(),
  });

  return {
    ok: true,
    stage: 'SettlementReady',
    workflow: nextWorkflow,
    agreementContractId: nextWorkflow.agreementContractId ?? undefined,
    settlementReadyContractId: nextWorkflow.settlementReadyContractId ?? undefined,
    commandId,
  };
}

export function isDealReadyForCantonSettlementReady(
  participants: DemoParticipant[]
): boolean {
  const cantonParticipants = agreementParticipantsForCanton(participants);
  return (
    cantonParticipants.length > 0 &&
    cantonParticipants.every((p) => p.approvalStatus === 'Approved')
  );
}
