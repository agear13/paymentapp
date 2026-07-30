'use client';

/**
 * Single agreement currency for the Hackathon Journey workflow demo.
 * Reuses extracted commercial terms — no hardcoded demo currency.
 */

import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { hasRevenueSharePct } from '@/lib/ai-extractor/party-obligation-metrics';
import { resolveReviewFormCurrency } from '@/lib/currency/resolve-review-form-currency';
import { isHackathonJourneyEnabled } from '@/lib/journey/hackathon-journey';

export type WorkflowAgreementCommercial = {
  currency: string;
  amount: number;
};

export type WorkflowHeaderParticipant = {
  name: string;
  role: string;
};

export type WorkflowHeaderDisplay = {
  name: string;
  objective: string;
  participants: WorkflowHeaderParticipant[];
  commercialValueLabel: string;
  commercialValueDetail: string;
  hasLiveAgreement: boolean;
};

export function resolveWorkflowAgreementCurrency(
  result: Pick<ExtractionResult, 'currency'> | null | undefined,
  fallback = 'AUD',
): string {
  if (!result) return fallback.toUpperCase();
  return resolveReviewFormCurrency({
    extractedCurrency: result.currency?.value,
    extractedConfidence: result.currency?.confidence,
  });
}

export function resolveWorkflowAgreementAmount(
  result: Pick<ExtractionResult, 'projectValue'> | null | undefined,
  fallback = 0,
): number {
  const value = result?.projectValue?.value;
  if (typeof value === 'number' && value > 0) return value;
  return fallback;
}

export function toWorkflowProjectValueCurrency(currency: string): 'AUD' | 'USD' {
  return currency.trim().toUpperCase() === 'USD' ? 'USD' : 'AUD';
}

export function formatWorkflowAgreementMoney(amount: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  if (code === 'AUD') {
    return `A$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  if (code === 'USD') {
    return `US$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `${code} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** Agreement commercial terms when hackathon demo has an imported snapshot. */
export function resolveHackathonWorkflowCommercial(
  result: ExtractionResult | null | undefined,
  staticFallback: WorkflowAgreementCommercial,
): WorkflowAgreementCommercial | null {
  if (!isHackathonJourneyEnabled() || !result) return null;
  return {
    currency: resolveWorkflowAgreementCurrency(result, staticFallback.currency),
    amount: resolveWorkflowAgreementAmount(result, staticFallback.amount),
  };
}

function participantHasVariableCompensation(party: ExtractionResult['parties'][number]): boolean {
  return (
    party.participationModel.value === 'revenue_share' ||
    party.participationModel.value === 'hybrid' ||
    party.participationModel.value === 'customer_attribution' ||
    hasRevenueSharePct(party)
  );
}

/** Presentation-layer header derived from imported extraction, with static demo fallback. */
export function deriveWorkflowHeaderDisplay(
  snapshot: { result: ExtractionResult; dealName: string } | null,
  staticFallback: {
    name: string;
    objective: string;
    participants: WorkflowHeaderParticipant[];
    currency: string;
    amount: number;
  },
): WorkflowHeaderDisplay {
  const staticCurrency = staticFallback.currency.startsWith('A$')
    ? 'AUD'
    : staticFallback.currency.startsWith('US$')
      ? 'USD'
      : staticFallback.currency;
  const staticCommercialLabel = formatWorkflowAgreementMoney(
    staticFallback.amount,
    staticCurrency,
  );

  if (!snapshot) {
    return {
      name: staticFallback.name,
      objective: staticFallback.objective,
      participants: staticFallback.participants,
      commercialValueLabel: staticCommercialLabel,
      commercialValueDetail: `across ${Math.max(0, staticFallback.participants.length - 1)} allocations`,
      hasLiveAgreement: false,
    };
  }

  const { result, dealName } = snapshot;
  const currency = resolveWorkflowAgreementCurrency(result, staticCurrency);
  const rawProjectValue = result.projectValue.value;
  const hasExtractedValue = typeof rawProjectValue === 'number' && rawProjectValue > 0;
  const amount = hasExtractedValue ? rawProjectValue : 0;
  const formatMoney = (value: number) => formatWorkflowAgreementMoney(value, currency);

  const name =
    result.projectName.value?.trim() ||
    dealName.trim() ||
    staticFallback.name;

  const participants =
    result.parties.length > 0
      ? result.parties.map((party) => ({
          name: party.name.value?.trim() || 'Unnamed participant',
          role: party.role.value?.trim() || 'Participant',
        }))
      : staticFallback.participants;

  const variableTermCount = result.parties.filter(participantHasVariableCompensation).length;
  const participantCount = participants.length;

  const commercialValueDetail =
    variableTermCount > 0
      ? `Contracted value · ${variableTermCount} variable term${variableTermCount === 1 ? '' : 's'} excluded`
      : participantCount > 1
        ? `across ${participantCount} commercial participants`
        : 'contracted commercial value';

  const objective =
    hasExtractedValue && participantCount > 0
      ? `Collect, allocate and reconcile ${formatMoney(amount)} across ${participantCount} commercial participant${participantCount === 1 ? '' : 's'}`
      : `Commercial workflow for ${name}`;

  return {
    name,
    objective,
    participants,
    commercialValueLabel: hasExtractedValue
      ? formatMoney(amount)
      : staticCommercialLabel,
    commercialValueDetail,
    hasLiveAgreement: true,
  };
}
