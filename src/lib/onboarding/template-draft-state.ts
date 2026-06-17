import type { OnboardingDraftParticipant } from '@/components/onboarding/onboarding-participant-card';
import {
  effectivePaymentMethod,
  formatDefaultCommercialTerm,
} from '@/lib/onboarding/participant-profile-readiness';

export type TemplateSetupProgress = {
  participantsComplete: boolean;
  commercialTermsComplete: boolean;
  settlementRulesComplete: boolean;
};

export function isPlaceholderParticipantName(name: string): boolean {
  return /^Participant \d+$/i.test(name.trim());
}

export function hasCustomisedParticipantNames(
  participants: OnboardingDraftParticipant[]
): boolean {
  return participants.some((p) => p.name.trim() && !isPlaceholderParticipantName(p.name));
}

export function formatTemplateCommercialTerm(
  original: string,
  current: string
): { display: string; isUntouchedDefault: boolean } {
  const trimmedCurrent = current.trim();
  const unchanged = trimmedCurrent === original.trim();
  return {
    display: unchanged ? formatDefaultCommercialTerm(original) : trimmedCurrent,
    isUntouchedDefault: unchanged,
  };
}

export function buildDisplayCommercialTerms(
  originals: string[],
  currents: string[]
): string[] {
  return originals.map((original, index) =>
    formatTemplateCommercialTerm(original, currents[index] ?? original).display
  );
}

export function commercialTermIsUntouchedDefault(display: string): boolean {
  return /^default:\s*/i.test(display.trim());
}

export function deriveTemplateSetupProgress(input: {
  participants: OnboardingDraftParticipant[];
  commercialTerms: string[];
  originalCommercialTerms: string[];
}): TemplateSetupProgress {
  const participantsComplete =
    input.participants.length > 0 &&
    input.participants.every(
      (p) => p.name.trim().length > 0 && !isPlaceholderParticipantName(p.name)
    );

  const commercialTermsComplete = input.originalCommercialTerms.some(
    (original, index) => (input.commercialTerms[index] ?? original).trim() !== original.trim()
  );

  const settlementRulesComplete =
    input.participants.length > 0 &&
    input.participants.every((p) => Boolean(effectivePaymentMethod(p)));

  return {
    participantsComplete,
    commercialTermsComplete,
    settlementRulesComplete,
  };
}

export function deriveReadinessWinMessage(
  previous: OnboardingDraftParticipant[],
  next: OnboardingDraftParticipant[],
  previousScore: number,
  nextScore: number
): string | null {
  if (nextScore <= previousScore) return null;

  const addedEmail = next.some((p, i) => {
    const before = previous[i];
    return Boolean(p.email?.trim()) && !before?.email?.trim();
  });
  if (addedEmail) return 'Email added';

  const addedPayment = next.some((p, i) => {
    const before = previous[i];
    return Boolean(effectivePaymentMethod(p)) && !effectivePaymentMethod(before ?? p);
  });
  if (addedPayment) return 'Settlement information completed';

  const renamed = next.some((p, i) => {
    const before = previous[i];
    return (
      before &&
      isPlaceholderParticipantName(before.name) &&
      !isPlaceholderParticipantName(p.name)
    );
  });
  if (renamed) return 'Participant details updated';

  if (nextScore > previousScore) return 'Agreement readiness improved';
  return null;
}
