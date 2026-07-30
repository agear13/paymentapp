'use client';

import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { formatWorkflowAgreementMoney } from '@/lib/journey/workflow-agreement-currency.client';

export const HACKATHON_MILESTONE_TICKET_THRESHOLD = 2000;
export const HACKATHON_MILESTONE_TICKET_START = 1998;
export const HACKATHON_MILESTONE_FALLBACK_PCT = 0.4;

export type HackathonMilestoneCollection = {
  amount: number;
  amountLabel: string;
  milestoneLabel: string;
  source: 'payment_term' | 'percentage' | 'fixed_fallback';
};

export function deriveHackathonMilestonePaymentDueLabel(
  milestone: HackathonMilestoneCollection,
  projectValue: number,
): string {
  const fromLabel = milestone.milestoneLabel.match(/(\d{1,3})\s*%/);
  if (fromLabel) {
    return `${fromLabel[1]}% Milestone Payment Now Due`;
  }
  if (milestone.source === 'fixed_fallback') {
    return '40% Milestone Payment Now Due';
  }
  if (projectValue > 0 && milestone.amount > 0) {
    const pct = Math.round((milestone.amount / projectValue) * 100);
    if (pct > 0 && pct <= 100) {
      return `${pct}% Milestone Payment Now Due`;
    }
  }
  return `${milestone.amountLabel} Milestone Payment Now Due`;
}

function termText(term: {
  description: { value: string | null };
  dueCondition: { value: string | null };
}): string {
  return `${term.description.value ?? ''} ${term.dueCondition.value ?? ''}`.trim();
}

function looksLikeTicketMilestoneTerm(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    /ticket/.test(normalized) ||
    /validated/.test(normalized) ||
    /2,?000/.test(normalized) ||
    (/milestone/.test(normalized) && /40\s*%/.test(normalized))
  );
}

/**
 * Cheap derivation of the currently payable hackathon milestone amount.
 * Falls back to 40% of project value when extraction does not specify an amount.
 */
export function deriveHackathonMilestoneCollection(
  result: ExtractionResult | null | undefined,
  fallbackProjectAmount: number,
  agreementCurrency = 'AUD',
): HackathonMilestoneCollection {
  const projectValue =
    typeof result?.projectValue.value === 'number' && result.projectValue.value > 0
      ? result.projectValue.value
      : fallbackProjectAmount;

  const paymentTerms = result?.paymentTerms ?? [];

  for (const term of paymentTerms) {
    const text = termText(term);
    if (!looksLikeTicketMilestoneTerm(text)) continue;
    const amount = term.amount.value;
    if (typeof amount === 'number' && amount > 0) {
      return {
        amount,
        amountLabel: formatWorkflowAgreementMoney(amount, agreementCurrency),
        milestoneLabel: text || '40% milestone · 2,000 validated ticket sales',
        source: 'payment_term',
      };
    }
    const pctMatch = text.match(/(\d{1,3})\s*%/);
    if (pctMatch) {
      const pct = Number(pctMatch[1]) / 100;
      if (pct > 0 && pct <= 1) {
        const derived = Math.round(projectValue * pct);
        return {
          amount: derived,
          amountLabel: formatWorkflowAgreementMoney(derived, agreementCurrency),
          milestoneLabel: text || `${pctMatch[1]}% milestone payment`,
          source: 'percentage',
        };
      }
    }
  }

  if (paymentTerms.length >= 2) {
    const middle = paymentTerms[1];
    const middleAmount = middle?.amount.value;
    if (typeof middleAmount === 'number' && middleAmount > 0) {
      const text = termText(middle);
      return {
        amount: middleAmount,
        amountLabel: formatWorkflowAgreementMoney(middleAmount, agreementCurrency),
        milestoneLabel: text || 'Second milestone payment',
        source: 'payment_term',
      };
    }
  }

  const fallbackAmount = Math.round(projectValue * HACKATHON_MILESTONE_FALLBACK_PCT);
  return {
    amount: fallbackAmount,
    amountLabel: formatWorkflowAgreementMoney(fallbackAmount, agreementCurrency),
    milestoneLabel: '40% milestone · 2,000 validated ticket sales',
    source: 'fixed_fallback',
  };
}

/** Explicit fallback to simulated Pinch when sandbox/env is unavailable during recording. */
export { isHackathonPinchSimulatorFallback } from '@/lib/journey/hackathon-journey';
