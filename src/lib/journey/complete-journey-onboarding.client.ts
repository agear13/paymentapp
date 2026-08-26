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
import {
  clearStoredSourceParticipantHint,
  readStoredSourceParticipantHint,
} from '@/lib/journey/journey-source-participant.client';
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

export type CompleteJourneyOnboardingOptions = {
  /** Create-only. Ignored when the authenticated user already has an organization. */
  confirmedWorkspaceName?: string;
};

function workspaceNameForBootstrap(
  assessmentWorkspaceName: string,
  hasOrganization: boolean,
  confirmedWorkspaceName?: string
): string {
  if (hasOrganization) {
    return assessmentWorkspaceName;
  }
  const confirmed = confirmedWorkspaceName?.trim() ?? '';
  if (confirmed.length >= 2 && confirmed.length <= 255) {
    return confirmed;
  }
  return assessmentWorkspaceName;
}

async function fetchExistingOnboarding(): Promise<OnboardingGetResponse> {
  const response = await fetch('/api/onboarding', { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to load onboarding state');
  }
  return (await response.json()) as OnboardingGetResponse;
}

async function runCompleteJourneyOnboarding(
  email?: string,
  options?: CompleteJourneyOnboardingOptions
): Promise<BootstrapWorkspaceResponse> {
  const { objective, business } = readJourneyAssessment();
  const assessmentWorkspaceName = journeyWorkspaceNameFromAssessment(business, email);
  const assessmentContext = journeyAssessmentContext(objective, business);

  const existing = await fetchExistingOnboarding();
  const alreadyHadOrganization = Boolean(existing.hasOrganization && existing.organizationId);
  const sourceParticipantId = readStoredSourceParticipantHint();
  // Skip bootstrap only when there is no participant hint. Generate-my-invoice reuse
  // must still POST so the server can attach converted_organization_id.
  if (alreadyHadOrganization && existing.organizationId && !sourceParticipantId) {
    const savedAssessment = parseJourneyAssessmentContext(existing.state?.onboarding_context);
    if (journeyAssessmentsMatch(savedAssessment, objective, business)) {
      clearJourneyProvisioningPending();
      clearStoredSourceParticipantHint();
      return {
        organizationId: existing.organizationId,
        merchantSettingsId: existing.state?.merchantSettingsId ?? null,
      };
    }
  }

  const workspaceName = workspaceNameForBootstrap(
    assessmentWorkspaceName,
    alreadyHadOrganization,
    options?.confirmedWorkspaceName
  );
  const bootstrapRes = await csrfAwareFetch('/api/onboarding/bootstrap-workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceName,
      defaultCurrency: DEFAULT_WORKSPACE_CURRENCY,
      industry: business?.industry,
      teamSize: business?.size,
      ...(sourceParticipantId ? { sourceParticipantId } : {}),
    }),
  });

  const bootstrapData = (await bootstrapRes.json()) as BootstrapWorkspaceResponse & {
    error?: string;
  };

  if (!bootstrapRes.ok || !bootstrapData.organizationId) {
    throw new Error(bootstrapData.error || 'Failed to create workspace');
  }

  const reusedExistingWorkspace = alreadyHadOrganization || bootstrapRes.status === 200;
  if (!reusedExistingWorkspace) {
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
  }

  clearJourneyProvisioningPending();
  clearStoredSourceParticipantHint();

  return {
    organizationId: bootstrapData.organizationId,
    merchantSettingsId: bootstrapData.merchantSettingsId,
  };
}

/** Idempotent journey provisioning — safe to call after OAuth return or page refresh. */
export async function completeJourneyOnboarding(
  email?: string,
  options?: CompleteJourneyOnboardingOptions
): Promise<BootstrapWorkspaceResponse> {
  if (inFlightCompletion) {
    return inFlightCompletion;
  }

  inFlightCompletion = runCompleteJourneyOnboarding(email, options).finally(() => {
    inFlightCompletion = null;
  });

  return inFlightCompletion;
}

/** @internal Reset in-flight dedupe between tests. */
export function resetJourneyOnboardingCompletionForTests(): void {
  inFlightCompletion = null;
}
