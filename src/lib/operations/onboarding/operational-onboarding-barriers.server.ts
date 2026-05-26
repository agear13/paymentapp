import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { computePaymentLinkRailSetup } from '@/lib/payment-links/setup-status';
import { orchestrateOperationalMutation } from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import { resolveOperationalCoordinationSnapshot } from '@/lib/operations/selectors/resolve-operational-coordination.server';
import type { OperationalOnboardingPhase } from '@/lib/operations/onboarding/operational-onboarding-phases';
import { assertOnboardingGraphInvariants } from '@/lib/operations/dev/operational-invariants';
import { operationalInitializationEvent } from '@/lib/operations/onboarding/operational-initialization-events';

export type OnboardingBarrierResult = {
  workspaceReady: boolean;
  projectReady: boolean;
  paymentRailsReady: boolean;
  stripeConnected: boolean;
  graphReady: boolean;
  phase: OperationalOnboardingPhase;
  blockers: string[];
  pendingInitializationSteps: string[];
  primaryProjectId: string | null;
  organizationId: string | null;
  merchantSettingsId: string | null;
  correlationId: string;
};

export async function ensureWorkspaceExists(
  userId: string,
  organizationId?: string | null
): Promise<{ ready: boolean; organizationId: string | null; merchantSettingsId: string | null }> {
  if (organizationId) {
    const settings = await prisma.merchant_settings.findFirst({
      where: { organization_id: organizationId },
      select: { id: true },
    });
    return {
      ready: Boolean(settings),
      organizationId,
      merchantSettingsId: settings?.id ?? null,
    };
  }

  const membership = await prisma.user_organizations.findFirst({
    where: { user_id: userId },
    select: { organization_id: true },
  });
  if (!membership?.organization_id) {
    return { ready: false, organizationId: null, merchantSettingsId: null };
  }

  const settings = await prisma.merchant_settings.findFirst({
    where: { organization_id: membership.organization_id },
    select: { id: true },
  });

  return {
    ready: Boolean(settings),
    organizationId: membership.organization_id,
    merchantSettingsId: settings?.id ?? null,
  };
}

export async function ensureProjectBootstrapComplete(
  userId: string,
  projectId?: string | null
): Promise<{ ready: boolean; projectId: string | null }> {
  const snapshot = await getPilotSnapshotForUser(userId).catch(() => ({
    deals: [],
    participants: [],
  }));

  const candidateId = projectId ?? snapshot.deals.find((d) => !d.archived)?.id ?? null;
  if (!candidateId) {
    return { ready: false, projectId: null };
  }

  const deal = snapshot.deals.find((d) => d.id === candidateId && !d.archived);
  return { ready: Boolean(deal), projectId: deal?.id ?? null };
}

export async function ensureSettlementRailsInitialized(
  organizationId: string | null
): Promise<{ ready: boolean; stripeConnected: boolean; rails: ReturnType<typeof computePaymentLinkRailSetup> }> {
  if (!organizationId) {
    return {
      ready: false,
      stripeConnected: false,
      rails: computePaymentLinkRailSetup(null),
    };
  }

  const merchant = await prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
    select: {
      stripe_account_id: true,
      hedera_account_id: true,
      wise_enabled: true,
      wise_profile_id: true,
    },
  });

  const rails = computePaymentLinkRailSetup(merchant);
  return {
    ready: rails.anyRailConfigured,
    stripeConnected: rails.stripeConfigured,
    rails,
  };
}

export async function ensureOperationalGraphReady(input: {
  userId: string;
  projectId: string | null;
  organizationId: string | null;
  correlationId: string;
}): Promise<{ ready: boolean; blockers: string[] }> {
  if (!input.projectId) {
    return { ready: false, blockers: ['Project bootstrap incomplete'] };
  }

  try {
    await orchestrateOperationalMutation({
      userId: input.userId,
      mutation: 'funding_update',
      projectId: input.projectId,
    });

    const snapshot = await getPilotSnapshotForUser(input.userId);
    await resolveOperationalCoordinationSnapshot({
      userId: input.userId,
      projectId: input.projectId,
      participants: snapshot.participants,
    });

    assertOnboardingGraphInvariants({
      graphResolutionAttempted: true,
      projectId: input.projectId,
      organizationId: input.organizationId,
    });

    const graphEvent = operationalInitializationEvent('OPERATIONAL_GRAPH_INITIALIZED', {
      projectId: input.projectId,
      organizationId: input.organizationId ?? undefined,
      correlationId: input.correlationId,
    });
    const readyEvent = operationalInitializationEvent('SETTLEMENT_INFRASTRUCTURE_READY', {
      projectId: input.projectId,
      organizationId: input.organizationId ?? undefined,
      correlationId: input.correlationId,
    });
    log.info(`[operational-onboarding] ${graphEvent.type}`, graphEvent.payload);
    log.info(`[operational-onboarding] ${readyEvent.type}`, readyEvent.payload);

    return { ready: true, blockers: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ready: false,
      blockers: [`Operational graph initialization in progress (${message})`],
    };
  }
}
