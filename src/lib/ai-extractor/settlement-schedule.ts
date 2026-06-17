import type { ExtractedParty, ExtractedSettlementEvent, ExtractionResult } from './extraction-types';
import { formatCompensationTermLabel } from './migrate-extraction-schema';
import { hasFixedFeeAmount, hasRevenueSharePct, isHybridExtractedParty } from './party-obligation-metrics';

export type SettlementScheduleLine = {
  label: string;
  value: string;
  status?: string;
};

export type SettlementScheduleGroup = {
  partyId: string;
  partyName: string;
  lines: SettlementScheduleLine[];
};

function formatCurrency(amount: number, currency = 'AUD'): string {
  return `${currency} ${amount.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

function milestoneTrigger(milestone: ExtractedParty['milestones'][number]): string | null {
  const description = milestone.description.value?.trim();
  const deadline = milestone.deadline.value?.trim();
  if (!description) return null;
  return deadline ? `${description} — ${deadline}` : description;
}

function bonusLinesFromConditionalPayments(party: ExtractedParty): SettlementScheduleLine[] {
  return (party.conditionalPayments ?? []).map((payment) => ({
    label: 'Conditional Bonus',
    value: payment.amount.value != null
      ? `$${payment.amount.value.toLocaleString()} — ${payment.trigger.value}`
      : payment.trigger.value,
    status: payment.amount.confidence === 'high' ? 'conditional' : 'draft',
  }));
}

function bonusLinesFromMilestones(party: ExtractedParty): SettlementScheduleLine[] {
  return (party.milestones ?? [])
    .filter((m) => m.category.value === 'financial')
    .map((m) => {
      const description = m.description.value?.trim() ?? 'Financial milestone';
      const isBonus = /bonus|conditional|if |attendance|exceed/i.test(description);
      const trigger = milestoneTrigger(m);
      return {
        label: isBonus ? 'Conditional Bonus' : 'Settlement Trigger',
        value: trigger ?? description,
        status: m.description.confidence === 'high' ? 'pending' : 'draft',
      };
    });
}

function linesFromCompensationTerms(party: ExtractedParty, currency: string): SettlementScheduleLine[] {
  const terms = party.compensationTerms ?? [];
  if (terms.length === 0) return [];

  return terms.map((term) => ({
    label:
      term.type === 'instalment'
        ? 'Instalment'
        : term.type === 'milestone'
          ? 'Milestone'
          : term.type === 'conditional_bonus'
            ? 'Conditional Bonus'
            : term.type === 'revenue_share'
              ? 'Revenue Share'
              : 'Fixed Fee',
    value: formatCompensationTermLabel(term, currency),
    status: term.type === 'conditional_bonus' ? 'conditional' : 'pending',
  }));
}

function linesFromParty(party: ExtractedParty, currency: string): SettlementScheduleLine[] {
  const fromTerms = linesFromCompensationTerms(party, currency);
  if (fromTerms.length > 0) return fromTerms;
  const lines: SettlementScheduleLine[] = [];

  if (hasFixedFeeAmount(party)) {
    lines.push({
      label: 'Fixed Fee',
      value: formatCurrency(party.fixedAmount.value!, currency),
      status: 'pending',
    });
  }

  if (hasRevenueSharePct(party)) {
    lines.push({
      label: 'Revenue Share',
      value: `${party.revenueSharePct.value}%`,
      status: 'pending',
    });
  }

  if (party.participationModel.value === 'customer_attribution') {
    lines.push({
      label: 'Attribution',
      value: 'Customer referral earnings',
      status: 'pending',
    });
  }

  lines.push(...bonusLinesFromConditionalPayments(party));
  lines.push(...bonusLinesFromMilestones(party));

  for (const dependency of party.dependencies ?? []) {
    const obligation = dependency.obligation.value?.trim();
    const dependsOn = dependency.dependsOn.value?.trim();
    if (!obligation || !dependsOn) continue;
    lines.push({
      label: 'Dependency',
      value: `${obligation} depends on ${dependsOn}`,
      status: dependency.status ?? 'pending',
    });
  }

  if (isHybridExtractedParty(party) && lines.length >= 2) {
    return lines;
  }

  return lines;
}

function linesFromSettlementEvents(
  events: ExtractedSettlementEvent[],
  partyId: string,
  currency: string
): SettlementScheduleLine[] {
  return events
    .filter((event) => event.partyId.value === partyId)
    .map((event) => {
      const type = event.type.value;
      const label =
        type === 'fixed_fee'
          ? 'Fixed Fee'
          : type === 'revenue_share'
            ? 'Revenue Share'
            : type === 'bonus'
              ? 'Conditional Bonus'
              : type === 'attribution'
                ? 'Attribution'
                : 'Settlement';

      let value = '';
      if (event.amount.value != null) value = formatCurrency(event.amount.value, currency);
      else if (event.percentage.value != null) value = `${event.percentage.value}%`;
      if (event.trigger.value) value = value ? `${value} — ${event.trigger.value}` : event.trigger.value;
      if (event.condition.value) value = value ? `${value} (${event.condition.value})` : event.condition.value;

      return {
        label,
        value: value || 'Pending definition',
        status: event.status,
      };
    });
}

export function buildSettlementSchedule(result: ExtractionResult): SettlementScheduleGroup[] {
  const currency = result.currency.value?.trim().toUpperCase() || 'AUD';
  const events = result.settlementEvents ?? [];

  return result.parties
    .map((party) => {
      const eventLines = linesFromSettlementEvents(events, party.id, currency);
      const partyLines = eventLines.length > 0 ? eventLines : linesFromParty(party, currency);
      return {
        partyId: party.id,
        partyName: party.name.value?.trim() || 'Unnamed participant',
        lines: partyLines,
      };
    })
    .filter((group) => group.lines.length > 0);
}

export function hasSettlementScheduleContent(result: ExtractionResult): boolean {
  return buildSettlementSchedule(result).length > 0;
}
