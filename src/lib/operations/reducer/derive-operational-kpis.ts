import type { CanonicalOperationalState, OperationalKPIs } from '@/lib/operations/reducer/types';

/** Single KPI engine — all KPI cards must consume this output only. */
export function deriveOperationalKPIs(state: CanonicalOperationalState): OperationalKPIs {
  return { ...state.kpis };
}

export function deriveOperationalKPIsFromParticipants(
  participants: CanonicalOperationalState['participants'],
  obligations: CanonicalOperationalState['obligations'],
  releaseEligibleCount: number
): OperationalKPIs {
  const participantCount = participants.length;
  let earningsConfiguredCount = 0;
  let payoutReadyCount = 0;
  let approvedAgreementCount = 0;
  let attributionActiveCount = 0;

  for (const row of participants) {
    if (row.compensationConfigured) earningsConfiguredCount += 1;
    if (row.agreementApproved) approvedAgreementCount += 1;
    if (row.attributionActive) attributionActiveCount += 1;
    if (
      row.compensationConfigured &&
      row.agreementApproved &&
      row.payoutConfirmed
    ) {
      payoutReadyCount += 1;
    }
  }

  const fundedObligationCount = obligations.filter(
    (o) =>
      o.obligation.operational.releaseReady ||
      o.obligation.readiness === 'ready' ||
      (o.obligation.amountFunded ?? 0) > 0
  ).length;

  return {
    participantCount,
    earningsConfiguredCount,
    payoutReadyCount,
    approvedAgreementCount,
    fundedObligationCount,
    releaseEligibleCount,
    attributionActiveCount,
    obligationCount: obligations.length,
    participantsConfigured:
      participantCount > 0 && earningsConfiguredCount >= participantCount,
  };
}
