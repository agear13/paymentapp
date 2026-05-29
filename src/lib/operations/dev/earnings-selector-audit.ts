import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { CommissionScopeContext } from '@/lib/operations/derivations/commission-scope';
import {
  hasPersistedCompensationTerms,
} from '@/lib/operations/primitives/participant-earnings-primitives';
import { participantRendersCommercialTerms } from '@/lib/operations/selectors/participant-earnings-selectors';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';

export class EarningsConfigurationSelectorDivergenceError extends Error {
  constructor(
    message: string,
    readonly surface: string,
    readonly participantId: string
  ) {
    super(message);
    this.name = 'EARNINGS_CONFIGURATION_SELECTOR_DIVERGENCE';
  }
}

export function assertEarningsConfigurationSelectorConvergence(
  participant: DemoParticipant,
  surface: string,
  context: CommissionScopeContext = {}
): void {
  if (process.env.NODE_ENV === 'production') return;
  const rendersTerms = participantRendersCommercialTerms(participant, context);
  const configured = hasPersistedCompensationTerms(participant);
  if (rendersTerms && !configured) {
    throw new EarningsConfigurationSelectorDivergenceError(
      'EARNINGS_CONFIGURATION_SELECTOR_DIVERGENCE: commercial terms render while earnings selector is false',
      surface,
      participant.id
    );
  }
}

export type EarningsSelectorAuditInput = {
  surface: string;
  participant: DemoParticipant;
  context?: CommissionScopeContext;
  canonicalKpis?: Partial<OperationalKPIs> | null;
};

export function logEarningsSelectorAudit(input: EarningsSelectorAuditInput): void {
  if (process.env.NODE_ENV === 'production') return;
  const entity = input.participant;
  const profile = entity.compensationProfile;
  const configured = hasPersistedCompensationTerms(entity);
  const rendersTerms = participantRendersCommercialTerms(entity, input.context);

  console.groupCollapsed('[earnings-selector]');
  console.log('at', new Date().toISOString());
  console.log('surface', input.surface);
  console.log('participantId', entity.id);
  console.log('selectorResult', { configured, rendersCommercialTerms: rendersTerms });
  console.log('persistedCompensation', {
    compensationType: profile?.compensationType ?? null,
    configured: profile?.configured ?? null,
    configuredAt: profile?.configuredAt ?? null,
    fixedAmount: profile?.fixedAmount ?? null,
    percentage: profile?.percentage ?? null,
    commissionValue: entity.commissionValue ?? null,
    commissionKind: entity.commissionKind ?? null,
    operationalStatus: entity.operationalStatus ?? null,
  });
  if (input.canonicalKpis) {
    console.log('canonicalKpis', {
      participantCount: input.canonicalKpis.participantCount,
      earningsConfiguredCount: input.canonicalKpis.earningsConfiguredCount,
      payoutReadyCount: input.canonicalKpis.payoutReadyCount,
      attributionActiveCount: input.canonicalKpis.attributionActiveCount,
      obligationCount: input.canonicalKpis.obligationCount,
    });
  }
  console.groupEnd();

  if (rendersTerms && !configured) {
    assertEarningsConfigurationSelectorConvergence(entity, input.surface, input.context);
  }
}
