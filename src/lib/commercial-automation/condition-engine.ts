/**
 * Condition Engine — evaluate whether automation rules should execute.
 *
 * Conditions derive from commercial model state — never fabricated.
 */

import { CommercialForecastConfidence } from '@/lib/commercial-forecasting/types';
import {
  CommercialConditionKind,
  type CommercialAutomationInput,
  type CommercialCondition,
  type ConditionEvaluationResult,
} from '@/lib/commercial-automation/types';

function evaluateSingleCondition(
  condition: CommercialCondition,
  input: CommercialAutomationInput
): ConditionEvaluationResult {
  const { kind, params } = condition;

  switch (kind) {
    case CommercialConditionKind.AgreementApproved: {
      const approved = input.participants?.some((p) => p.agreementApproved) ?? false;
      return {
        kind,
        satisfied: approved,
        reason: approved ? 'Agreement approved' : 'Agreement not yet approved',
      };
    }

    case CommercialConditionKind.ParticipantApproved: {
      const participantId = params?.participantId as string | undefined;
      const participant = participantId
        ? input.participants?.find((p) => p.participantId === participantId)
        : input.participants?.[0];
      const satisfied = participant?.agreementApproved ?? false;
      return {
        kind,
        satisfied,
        reason: satisfied
          ? `${participant?.participantName ?? 'Participant'} approved`
          : 'Participant not approved',
      };
    }

    case CommercialConditionKind.PayoutDetailsMissing: {
      const missing = input.participants?.filter(
        (p) => p.agreementApproved && !p.payoutDetailsSubmitted
      );
      const satisfied = (missing?.length ?? 0) > 0;
      return {
        kind,
        satisfied,
        reason: satisfied
          ? `${missing!.length} participant(s) missing payout details`
          : 'All payout details submitted',
      };
    }

    case CommercialConditionKind.InvoiceOutstanding: {
      const outstanding = input.invoices?.filter((i) => i.outstanding) ?? [];
      const satisfied = outstanding.length > 0;
      return {
        kind,
        satisfied,
        reason: satisfied
          ? `${outstanding.length} invoice(s) outstanding`
          : 'No outstanding invoices',
      };
    }

    case CommercialConditionKind.PaymentLate: {
      const daysThreshold = (params?.days as number) ?? 7;
      const late = input.invoices?.filter(
        (i) => i.overdue && (i.daysOverdue ?? 0) >= daysThreshold
      ) ?? [];
      const satisfied = late.length > 0;
      return {
        kind,
        satisfied,
        reason: satisfied
          ? `${late.length} invoice(s) overdue by ${daysThreshold}+ days`
          : 'No late payments',
      };
    }

    case CommercialConditionKind.SettlementEligible: {
      const eligible = input.participants?.some(
        (p) => p.workflow?.settlement.state === 'READY'
      ) ?? false;
      return {
        kind,
        satisfied: eligible,
        reason: eligible ? 'Settlement eligible' : 'Settlement not yet eligible',
      };
    }

    case CommercialConditionKind.SettlementComplete: {
      const complete = input.participants?.every(
        (p) => p.workflow?.settlement.state === 'COMPLETE'
      ) ?? false;
      return {
        kind,
        satisfied: complete && (input.participants?.length ?? 0) > 0,
        reason: complete ? 'All settlements complete' : 'Settlement incomplete',
      };
    }

    case CommercialConditionKind.CommercialTimingWithinDays: {
      const days = (params?.days as number) ?? 7;
      const forecast = input.forecast;
      const upcoming = forecast?.events.filter((e) => {
        if (e.occurred) return false;
        const eventDate = new Date(e.date);
        const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
        const diffDays = (eventDate.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= days;
      }) ?? [];
      const satisfied = upcoming.length > 0;
      return {
        kind,
        satisfied,
        reason: satisfied
          ? `${upcoming.length} commercial event(s) within ${days} days`
          : `No events within ${days} days`,
      };
    }

    case CommercialConditionKind.ForecastConfidenceAboveThreshold: {
      const threshold = (params?.threshold as string) ?? CommercialForecastConfidence.Expected;
      const rank: Record<CommercialForecastConfidence, number> = {
        [CommercialForecastConfidence.Tentative]: 1,
        [CommercialForecastConfidence.Expected]: 2,
        [CommercialForecastConfidence.Likely]: 3,
        [CommercialForecastConfidence.Committed]: 4,
      };
      const current = input.forecast?.overallConfidence ?? CommercialForecastConfidence.Tentative;
      const satisfied = rank[current] >= rank[threshold as CommercialForecastConfidence];
      return {
        kind,
        satisfied,
        reason: satisfied
          ? `Forecast confidence ${current} meets threshold`
          : `Forecast confidence ${current} below threshold`,
      };
    }

    case CommercialConditionKind.OutstandingObligations: {
      const obligations = input.forecastingInput?.obligationRows.filter(
        (r) => r.status !== 'SETTLED' && r.status !== 'PAID'
      ) ?? [];
      const satisfied = obligations.length > 0;
      return {
        kind,
        satisfied,
        reason: satisfied
          ? `${obligations.length} outstanding obligation(s)`
          : 'No outstanding obligations',
      };
    }

    case CommercialConditionKind.OutstandingApprovals: {
      const pending = input.participants?.filter((p) => !p.agreementApproved) ?? [];
      const satisfied = pending.length > 0;
      return {
        kind,
        satisfied,
        reason: satisfied
          ? `${pending.length} approval(s) pending`
          : 'All approvals complete',
      };
    }

    case CommercialConditionKind.AccountingSyncComplete: {
      const synced = input.participants?.some(
        (p) => p.workflow?.accounting.state === 'SYNCED'
      ) ?? false;
      return {
        kind,
        satisfied: synced,
        reason: synced ? 'Accounting sync complete' : 'Accounting sync pending',
      };
    }

    case CommercialConditionKind.AllParticipantsApproved: {
      const allApproved =
        (input.participants?.length ?? 0) > 0 &&
        input.participants!.every((p) => p.agreementApproved);
      return {
        kind,
        satisfied: allApproved,
        reason: allApproved
          ? 'All participants approved'
          : 'Not all participants approved',
      };
    }

    default:
      return { kind, satisfied: false, reason: 'Unknown condition' };
  }
}

/** Evaluate all conditions for a rule. */
export function evaluateConditions(
  conditions: CommercialCondition[],
  input: CommercialAutomationInput,
  mode: 'all' | 'any' = 'all'
): { satisfied: boolean; results: ConditionEvaluationResult[] } {
  if (conditions.length === 0) {
    return { satisfied: true, results: [] };
  }

  const results = conditions.map((c) => evaluateSingleCondition(c, input));
  const satisfied =
    mode === 'all'
      ? results.every((r) => r.satisfied)
      : results.some((r) => r.satisfied);

  return { satisfied, results };
}
