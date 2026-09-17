/**
 * Business Digital Passport — alternative-rail onboarding information readiness.
 *
 * This is not a generic identity product and not a provider-approval score.
 * Percentages mean: how many onboarding-prep requirements Provvy already has
 * information for, based on organisation-scoped evidence currently on hand.
 */

export const INFORMATION_READINESS_DISCLAIMER =
  'This percentage is information readiness based on what Provvy already has. It is not a prediction of provider approval.';

export type EvidenceStatus = 'verified' | 'available' | 'missing' | 'stale' | 'unknown';

export const ONBOARDING_REQUIREMENT_IDS = [
  'business_registration',
  'business_identity',
  'business_address',
  'business_activity',
  'settlement_information',
  'director_verification',
  'proof_of_business_address',
] as const;

export type OnboardingRequirementId = (typeof ONBOARDING_REQUIREMENT_IDS)[number];

export type OnboardingRequirement = {
  id: OnboardingRequirementId;
  label: string;
  description: string;
};

export type RequirementMatch = {
  requirementId: OnboardingRequirementId;
  label: string;
  status: EvidenceStatus;
  source: string | null;
  explanation: string;
};

/**
 * Read-only snapshot of organisation-scoped facts the matcher may consult.
 *
 * Fields that Provvy does not store at organisation level (registration number,
 * address, directors, proof of address) must remain unset in production collectors.
 * Test fixtures may populate them; production adapters must not invent them.
 */
export type OrganizationEvidenceSnapshot = {
  organizationId: string;
  organizationName: string | null;
  displayName: string | null;
  industry: string | null;
  defaultCurrency: string | null;
  enabledCurrencies: string[];
  airwallexConfigured: boolean;
  wiseProfileId: string | null;
  stripeAccountId: string | null;
  xeroConnected: boolean;
  registrationNumber?: string | null;
  businessAddress?: string | null;
  directorVerificationAt?: string | null;
  proofOfBusinessAddress?: string | null;
};

export type RailOnboardingReadiness = {
  organizationId: string;
  offeringId: string;
  offeringLabel: string;
  providerName: string;
  percent: number;
  presentCount: number;
  applicableCount: number;
  unknownCount: number;
  rows: RequirementMatch[];
  complete: RequirementMatch[];
  stillRequired: RequirementMatch[];
  notAssessed: RequirementMatch[];
  notes: string[];
  disclaimer: string;
  assessedAt: string;
};

export type AdvisorOfferingRef = {
  offeringId: string;
  providerId?: string;
  providerName: string;
};
