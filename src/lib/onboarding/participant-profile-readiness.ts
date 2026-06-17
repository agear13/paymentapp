import type { OnboardingDraftParticipant } from '@/components/onboarding/onboarding-participant-card';

export type PreferredPaymentMethod =
  | 'bank_account'
  | 'wallet'
  | 'stripe_connect'
  | 'manual'
  | 'revenue_share_only';

export type ParticipantProfileStatus = {
  contactable: boolean;
  paymentLabel: string;
  paymentWarning: boolean;
  taxLabel: string;
  taxWarning: boolean;
};

export type NotesInterpretation = {
  inferredPaymentMethod?: PreferredPaymentMethod;
  taxStatus?: 'pending_verification' | 'supplied_separately';
  onboarded?: boolean;
  retainedNote?: string;
};

const PAYMENT_METHOD_LABELS: Record<PreferredPaymentMethod, string> = {
  bank_account: 'Bank transfer — invitation pending',
  wallet: 'Stablecoin — awaiting payout details',
  stripe_connect: 'Stripe — setup pending',
  manual: 'Manual payout — awaiting payout details',
  revenue_share_only: 'Revenue share — tracked via agreement',
};

export function interpretParticipantNotes(notes?: string | null): NotesInterpretation {
  const raw = notes?.trim() ?? '';
  if (!raw) return {};

  const text = raw.toLowerCase();
  const result: NotesInterpretation = {};

  if (/wise|manual|bank transfer|bank account|eft|wire/.test(text)) {
    result.inferredPaymentMethod = /wise/.test(text) ? 'manual' : 'bank_account';
    if (/manual|wise|transfer/.test(text)) result.inferredPaymentMethod = 'manual';
  }
  if (/stripe connect|stripe payout|stripe/.test(text)) {
    result.inferredPaymentMethod = 'stripe_connect';
  }
  if (/wallet|crypto|usdc|usdt|hedera/.test(text)) {
    result.inferredPaymentMethod = 'wallet';
  }
  if (/abn|gst|tax|w-9|w9|vat/.test(text)) {
    if (/supplied separately|pending|later|separate|awaiting/.test(text)) {
      result.taxStatus = 'supplied_separately';
    }
  }
  if (/already onboarded|onboarded|existing supplier/.test(text)) {
    result.onboarded = true;
  }

  if (
    !result.inferredPaymentMethod &&
    !result.taxStatus &&
    !result.onboarded &&
    raw.length > 0
  ) {
    result.retainedNote = raw;
  }

  return result;
}

export function effectivePaymentMethod(
  participant: OnboardingDraftParticipant
): PreferredPaymentMethod | undefined {
  if (participant.preferredPaymentMethod) return participant.preferredPaymentMethod;
  return interpretParticipantNotes(participant.notes).inferredPaymentMethod;
}

export function hasTaxCoverage(participant: OnboardingDraftParticipant): boolean {
  if (participant.taxIdentifier?.trim()) return true;
  const notes = interpretParticipantNotes(participant.notes);
  return notes.taxStatus === 'supplied_separately' || notes.onboarded === true;
}

export function deriveParticipantProfileStatus(
  participant: OnboardingDraftParticipant
): ParticipantProfileStatus {
  const email = participant.email?.trim();
  const paymentMethod = effectivePaymentMethod(participant);
  const notes = interpretParticipantNotes(participant.notes);
  const taxOk = hasTaxCoverage(participant);

  let paymentLabel = 'Payment details missing';
  let paymentWarning = true;

  if (paymentMethod) {
    paymentWarning = false;
    paymentLabel =
      paymentMethod === 'manual'
        ? notes.inferredPaymentMethod && /wise/i.test(participant.notes ?? '')
          ? 'Wise transfer — manual verification required'
          : PAYMENT_METHOD_LABELS.manual
        : PAYMENT_METHOD_LABELS[paymentMethod];
  } else if (notes.onboarded) {
    paymentLabel = 'Existing supplier — confirm payout route';
    paymentWarning = true;
  }

  let taxLabel = 'Tax details missing';
  let taxWarning = true;
  if (taxOk) {
    taxWarning = false;
    taxLabel = participant.taxIdentifier?.trim()
      ? 'Tax identifier on file'
      : 'Tax status — pending verification';
  }

  return {
    contactable: Boolean(email),
    paymentLabel,
    paymentWarning,
    taxLabel,
    taxWarning,
  };
}

export function derivePotentialGapsFromProfiles(
  participants: OnboardingDraftParticipant[],
  options?: { includeInfrastructure?: boolean }
): string[] {
  const gaps: string[] = [];
  const includeInfrastructure = options?.includeInfrastructure ?? true;

  const missingEmail = participants.filter((p) => !p.email?.trim());
  if (missingEmail.length > 0) {
    gaps.push(
      missingEmail.length === 1
        ? `Participant email missing (${missingEmail[0]!.name})`
        : 'Participant email missing'
    );
  }

  const missingPayment = participants.filter(
    (p) => !effectivePaymentMethod(p)
  );
  if (missingPayment.length > 0) {
    gaps.push('Awaiting payout details');
  } else if (participants.some((p) => effectivePaymentMethod(p) === 'manual')) {
    gaps.push('Manual payout verification required');
  }

  const missingTax = participants.filter((p) => !hasTaxCoverage(p));
  if (missingTax.length > 0) {
    gaps.push('Tax information missing');
  }

  if (includeInfrastructure) {
    gaps.push('Payment setup not connected');
  }

  return [...new Set(gaps)];
}

export function computeProfileReadinessScore(input: {
  participants: OnboardingDraftParticipant[];
  typeConfidence: number;
  termsCount: number;
  obligationsCount: number;
  usedExtraction: boolean;
  extractedScore?: number;
}): number {
  if (input.extractedScore != null) {
    return Math.max(0, Math.min(89, Math.round(input.extractedScore)));
  }

  const { participants } = input;
  if (participants.length === 0) return 45;

  let score = Math.min(input.typeConfidence, 88);

  const emailRatio =
    participants.filter((p) => p.email?.trim()).length / participants.length;
  score += Math.round(emailRatio * 8) - 4;

  const paymentRatio =
    participants.filter((p) => effectivePaymentMethod(p)).length / participants.length;
  score += Math.round(paymentRatio * 10) - 5;

  const taxRatio =
    participants.filter((p) => hasTaxCoverage(p)).length / participants.length;
  score += Math.round(taxRatio * 6) - 3;

  if (input.obligationsCount >= 2) score += 2;
  if (input.termsCount >= 2) score += 2;
  if (input.usedExtraction) score += 2;

  return Math.max(45, Math.min(89, Math.round(score)));
}

export function formatDefaultCommercialTerm(term: string): string {
  const trimmed = term.trim();
  if (/^default[:\s]/i.test(trimmed)) return trimmed;
  return `Default: ${trimmed}`;
}

export function templateParticipantPlaceholderName(index: number): string {
  return `Participant ${index + 1}`;
}
