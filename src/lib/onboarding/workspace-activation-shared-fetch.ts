import type { NextRecommendedAction } from '@/lib/onboarding/next-recommended-action';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';
import type { OperationalInitializationSnapshot } from '@/lib/operations/onboarding/operational-transition-types';
import {
  hasActiveOperationalPageLoadTrace,
  parseOperationalApiJson,
  readOperationalApiResponseDiagnostics,
} from '@/lib/operations/dev/operational-api-fetch-diagnostics';
import { recordCoordinationActivationRequest } from '@/lib/operations/dev/coordination-request-count';

export type SharedWorkspaceActivationPayload = {
  activation: WorkspaceActivationSnapshot;
  nextAction: NextRecommendedAction;
  operationalOnboarding?: OperationalOnboardingState;
  operationalInitialization?: OperationalInitializationSnapshot;
  correlationId?: string;
};

export type SharedWorkspaceActivationResult =
  | { status: 'ok'; payload: SharedWorkspaceActivationPayload }
  | { status: 'fallback' };

let inFlight: Promise<SharedWorkspaceActivationResult> | null = null;

export const invalidateWorkspaceActivationSharedFetch = () => {
  inFlight = null;
};

export const resetWorkspaceActivationSharedFetchForTests = () => {
  inFlight = null;
};

const loadWorkspaceActivation = async (): Promise<SharedWorkspaceActivationResult> => {
  recordCoordinationActivationRequest();
  try {
    const fetchStartedAt = performance.now();
    const res = await fetch('/api/workspace/activation', { cache: 'no-store' });
    const diagnostics = await readOperationalApiResponseDiagnostics(
      '/api/workspace/activation',
      res,
      hasActiveOperationalPageLoadTrace()
        ? { pageLoadLabel: 'A-activation', startedAt: fetchStartedAt }
        : undefined
    );
    if (!diagnostics.shouldParseJson) {
      return { status: 'fallback' };
    }
    const json = parseOperationalApiJson<{
      activation?: WorkspaceActivationSnapshot;
      nextAction?: NextRecommendedAction;
      operationalOnboarding?: OperationalOnboardingState;
      operationalInitialization?: OperationalInitializationSnapshot;
      correlationId?: string;
      data?: SharedWorkspaceActivationPayload;
    }>('/api/workspace/activation', diagnostics.bodyText);
    const payload = json.data ?? {
      activation: json.activation,
      nextAction: json.nextAction,
      operationalOnboarding: json.operationalOnboarding,
      operationalInitialization: json.operationalInitialization,
      correlationId: json.correlationId,
    };
    if (payload?.activation && payload?.nextAction) {
      return {
        status: 'ok',
        payload: {
          activation: payload.activation,
          nextAction: payload.nextAction,
          operationalOnboarding: payload.operationalOnboarding,
          operationalInitialization: payload.operationalInitialization,
          correlationId: payload.correlationId,
        },
      };
    }
    return { status: 'fallback' };
  } catch {
    return { status: 'fallback' };
  }
};

export const fetchSharedWorkspaceActivation = (): Promise<SharedWorkspaceActivationResult> => {
  if (inFlight) return inFlight;
  const request = loadWorkspaceActivation();
  inFlight = request;
  void request.finally(() => {
    if (inFlight === request) {
      inFlight = null;
    }
  });
  return request;
};
