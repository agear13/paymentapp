import type {
  ExtractedParty,
  ExtractedSettlementEvent,
  ExtractionResult,
  ObligationStatus,
  SettlementEventType,
} from './extraction-types';
import { hasFixedFeeAmount, hasRevenueSharePct } from './party-obligation-metrics';

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

export function buildSettlementEventsFromParty(party: ExtractedParty): ExtractedSettlementEvent[] {
  const events: ExtractedSettlementEvent[] = [];

  if (hasFixedFeeAmount(party)) {
    events.push(
      buildEvent(party, 'fixed_fee', {
        amount: party.fixedAmount.value,
        trigger: findSettlementTrigger(party),
        status: 'pending',
      })
    );
  }

  if (hasRevenueSharePct(party)) {
    events.push(
      buildEvent(party, 'revenue_share', {
        percentage: party.revenueSharePct.value,
        trigger: findSettlementTrigger(party),
        status: 'pending',
      })
    );
  }

  if (party.participationModel.value === 'customer_attribution') {
    events.push(
      buildEvent(party, 'attribution', {
        percentage: party.revenueSharePct.value,
        trigger: findSettlementTrigger(party),
        status: 'pending',
      })
    );
  }

  for (const milestone of party.milestones ?? []) {
    if (milestone.category.value !== 'financial') continue;
    const description = milestone.description.value?.trim() ?? '';
    const isBonus = /bonus|conditional|if |attendance|exceed/i.test(description);
    const amountMatch = description.match(/\$?\s*([\d,]+(?:\.\d+)?)/);
    events.push(
      buildEvent(party, isBonus ? 'bonus' : 'milestone', {
        amount: amountMatch ? Number(amountMatch[1]!.replace(/,/g, '')) : null,
        trigger: milestone.deadline.value,
        condition: isBonus ? description : null,
        status: isBonus ? 'conditional' : 'pending',
      })
    );
  }

  return events;
}

function findSettlementTrigger(party: ExtractedParty): string | null {
  const financial = (party.milestones ?? []).find((m) => m.category.value === 'financial');
  if (financial?.deadline.value) return financial.deadline.value;
  if (financial?.description.value) return financial.description.value;
  return null;
}

export function buildSettlementEventsFromResult(result: ExtractionResult): ExtractedSettlementEvent[] {
  if (result.settlementEvents && result.settlementEvents.length > 0) {
    return result.settlementEvents;
  }
  return result.parties.flatMap(buildSettlementEventsFromParty);
}
