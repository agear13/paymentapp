/**
 * Deterministic HackCanton demo dataset + orchestration.
 *
 * Flow (approved):
 *   Agreement Upload (Provvypay)
 *   → AI Agreement Intelligence (Provvypay)
 *   → CommercialAgreementProposal (Canton / Platform)
 *   → Venue Accept → Promoter Accept → Artist Accept
 *   → CommercialAgreement Bound
 *   → SettlementReady
 *   → Projection into Provvypay
 *
 * Accountant is intentionally excluded from the ledger workflow.
 */

import { createProjectionService } from '@/lib/commercial-network/projection-service';
import {
  createCantonCommercialNetworkProvider,
  type CantonCommercialNetworkProvider,
} from '@/lib/commercial-network/providers/canton/canton-provider';
import type { CantonWorkflowProjection } from '@/lib/commercial-network/providers/canton/workflow-types';

export const HACKCANTON_DEMO = {
  organizationId: 'org-hackcanton-demo',
  agreementId: 'demo-agreement-summer-festival',
  /** Off-ledger upload artefact */
  uploadedDocument: {
    fileName: 'summer-festival-commercial-agreement.pdf',
    uploadedAt: '2026-07-16T00:00:00.000Z',
  },
  /** AI extraction result (Provvypay Agreement Intelligence — off ledger) */
  aiExtraction: {
    title: 'Summer Festival Commercial Agreement',
    currency: 'AUD',
    summary:
      'Venue hire, promotion services, and artist performance fee for Summer Festival.',
    counterparties: [
      { role: 'Venue', name: 'Harbour Pavilion', party: 'party::venue' },
      { role: 'Promoter', name: 'Northshore Promotions', party: 'party::promoter' },
      {
        role: 'Artist',
        name: 'DJ Nova',
        party: 'party::artist',
        uiLabel: 'DJ',
      },
    ],
  },
  platform: {
    party: 'party::provvypay-platform',
    displayName: 'Provvypay Platform' as const,
  },
} as const;

export type HackCantonDemoResult = {
  provider: CantonCommercialNetworkProvider;
  projection: CantonWorkflowProjection;
  stages: CantonWorkflowProjection['stage'][];
};

/**
 * Runs the full HackCanton ledger path after AI extraction (off-ledger).
 * Returns the final SettlementReady projection for Commercial Operations Workspace.
 */
export async function runHackCantonDemoWorkflow(
  options?: { now?: () => string }
): Promise<HackCantonDemoResult> {
  const now = options?.now ?? (() => '2026-07-16T12:00:00.000Z');
  const provider = createCantonCommercialNetworkProvider({
    defaultPlatformParty: HACKCANTON_DEMO.platform.party,
    now,
  });
  const projections = createProjectionService();
  provider.subscribeToWorkflowEvents((event) => {
    projections.project(event);
  });

  const stages: CantonWorkflowProjection['stage'][] = [];
  const track = () => {
    const p = provider.getRuntime().project(HACKCANTON_DEMO.agreementId);
    if (p) stages.push(p.stage);
  };

  const requiredParticipants = HACKCANTON_DEMO.aiExtraction.counterparties.map(
    (c) => ({
      party: c.party,
      role: c.role,
    })
  );

  const created = await provider.createSharedCommercialAgreement({
    agreementId: HACKCANTON_DEMO.agreementId,
    organizationId: HACKCANTON_DEMO.organizationId,
    name: HACKCANTON_DEMO.aiExtraction.title,
    partner: 'Harbour Pavilion',
    payload: {
      platformParty: HACKCANTON_DEMO.platform.party,
      platformDisplayName: HACKCANTON_DEMO.platform.displayName,
      requiredParticipants,
      currency: HACKCANTON_DEMO.aiExtraction.currency,
      summary: HACKCANTON_DEMO.aiExtraction.summary,
      revision: 0,
      aiExtraction: HACKCANTON_DEMO.aiExtraction,
      uploadedDocument: HACKCANTON_DEMO.uploadedDocument,
    },
    occurredAt: now(),
  });
  if (!created.ok) {
    throw new Error(created.error);
  }
  track();

  for (const counterparty of HACKCANTON_DEMO.aiExtraction.counterparties) {
    const accepted = await provider.submitParticipantApproval({
      agreementId: HACKCANTON_DEMO.agreementId,
      participantId: counterparty.party,
      note: `${counterparty.role} accepts shared commercial terms`,
      occurredAt: now(),
    });
    if (!accepted.ok) {
      throw new Error(accepted.error);
    }
    track();
  }

  const ready = await provider.submitSettlementApproval({
    agreementId: HACKCANTON_DEMO.agreementId,
    approvedBy: HACKCANTON_DEMO.platform.party,
    note: 'Provvypay Platform declares Settlement Ready',
    occurredAt: now(),
  });
  if (!ready.ok) {
    throw new Error(ready.error);
  }
  track();

  const projection = provider.getRuntime().project(HACKCANTON_DEMO.agreementId);
  if (!projection || projection.stage !== 'SettlementReady') {
    throw new Error('Demo failed to reach SettlementReady');
  }

  // Accountant must not appear in ledger projection parties.
  const roles = projection.requiredParticipants.map((r) => r.role);
  if (roles.includes('Accountant')) {
    throw new Error('Accountant must not be a ledger approval party');
  }

  return { provider, projection, stages };
}

/**
 * Map Canton workflow projection → Commercial Operations Workspace fields.
 * UI continues to read Commercial Domain projections — never Daml contracts.
 */
export function cantonProjectionToOperationsFields(
  projection: CantonWorkflowProjection
): {
  cantonWorkflowStage: CantonWorkflowProjection['stage'];
  platformDisplayName: 'Provvypay Platform';
  settlementReadiness: boolean;
  pendingApprovals: string[];
  acceptedRoles: string[];
  participantActivity: Array<{
    id: string;
    label: string;
    description: string;
    occurredAt: string;
    participantName: string;
  }>;
} {
  const acceptedRoles = projection.requiredParticipants
    .filter((r) => projection.acceptedParties.includes(r.party))
    .map((r) => (r.role === 'Artist' ? 'DJ / Artist' : r.role));

  return {
    cantonWorkflowStage: projection.stage,
    platformDisplayName: 'Provvypay Platform',
    settlementReadiness: projection.stage === 'SettlementReady',
    pendingApprovals: projection.pendingRoles.map((r) =>
      r === 'Artist' ? 'DJ / Artist' : r
    ),
    acceptedRoles,
    participantActivity: acceptedRoles.map((role, index) => ({
      id: `canton-accept-${index}`,
      label: `${role} accepted`,
      description: `${role} accepted the shared commercial agreement on Canton.`,
      occurredAt: projection.updatedAt,
      participantName: role,
    })),
  };
}
