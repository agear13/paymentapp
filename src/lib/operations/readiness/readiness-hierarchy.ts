import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalBlockerDetail } from '@/lib/operations/contracts/approval-state';
import {
  classifyParticipantCompensation,
  compensationGeneratesObligations,
} from '@/lib/operations/contracts/compensation-classification';
import { deriveCurrencyConsistencyWarnings } from '@/lib/operations/derivations/derive-currency-consistency';
import { deriveCompensationReadiness } from '@/lib/operations/readiness/compensation-readiness';
import { deriveParticipantPayoutReadiness } from '@/lib/operations/readiness/participant-readiness';
import { deriveParticipantReleaseEligibility } from '@/lib/operations/readiness/derive-participant-release-eligibility';
import {
  deriveFundingCoordinationStage,
  fundingStageBlockerMessage,
  type FundingCoordinationInput,
} from '@/lib/operations/truth/funding-coordination-semantics';

export type ReadinessLayer = 'participant' | 'obligation' | 'funding' | 'release';

export type LayerReadiness = {
  layer: ReadinessLayer;
  ready: boolean;
  blockers: string[];
  operationalBlockers: OperationalBlockerDetail[];
};

export type OperationalReadinessHierarchy = {
  participant: LayerReadiness;
  obligation: LayerReadiness;
  funding: LayerReadiness;
  release: LayerReadiness;
  currencyBlockers: OperationalBlockerDetail[];
  releaseReady: boolean;
};

export type ReadinessHierarchyInput = {
  participant: DemoParticipant;
  projectId?: string;
  funding?: FundingCoordinationInput;
  obligationCount?: number;
  obligationStatus?: string;
  catalogItems?: Array<{ id: string; name: string }>;
  projectCurrency?: string;
  serviceCurrencies?: string[];
};

function currencyBlockers(input: ReadinessHierarchyInput): OperationalBlockerDetail[] {
  const warnings = deriveCurrencyConsistencyWarnings({
    projectCurrency: input.projectCurrency,
    serviceCurrencies: input.serviceCurrencies,
    obligationCurrency: input.projectCurrency,
  });
  return warnings.map((w) => ({
    id: `currency-${w.code}`,
    severity: w.severity === 'blocking' ? 'blocking' : 'warning',
    owner: 'operator',
    ownerLabel: 'Project operator',
    requiredAction: 'Resolve currency mismatch',
    resolutionRoute: '#',
    unlocks: 'Release and obligation funding become available once currencies align.',
    explanation: w.message,
  }));
}

/** Canonical layered readiness — all UI surfaces must derive from this hierarchy. */
export function deriveOperationalReadinessHierarchy(
  input: ReadinessHierarchyInput
): OperationalReadinessHierarchy {
  const { participant, projectId } = input;
  const payout = deriveParticipantPayoutReadiness(participant);
  const comp = deriveCompensationReadiness(participant);
  const classification = classifyParticipantCompensation(participant);
  const fundingStage = input.funding
    ? deriveFundingCoordinationStage(input.funding)
    : null;

  const release = deriveParticipantReleaseEligibility(participant, {
    projectId,
    fundingAllocated: fundingStage?.releaseFunded ?? false,
    obligationStatus: input.obligationStatus,
    catalogItems: input.catalogItems,
  });

  const participantLayer: LayerReadiness = {
    layer: 'participant',
    ready: payout.payoutReady,
    blockers: payout.issues,
    operationalBlockers: release.operationalBlockers.filter(
      (b) => !b.explanation.includes('funding') && !b.explanation.includes('Funding')
    ),
  };

  const obligationLayer: LayerReadiness = {
    layer: 'obligation',
    ready:
      compensationGeneratesObligations(classification) &&
      comp.missingRequirements.length === 0 &&
      participantLayer.ready &&
      (input.obligationCount ?? 0) > 0,
    blockers: [
      ...comp.missingRequirements,
      ...(input.obligationCount === 0 ? ['Operational obligations not yet generated'] : []),
      ...(!participantLayer.ready ? ['Participant not payout-ready'] : []),
    ],
    operationalBlockers: [],
  };

  const fundingBlockers = fundingStage ? [fundingStageBlockerMessage(fundingStage)] : [];
  const fundingLayer: LayerReadiness = {
    layer: 'funding',
    ready: fundingStage?.releaseFunded === true || fundingStage?.fundingSettled === true,
    blockers: fundingBlockers.filter(Boolean) as string[],
    operationalBlockers: [],
  };

  const currency = currencyBlockers(input);
  const releaseLayer: LayerReadiness = {
    layer: 'release',
    ready: release.releaseReady && fundingLayer.ready && currency.length === 0,
    blockers: [...release.blockers, ...fundingBlockers.filter(Boolean) as string[]],
    operationalBlockers: release.operationalBlockers,
  };

  return {
    participant: participantLayer,
    obligation: obligationLayer,
    funding: fundingLayer,
    release: releaseLayer,
    currencyBlockers: currency,
    releaseReady: releaseLayer.ready,
  };
}
