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
  milestoneConditionLabel: string;
  source: 'payment_term' | 'percentage' | 'fixed_fallback';
};

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function dedupeRepeatedPhrases(text: string): string {
  let normalized = normalizeWhitespace(text);
  const ticketPattern =
    /2,?000\s+(?:paid\s+and\s+)?validated\s+ticket\s+sales(?:\s+reached)?/gi;
  const ticketMatches = normalized.match(ticketPattern) ?? [];
  if (ticketMatches.length > 1) {
    let seen = false;
    normalized = normalized.replace(ticketPattern, (match) => {
      if (seen) return '';
      seen = true;
      return match.replace(/\s+reached$/i, '');
    });
  }
  return normalizeWhitespace(normalized.replace(/\breached\s+reached\b/gi, 'reached'));
}

/** Concise milestone copy for Stage 5 panels — display layer only. */
export function formatHackathonMilestoneDisplayLabel(
  description: string | null | undefined,
  dueCondition: string | null | undefined,
): string {
  const descriptionText = normalizeWhitespace(description ?? '');
  const dueText = normalizeWhitespace(dueCondition ?? '');
  const combined = dedupeRepeatedPhrases(`${descriptionText} ${dueText}`.trim());

  const pctMatch =
    combined.match(/(\d{1,3})\s*%/) ??
    descriptionText.match(/(\d{1,3})\s*%/) ??
    dueText.match(/(\d{1,3})\s*%/);
  const pct = pctMatch?.[1];

  const ticketMatch = combined.match(/2,?000\s+(?:paid\s+and\s+)?validated\s+ticket\s+sales/i);
  const hasTicketTrigger = Boolean(ticketMatch);

  if (pct && hasTicketTrigger) {
    return `${pct}% milestone payment when 2,000 validated ticket sales are reached`;
  }

  if (pct) {
    const trigger = dueText
      .replace(/^\s*when\s+/i, '')
      .replace(/^\s*upon\s+/i, '')
      .replace(/\s+reached$/i, '')
      .trim();
    if (trigger && !descriptionText.toLowerCase().includes(trigger.toLowerCase())) {
      return `${pct}% milestone payment when ${trigger}`;
    }
    const cleaned = dedupeRepeatedPhrases(
      descriptionText.replace(/\binstalment\b/gi, 'milestone payment'),
    );
    if (cleaned) return cleaned;
    return `${pct}% milestone payment`;
  }

  if (combined) {
    return dedupeRepeatedPhrases(combined.replace(/\binstalment\b/gi, 'milestone payment'));
  }

  return '40% milestone payment when 2,000 validated ticket sales are reached';
}

/** Past-tense condition copy for "Contractual condition satisfied" in Stage 5. */
export function formatMilestoneConditionSatisfiedLabel(
  label: string | null | undefined,
): string {
  let text = normalizeWhitespace(label ?? '');
  if (!text) return 'Agreement milestone criteria met.';

  text = text.replace(/^\s*once\s+/i, '');
  text = text.replace(/^\s*when\s+/i, '');
  text = text.replace(/\s+have been reached\.?$/i, ' reached');
  text = text.replace(/\s+are reached\.?$/i, ' reached');
  if (!/\breached\.?$/i.test(text)) {
    text = `${text} reached`;
  }
  text = text.replace(/\breached\.?$/i, 'reached.');
  return text;
}

function milestoneLabelsFromTerm(term: {
  description: { value: string | null };
  dueCondition: { value: string | null };
}): { milestoneLabel: string; milestoneConditionLabel: string } {
  const description = term.description.value;
  const due = term.dueCondition.value;
  const milestoneLabel = formatHackathonMilestoneDisplayLabel(description, due);
  const rawCondition = due?.trim()
    ? dedupeRepeatedPhrases(due.replace(/\binstalment\b/gi, 'milestone payment'))
    : milestoneLabel;
  const milestoneConditionLabel = formatMilestoneConditionSatisfiedLabel(rawCondition);
  return { milestoneLabel, milestoneConditionLabel };
}

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
    const labels = milestoneLabelsFromTerm(term);
    if (!looksLikeTicketMilestoneTerm(text)) continue;
    const amount = term.amount.value;
    const pctInText = text.match(/(\d{1,3})\s*%/);
    const amountLooksLikePct =
      typeof amount === 'number' &&
      amount > 0 &&
      amount <= 100 &&
      pctInText != null &&
      Number(pctInText[1]) === amount;

    if (amountLooksLikePct) {
      const derived = Math.round(projectValue * (amount / 100));
      return {
        amount: derived,
        amountLabel: formatWorkflowAgreementMoney(derived, agreementCurrency),
        milestoneLabel: labels.milestoneLabel,
        milestoneConditionLabel: labels.milestoneConditionLabel,
        source: 'percentage',
      };
    }

    if (typeof amount === 'number' && amount > 0) {
      return {
        amount,
        amountLabel: formatWorkflowAgreementMoney(amount, agreementCurrency),
        milestoneLabel: labels.milestoneLabel,
        milestoneConditionLabel: labels.milestoneConditionLabel,
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
          milestoneLabel: labels.milestoneLabel,
          milestoneConditionLabel: labels.milestoneConditionLabel,
          source: 'percentage',
        };
      }
    }
  }

  if (paymentTerms.length >= 2) {
    const middle = paymentTerms[1];
    const middleAmount = middle?.amount.value;
    const middleText = termText(middle);
    const labels = milestoneLabelsFromTerm(middle);
    const pctInText = middleText.match(/(\d{1,3})\s*%/);
    const middleLooksLikePct =
      typeof middleAmount === 'number' &&
      middleAmount > 0 &&
      middleAmount <= 100 &&
      pctInText != null &&
      Number(pctInText[1]) === middleAmount;

    if (middleLooksLikePct) {
      const derived = Math.round(projectValue * (middleAmount / 100));
      return {
        amount: derived,
        amountLabel: formatWorkflowAgreementMoney(derived, agreementCurrency),
        milestoneLabel: labels.milestoneLabel,
        milestoneConditionLabel: labels.milestoneConditionLabel,
        source: 'percentage',
      };
    }

    if (typeof middleAmount === 'number' && middleAmount > 0) {
      return {
        amount: middleAmount,
        amountLabel: formatWorkflowAgreementMoney(middleAmount, agreementCurrency),
        milestoneLabel: labels.milestoneLabel,
        milestoneConditionLabel: labels.milestoneConditionLabel,
        source: 'payment_term',
      };
    }
  }

  const fallbackAmount = Math.round(projectValue * HACKATHON_MILESTONE_FALLBACK_PCT);
  const fallbackLabel = formatHackathonMilestoneDisplayLabel(
    '40% milestone payment',
    '2,000 validated ticket sales reached',
  );
  return {
    amount: fallbackAmount,
    amountLabel: formatWorkflowAgreementMoney(fallbackAmount, agreementCurrency),
    milestoneLabel: fallbackLabel,
    milestoneConditionLabel: '2,000 paid and validated ticket sales reached.',
    source: 'fixed_fallback',
  };
}

/** Explicit fallback to simulated Pinch when sandbox/env is unavailable during recording. */
export { isHackathonPinchSimulatorFallback } from '@/lib/journey/hackathon-journey';
