import type {
  EvidenceStatus,
  OnboardingRequirement,
  OnboardingRequirementId,
  OrganizationEvidenceSnapshot,
  RequirementMatch,
} from '@/lib/business-passport/types';

function presentText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function statusForPresent(value: string | null | undefined): EvidenceStatus {
  return presentText(value) ? 'available' : 'missing';
}

function matchOne(
  requirement: OnboardingRequirement,
  snapshot: OrganizationEvidenceSnapshot
): RequirementMatch {
  switch (requirement.id) {
    case 'business_identity': {
      const name = presentText(snapshot.organizationName) ?? presentText(snapshot.displayName);
      return {
        requirementId: requirement.id,
        label: requirement.label,
        status: name ? 'available' : 'missing',
        source: name
          ? presentText(snapshot.organizationName)
            ? 'organizations.name'
            : 'merchant_settings.display_name'
          : null,
        explanation: name
          ? `Provvy has a business name on file (${name}). This is claimed workspace identity, not independently verified.`
          : 'No organisation or display name is on file.',
      };
    }
    case 'business_registration': {
      const registration = presentText(snapshot.registrationNumber);
      return {
        requirementId: requirement.id,
        label: requirement.label,
        status: statusForPresent(registration),
        source: registration ? 'organization.registration_number' : null,
        explanation: registration
          ? 'Provvy has an organisation-level registration identifier on file.'
          : 'Provvy does not store an organisation-level registration number (ABN/ACN or equivalent).',
      };
    }
    case 'business_address': {
      const address = presentText(snapshot.businessAddress);
      return {
        requirementId: requirement.id,
        label: requirement.label,
        status: statusForPresent(address),
        source: address ? 'organization.business_address' : null,
        explanation: address
          ? 'Provvy has an organisation-level business address on file.'
          : 'Provvy does not store an organisation-level business address.',
      };
    }
    case 'business_activity': {
      const industry = presentText(snapshot.industry);
      return {
        requirementId: requirement.id,
        label: requirement.label,
        status: industry ? 'available' : 'missing',
        source: industry ? 'operator_onboarding.workspace_industry' : null,
        explanation: industry
          ? `Provvy has industry/activity on file (${industry}). This is self-reported during setup.`
          : 'No workspace industry or activity has been recorded for this organisation.',
      };
    }
    case 'settlement_information': {
      const currency = presentText(snapshot.defaultCurrency);
      const extras = snapshot.enabledCurrencies.filter((code) => presentText(code));
      const hasSettlement = Boolean(currency) || extras.length > 0;
      return {
        requirementId: requirement.id,
        label: requirement.label,
        status: hasSettlement ? 'available' : 'missing',
        source: hasSettlement ? 'merchant_settings.currencies' : null,
        explanation: hasSettlement
          ? `Provvy has settlement currency configuration (${[currency, ...extras]
              .filter(Boolean)
              .filter((value, index, all) => all.indexOf(value) === index)
              .join(', ')}).`
          : 'No settlement currency configuration is on file for this organisation.',
      };
    }
    case 'director_verification': {
      const verifiedAt = presentText(snapshot.directorVerificationAt);
      return {
        requirementId: requirement.id,
        label: requirement.label,
        status: verifiedAt ? 'verified' : 'missing',
        source: verifiedAt ? 'organization.director_verification' : null,
        explanation: verifiedAt
          ? 'Director verification evidence is on file for this organisation.'
          : 'Provvy does not store director or beneficial-owner verification for this organisation.',
      };
    }
    case 'proof_of_business_address': {
      const proof = presentText(snapshot.proofOfBusinessAddress);
      return {
        requirementId: requirement.id,
        label: requirement.label,
        status: statusForPresent(proof),
        source: proof ? 'organization.proof_of_business_address' : null,
        explanation: proof
          ? 'Provvy has proof-of-address evidence on file for this organisation.'
          : 'Provvy does not store proof of business address for this organisation.',
      };
    }
    default: {
      const unmatched: OnboardingRequirementId = requirement.id;
      return {
        requirementId: unmatched,
        label: requirement.label,
        status: 'unknown',
        source: null,
        explanation: 'Provvy cannot evaluate this requirement from current organisation evidence.',
      };
    }
  }
}

export function matchRequirements(
  requirements: OnboardingRequirement[],
  snapshot: OrganizationEvidenceSnapshot
): RequirementMatch[] {
  return requirements.map((requirement) => matchOne(requirement, snapshot));
}

export function countsTowardPresent(status: EvidenceStatus): boolean {
  return status === 'verified' || status === 'available' || status === 'stale';
}

export function isApplicable(status: EvidenceStatus): boolean {
  return status !== 'unknown';
}
