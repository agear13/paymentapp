import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveCommissionScope,
  type CommissionScopeContext,
} from '@/lib/operations/derivations/commission-scope';
import {
  hasPersistedCompensationTerms,
  isParticipantCompensationExempt,
} from '@/lib/operations/primitives/participant-earnings-primitives';
import { isParticipantEarningsConfigured } from '@/lib/operations/selectors/participant-earnings-selectors';

export type ParticipantEarningsPersistenceDiagnostic = {
  participantId: string;
  name: string | null;
  compensationProfileFound: boolean;
  configuredAt: string | null;
  configuredFlag: boolean | null;
  earningsStructure: {
    settlementBasis: string;
    earningsPrimary: string;
    earningsPrimaryCompact: string;
    percentage: number | null;
    fixedAmount: number | null;
  };
  selectorResult: {
    hasPersistedCompensationTerms: boolean;
    isParticipantEarningsConfigured: boolean;
    isExempt: boolean;
  };
  persisted: {
    compensationType: string | null;
    commissionValue: number | null;
    commissionKind: string | null;
    fixedAmount: number | null;
    percentage: number | null;
    approvalStatus: string | null;
    operationalStatus: string | null;
  };
};

export function buildParticipantEarningsPersistenceDiagnostic(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): ParticipantEarningsPersistenceDiagnostic {
  const profile = participant.compensationProfile;
  const scope = deriveCommissionScope(participant, context);

  return {
    participantId: participant.id,
    name: participant.name?.trim() || null,
    compensationProfileFound: profile != null,
    configuredAt: profile?.configuredAt ?? null,
    configuredFlag: profile?.configured ?? null,
    earningsStructure: {
      settlementBasis: scope.settlementBasis,
      earningsPrimary: scope.earningsPrimary,
      earningsPrimaryCompact: scope.earningsPrimary,
      percentage: profile?.percentage ?? scope.percentage ?? null,
      fixedAmount: profile?.fixedAmount ?? null,
    },
    selectorResult: {
      hasPersistedCompensationTerms: hasPersistedCompensationTerms(participant),
      isParticipantEarningsConfigured: isParticipantEarningsConfigured(participant),
      isExempt: isParticipantCompensationExempt(participant),
    },
    persisted: {
      compensationType: profile?.compensationType ?? null,
      commissionValue: participant.commissionValue ?? null,
      commissionKind: participant.commissionKind ?? null,
      fixedAmount: profile?.fixedAmount ?? null,
      percentage: profile?.percentage ?? null,
      approvalStatus: participant.approvalStatus ?? null,
      operationalStatus: participant.operationalStatus ?? null,
    },
  };
}

/** Server + dev logging — trace compensation save/retrieval vs selector convergence. */
export function logParticipantEarningsPersistenceDiagnostic(
  phase: 'save-persisted' | 'coordination-snapshot' | 'retrieval' | 'selector-audit',
  participant: DemoParticipant,
  context: CommissionScopeContext = {},
  extra?: Record<string, unknown>
): ParticipantEarningsPersistenceDiagnostic {
  const diagnostic = buildParticipantEarningsPersistenceDiagnostic(participant, context);
  console.info('[participant-earnings-persistence]', {
    phase,
    at: new Date().toISOString(),
    ...diagnostic,
    ...extra,
  });
  return diagnostic;
}
