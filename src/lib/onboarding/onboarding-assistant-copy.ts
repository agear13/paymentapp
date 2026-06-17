import type { AgreementIntelligenceInsight } from '@/lib/onboarding/agreement-intelligence-insights';

export type ReadinessCertainty = 'Ready' | 'Almost Ready' | 'Needs Attention' | 'Payment Setup Needed';

export type ConfidenceCertainty = 'High Confidence' | 'Review Suggested' | 'Needs Verification';

export function readinessCertaintyLabel(score: number): ReadinessCertainty {
  if (score >= 80) return 'Ready';
  if (score >= 65) return 'Almost Ready';
  if (score >= 50) return 'Needs Attention';
  return 'Payment Setup Needed';
}

export function confidenceCertaintyLabel(score: number): ConfidenceCertainty {
  if (score >= 85) return 'High Confidence';
  if (score >= 70) return 'Review Suggested';
  return 'Needs Verification';
}

/** Map internal gap strings to operator-facing actions. */
export function gapToActionLabel(gap: string): string {
  const trimmed = gap.trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes('email missing')) {
    const match = trimmed.match(/\(([^)]+)\)/);
    return match ? `Add email for ${match[1]}` : 'Add participant emails';
  }
  if (lower.includes('awaiting payout') || lower.includes('payout details')) {
    return 'Choose payout destination';
  }
  if (lower.includes('manual payout')) return 'Confirm manual payout details';
  if (lower.includes('tax')) return 'Add tax details';
  if (lower.includes('infrastructure') || lower.includes('stripe')) return 'Connect Stripe';
  if (lower.includes('settlement account')) return 'Add bank account';
  if (lower.includes('template defaults') || lower.includes('agreement defaults')) return 'Review agreement defaults';
  if (lower.includes('payment setup')) return 'Connect Stripe';

  return trimmed.replace(/\bmissing\b/gi, '').trim() || trimmed;
}

export function continueButtonLabel(nextStep: string): string {
  return `Continue → ${nextStep}`;
}

export function deriveAgreementOutcomeHighlights(
  insight: AgreementIntelligenceInsight
): string[] {
  const highlights: string[] = [];
  const participantCount = insight.participantsFound.length;

  if (participantCount > 0) {
    highlights.push(
      `Found ${participantCount} participant${participantCount === 1 ? '' : 's'}`
    );
  }

  if (insight.commercialTermsFound.some((t) => /revenue share|revenue/i.test(t))) {
    highlights.push('Revenue sharing detected');
  }

  const paymentTerms = insight.commercialTermsFound.filter((t) =>
    /payment|payout|share|commission|fee|settlement|monthly|%/i.test(t)
  );
  if (paymentTerms.length > 0) {
    highlights.push(
      `Payments identified · ${paymentTerms.length} term${paymentTerms.length === 1 ? '' : 's'}`
    );
  }

  const obligationCount = insight.obligationsIdentified.length;
  if (obligationCount > 0) {
    highlights.push(
      `Detected ${obligationCount} payment obligation${obligationCount === 1 ? '' : 's'}`
    );
  }

  if (insight.settlementSchedule && insight.settlementSchedule.length > 0) {
    highlights.push('Built payment schedule');
  } else if (
    insight.commercialTermsFound.some((t) => /monthly|days|schedule|timing/i.test(t))
  ) {
    highlights.push('Important dates found');
  }

  return highlights.slice(0, 5);
}

export function readinessImprovedLabel(
  previous: ReadinessCertainty,
  next: ReadinessCertainty
): string | null {
  if (previous === next) return null;
  return `${previous} → ${next}`;
}
