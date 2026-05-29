import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { adaptProjectInput } from '@/lib/operations/adapters/participant-adapter';
import { countConfiguredParticipants, detectProjectPhase } from '@/lib/operations/adapters/project-adapter';
import {
  PROJECT_CONTRACT_VERSION,
  type HydratedProject,
} from '@/lib/operations/contracts/project-contract';
import { warnHydrationFailure } from '@/lib/operations/hydration/hydration-dev-warnings';
import { draftProjectDefaults } from '@/lib/operations/guards/hydration-guards';

function emptyHydratedProject(): HydratedProject {
  const defaults = draftProjectDefaults();
  return {
    id: 'unknown',
    identity: { name: 'Untitled project', partner: '—', currency: 'AUD' },
    lifecycle: {
      setupStatus: defaults.setupStatus ?? 'configuring',
      phase: 'configuring',
    },
    treasury: {
      health: 'funding_pending',
      confirmedFunding: 0,
      obligationsTotal: 0,
      participantCount: 0,
      configuredParticipantCount: 0,
    },
    operational: {
      needsEarningsConfiguration: false,
      payoutReleaseEligible: false,
      needsAttention: true,
    },
    metadata: {
      contractVersion: PROJECT_CONTRACT_VERSION,
      source: 'draft',
    },
  };
}

export type HydrateProjectContext = {
  participants?: DemoParticipant[];
  confirmedFunding?: number;
  obligationsTotal?: number;
  treasuryHealth?: HydratedProject['treasury']['health'];
};

/**
 * Canonical project pipeline: normalize → hydrate → derive → present.
 * Never throws.
 */
export function hydrateProject(
  raw: RecentDeal | Record<string, unknown> | null | undefined,
  context: HydrateProjectContext = {}
): HydratedProject {
  try {
    const adapted = adaptProjectInput(raw);
    if (!adapted) return emptyHydratedProject();

    const participants = context.participants ?? [];
    const configuredCount = countConfiguredParticipants(participants);
    const total = participants.length;
    const phase = detectProjectPhase(adapted);
    const setupStatus = String(
      adapted.setupStatus ?? adapted.operationalCompleteness ?? 'configuring'
    );

    return {
      id: adapted.id,
      identity: {
        name: adapted.dealName,
        partner: adapted.partner,
        currency: 'AUD',
      },
      lifecycle: {
        setupStatus,
        operationalCompleteness: adapted.operationalCompleteness
          ? String(adapted.operationalCompleteness)
          : undefined,
        phase,
      },
      treasury: {
        health: context.treasuryHealth ?? 'funding_pending',
        confirmedFunding: context.confirmedFunding ?? 0,
        obligationsTotal: context.obligationsTotal ?? 0,
        participantCount: total,
        configuredParticipantCount: configuredCount,
      },
      operational: {
        needsEarningsConfiguration: total > 0 && configuredCount < total,
        payoutReleaseEligible: phase === 'ready' && configuredCount === total && total > 0,
        needsAttention: total === 0 || configuredCount < total,
      },
      metadata: {
        contractVersion: PROJECT_CONTRACT_VERSION,
        source: setupStatus === 'configuring' ? 'draft' : 'hydrated',
        updatedAt: adapted.lastUpdated,
      },
    };
  } catch (error) {
    const id =
      raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string'
        ? raw.id
        : undefined;
    warnHydrationFailure('project', id, error);
    return emptyHydratedProject();
  }
}
