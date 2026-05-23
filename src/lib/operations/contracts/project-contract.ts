import type { ProjectTreasuryHealth } from '@/lib/projects/funding-sources/types';

/** Operational project contract — presentation-safe project shape. */
export type HydratedProject = {
  id: string;
  identity: {
    name: string;
    partner: string;
    currency: string;
  };
  lifecycle: {
    setupStatus: string;
    operationalCompleteness?: string;
    phase: 'configuring' | 'ready' | 'active' | 'unknown';
  };
  treasury: {
    health: ProjectTreasuryHealth;
    confirmedFunding: number;
    obligationsTotal: number;
    participantCount: number;
    configuredParticipantCount: number;
  };
  operational: {
    needsEarningsConfiguration: boolean;
    payoutReleaseEligible: boolean;
    needsAttention: boolean;
  };
  metadata: {
    contractVersion: typeof PROJECT_CONTRACT_VERSION;
    source?: 'draft' | 'hydrated' | 'legacy';
    updatedAt?: string;
  };
};

export const PROJECT_CONTRACT_VERSION = 1 as const;
