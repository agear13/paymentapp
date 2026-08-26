import type {
  ExtractedParty,
  ExtractedSettlementEvent,
  ExtractionResult,
  ObligationStatus,
  SettlementEventType,
} from './extraction-types';
import { hasFixedFeeAmount, hasRevenueSharePct } from './party-obligation-metrics';
import { collectPartyOwnedSettlementTriggers } from './party-linked-settlement';
import { isHallucinatedSettlementTrigger } from './parse-settlement-rules';

const DEFAULT_STATUS: ObligationStatus = 'pending';

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' | 'absent' = 'high') {
  return { value, confidence };
}

function buildEvent(
  party: ExtractedParty,
  type: SettlementEventType,
  partial: {
    amount?: number | null;
    percentage?: number | null;
    trigger?: string | null;
    condition?: string | null;
    status?: ObligationStatus;
  }
): ExtractedSettlementEvent {
  return {
    partyId: field(party.id),
    partyName: field(party.name.value),
    type: field(type),
    amount: field(partial.amount ?? null),
    percentage: field(partial.percentage ?? null),
    trigger: field(partial.trigger ?? null),
    condition: field(partial.condition ?? null),
    status: partial.status ?? DEFAULT_STATUS,
  };
}

function findExplicitSettlementTrigger(result: ExtractionResult, party: ExtractedParty): string | null {
  for (const trigger of collectPartyOwnedSettlementTriggers(party, result)) {
    if (!isHallucinatedSettlementTrigger(trigger)) {
      return trigger;
    }
  }
  return null;
}

export function buildSettlementEventsFromParty(
  party: ExtractedParty,
  result: ExtractionResult
): ExtractedSettlementEvent[] {
  const events: ExtractedSettlementEvent[] = [];
  const explicitTrigger = findExplicitSettlementTrigger(result, party);

  if (hasFixedFeeAmount(party)) {
    events.push(
      buildEvent(party, 'fixed_fee', {
        amount: party.fixedAmount.value,
        trigger: explicitTrigger,
        status: 'pending',
      })
    );
  }

  if (hasRevenueSharePct(party)) {
    events.push(
      buildEvent(party, 'revenue_share', {
        percentage: party.revenueSharePct.value,
        trigger: explicitTrigger,
        status: 'pending',
      })
    );
  }

  if (party.participationModel.value === 'customer_attribution') {
    events.push(
      buildEvent(party, 'attribution', {
        percentage: party.revenueSharePct.value,
        trigger: explicitTrigger,
        status: 'pending',
      })
    );
  }

  for (const conditional of party.conditionalPayments ?? []) {
    const trigger = conditional.trigger.value?.trim();
    const amount = conditional.amount.value;
    if (!trigger || amount == null) continue;
    events.push(
      buildEvent(party, 'bonus', {
        amount,
        trigger: explicitTrigger,
        condition: trigger,
        status: 'conditional',
      })
    );
  }

  return events;
}

export function buildSettlementEventsFromResult(result: ExtractionResult): ExtractedSettlementEvent[] {
  if (result.settlementEvents && result.settlementEvents.length > 0) {
    return result.settlementEvents.filter((event) => {
      const trigger = event.trigger.value;
      const condition = event.condition.value;
      return (
        !isHallucinatedSettlementTrigger(trigger) &&
        !isHallucinatedSettlementTrigger(condition)
      );
    });
  }
  return result.parties.flatMap((party) => buildSettlementEventsFromParty(party, result));
}
