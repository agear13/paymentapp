import { LANDING_PROVIDER_OFFERINGS } from '@/lib/journey/landing-provider-catalog';
import type { OnboardingRequirement } from '@/lib/business-passport/types';

/**
 * Provvy information-prep checklist for Airwallex business onboarding.
 * Not live Airwallex KYB. Not used by route ranking.
 */
export const AIRWALLEX_ONBOARDING_REQUIREMENTS: OnboardingRequirement[] = [
  {
    id: 'business_registration',
    label: 'Business registration',
    description: 'Organisation-level registration identifier (for example ABN or company number).',
  },
  {
    id: 'business_identity',
    label: 'Business identity',
    description: 'Legal or trading name already held for this organisation.',
  },
  {
    id: 'business_address',
    label: 'Business address',
    description: 'Registered or trading address stored for this organisation.',
  },
  {
    id: 'business_activity',
    label: 'Business activity',
    description: 'Industry or activity already recorded for this organisation.',
  },
  {
    id: 'settlement_information',
    label: 'Settlement information',
    description: 'Settlement currencies or payout configuration already held for this organisation.',
  },
  {
    id: 'director_verification',
    label: 'Director verification',
    description: 'Director or beneficial-owner verification evidence for this organisation.',
  },
  {
    id: 'proof_of_business_address',
    label: 'Proof of business address',
    description: 'Documented proof of business address for this organisation.',
  },
];

const AIRWALLEX_OFFERING_IDS = new Set(
  LANDING_PROVIDER_OFFERINGS.filter((offering) => offering.providerId === 'airwallex').map(
    (offering) => offering.id
  )
);

export function offeringHasPassportCatalog(offeringId: string): boolean {
  return AIRWALLEX_OFFERING_IDS.has(offeringId);
}

export function getOnboardingRequirements(offeringId: string): OnboardingRequirement[] | null {
  if (!offeringHasPassportCatalog(offeringId)) return null;
  return AIRWALLEX_ONBOARDING_REQUIREMENTS;
}

export function getOfferingPassportMeta(offeringId: string): {
  offeringId: string;
  offeringLabel: string;
  providerName: string;
} | null {
  const offering = LANDING_PROVIDER_OFFERINGS.find((item) => item.id === offeringId);
  if (!offering || !offeringHasPassportCatalog(offeringId)) return null;
  return {
    offeringId: offering.id,
    offeringLabel: offering.productName,
    providerName: offering.providerName,
  };
}
