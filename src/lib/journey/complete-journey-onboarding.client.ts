'use client';

import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import {
  clearJourneyProvisioningPending,
  journeyAssessmentContext,
  journeyAssessmentsMatch,
  journeyWorkspaceNameFromAssessment,
  parseJourneyAssessmentContext,
  readJourneyAssessment,
} from '@/lib/journey/journey-assessment-storage.client';
import { DEFAULT_WORKSPACE_CURRENCY } from '@/lib/currency/workspace-currencies';

type BootstrapWorkspaceResponse = {
  organizationId: string;
  merchantSettingsId?: string | null;
};

type OnboardingGetResponse = {
  hasOrganization: boolean;
  organizationId?: string;
  state?: {
    onboarding_context?: string;
    merchantSettingsId?: string;
  } | null;
};

let inFlightCompletion: Promise<BootstrapWorkspaceResponse> | null = null;

async function fetchExistingOnboarding(): Promise<OnboardingGetResponse> {
  const response = await fetch('/api/onboarding', { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to load onboarding state');
  }
  return (await response.json()) as OnboardingGetResponse;
}

async function runCompleteJourneyOnboarding(email?: string): Promise<BootstrapWorkspaceResponse> {
  const { objective, business } = readJourneyAssessment();
  const workspaceName = journeyWorkspaceNameFromAssessment(business, email);
  const assessmentContext = journeyAssessmentContext(objective, business);

  const existing = await fetchExistingOnboarding();
  if (existing.hasOrganization && existing.organizationId) {
    const savedAssessment = parseJourneyAssessmentContext(existing.state?.onboarding_context);
    if (journeyAssessmentsMatch(savedAssessment, objective, business)) {
      clearJourneyProvisioningPending();
      return {
        organizationId: existing.organizationId,
        merchantSettingsId: existing.state?.merchantSettingsId ?? null,
      };
    }
  }

  const bootstrapRes = await csrfAwareFetch('/api/onboarding/bootstrap-workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceName,
      defaultCurrency: DEFAULT_WORKSPACE_CURRENCY,
      industry: business?.industry,
      teamSize: business?.size,
    }),
  });

  const bootstrapData = (await bootstrapRes.json()) as BootstrapWorkspaceResponse & {
    error?: string;
  };

  if (!bootstrapRes.ok || !bootstrapData.organizationId) {
    throw new Error(bootstrapData.error || 'Failed to create workspace');
  }

  const assessmentRes = await csrfAwareFetch('/api/onboarding', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationId: bootstrapData.organizationId,
      state: {
        step: 'use_case',
        workspace_name: workspaceName,
        workspace_industry: business?.industry,
        workspace_team_size: business?.size,
        onboarding_context: assessmentContext,
        organizationId: bootstrapData.organizationId,
        merchantSettingsId: bootstrapData.merchantSettingsId ?? undefined,
      },
    }),
  });

  if (!assessmentRes.ok) {
    const assessmentData = (await assessmentRes.json()) as { error?: string };
    throw new Error(assessmentData.error || 'Failed to save assessment');
  }

  clearJourneyProvisioningPending();

  return {
    organizationId: bootstrapData.organizationId,
    merchantSettingsId: bootstrapData.merchantSettingsId,
  };
}

/** Idempotent journey provisioning — safe to call after OAuth return or page refresh. */
export async function completeJourneyOnboarding(email?: string): Promise<BootstrapWorkspaceResponse> {
  if (inFlightCompletion) {
    return inFlightCompletion;
  }

  inFlightCompletion = runCompleteJourneyOnboarding(email).finally(() => {
    inFlightCompletion = null;
  });

  return inFlightCompletion;
}

/** @internal Reset in-flight dedupe between tests. */
export function resetJourneyOnboardingCompletionForTests(): void {
  inFlightCompletion = null;
}
