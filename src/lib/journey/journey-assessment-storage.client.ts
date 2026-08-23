'use client';

const OBJECTIVE_KEY = 'provvy.objective';
const BUSINESS_KEY = 'provvy.business';
const PROVISIONING_PENDING_KEY = 'provvy.journey.provisioningPending';

export type JourneyAssessmentBusiness = {
  industry?: string;
  size?: string;
  accounting?: string;
  challenge?: string;
  systems?: string[];
};

export type JourneyAssessmentSnapshot = {
  objective: string | null;
  business: JourneyAssessmentBusiness | null;
};

export type JourneyAssessmentContextPayload = {
  source: 'journey_assessment';
  objective: string | null;
  business: JourneyAssessmentBusiness | null;
  /** @deprecated No longer written. Old snapshots may still include this. */
  recommendedWorkflow?: string;
};

function readStorageItem(key: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;

    const localValue = localStorage.getItem(key);
    if (localValue) {
      sessionStorage.setItem(key, localValue);
      return localValue;
    }
  } catch {
    /* ignore storage errors */
  }

  return null;
}

function writeStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
  } catch {
    /* ignore storage errors */
  }
}

/** Merge any localStorage assessment snapshot back into sessionStorage after redirects/refreshes. */
export function restoreJourneyAssessment(): JourneyAssessmentSnapshot {
  return readJourneyAssessment();
}

export function persistJourneyObjective(objective: string): void {
  writeStorageItem(OBJECTIVE_KEY, objective);
}

export function persistJourneyBusiness(business: JourneyAssessmentBusiness): void {
  writeStorageItem(BUSINESS_KEY, JSON.stringify(business));
}

export function readJourneyAssessment(): JourneyAssessmentSnapshot {
  if (typeof window === 'undefined') {
    return { objective: null, business: null };
  }

  try {
    const objective = readStorageItem(OBJECTIVE_KEY);
    const businessRaw = readStorageItem(BUSINESS_KEY);
    const business = businessRaw ? (JSON.parse(businessRaw) as JourneyAssessmentBusiness) : null;
    return { objective, business };
  } catch {
    return { objective: null, business: null };
  }
}

export function hasJourneyAssessmentData(snapshot: JourneyAssessmentSnapshot = readJourneyAssessment()): boolean {
  return Boolean(snapshot.objective || snapshot.business);
}

/** Mark that auth/provisioning should resume on return from OAuth or a refresh. */
export function markJourneyProvisioningPending(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROVISIONING_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function isJourneyProvisioningPending(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PROVISIONING_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearJourneyProvisioningPending(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PROVISIONING_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function journeyWorkspaceNameFromAssessment(
  business: JourneyAssessmentBusiness | null,
  email?: string
): string {
  const industry = business?.industry?.trim();
  if (industry) {
    return industry.length <= 255 ? industry : industry.slice(0, 255);
  }

  const localPart = email?.split('@')[0]?.trim();
  if (localPart && localPart.length >= 2) {
    return `${localPart}'s workspace`.slice(0, 255);
  }

  return 'My Commercial OS';
}

export function journeyAssessmentContext(
  objective: string | null,
  business: JourneyAssessmentBusiness | null
): string {
  return JSON.stringify({
    source: 'journey_assessment',
    objective,
    business,
  } satisfies JourneyAssessmentContextPayload);
}

export function parseJourneyAssessmentContext(
  onboardingContext: string | undefined | null
): JourneyAssessmentContextPayload | null {
  if (!onboardingContext?.trim()) return null;

  try {
    const parsed = JSON.parse(onboardingContext) as JourneyAssessmentContextPayload;
    if (parsed.source !== 'journey_assessment') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function journeyAssessmentsMatch(
  saved: JourneyAssessmentContextPayload | null,
  objective: string | null,
  business: JourneyAssessmentBusiness | null
): boolean {
  if (!saved) return false;
  return (
    saved.objective === objective && JSON.stringify(saved.business) === JSON.stringify(business)
  );
}
