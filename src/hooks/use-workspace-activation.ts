'use client';

import * as React from 'react';
import type { NextRecommendedAction } from '@/lib/onboarding/next-recommended-action';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import type { OperationalOnboardingState } from '@/lib/operations/onboarding/operational-onboarding-phases';
import type { OperationalInitializationSnapshot } from '@/lib/operations/onboarding/operational-transition-types';
import {
  createFallbackActivation,
  createFallbackNextAction,
} from '@/lib/onboarding/workspace-activation-fallback';
import {
  hasActiveOperationalPageLoadTrace,
  parseOperationalApiJson,
  readOperationalApiResponseDiagnostics,
} from '@/lib/operations/dev/operational-api-fetch-diagnostics';
import { logCoordinationFetch } from '@/lib/operations/dev/coordination-fetch-trace';
import { recordCoordinationActivationRequest } from '@/lib/operations/dev/coordination-request-count';

export const WORKSPACE_ACTIVATION_REFRESH_EVENT = 'workspace-activation-refresh';

export function notifyWorkspaceActivationRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKSPACE_ACTIVATION_REFRESH_EVENT));
  }
}

type ActivationResponse = {
  activation: WorkspaceActivationSnapshot;
  nextAction: NextRecommendedAction;
  operationalOnboarding?: OperationalOnboardingState;
  operationalInitialization?: OperationalInitializationSnapshot;
  correlationId?: string;
};

export function useWorkspaceActivation(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const [data, setData] = React.useState<ActivationResponse | null>(null);
  const [loading, setLoading] = React.useState(enabled);
  const [degraded, setDegraded] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  const refresh = React.useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setLoading(true);
    const activationRequestId = logCoordinationFetch('activation-start', {});
    recordCoordinationActivationRequest();
    const activationStartedAt = performance.now();

    void (async () => {
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
          if (!cancelled) {
            setDegraded(true);
            setData({
              activation: createFallbackActivation(),
              nextAction: createFallbackNextAction(),
            });
          }
          logCoordinationFetch('activation-complete', {
            requestId: activationRequestId,
            durationMs: Math.round(performance.now() - activationStartedAt),
            success: false,
          });
          return;
        }
        const json = parseOperationalApiJson<{
          activation?: WorkspaceActivationSnapshot;
          nextAction?: NextRecommendedAction;
          operationalOnboarding?: OperationalOnboardingState;
          operationalInitialization?: OperationalInitializationSnapshot;
          correlationId?: string;
          data?: ActivationResponse;
        }>('/api/workspace/activation', diagnostics.bodyText);
        const payload = json.data ?? {
          activation: json.activation,
          nextAction: json.nextAction,
          operationalOnboarding: json.operationalOnboarding,
          operationalInitialization: json.operationalInitialization,
          correlationId: json.correlationId,
        };
        if (!cancelled && payload?.activation && payload?.nextAction) {
          setData({
            activation: payload.activation,
            nextAction: payload.nextAction,
            operationalOnboarding: payload.operationalOnboarding,
            operationalInitialization: payload.operationalInitialization,
            correlationId: payload.correlationId,
          });
          setDegraded(Boolean(payload.activation.degraded));
          logCoordinationFetch('activation-complete', {
            requestId: activationRequestId,
            projectId: payload.activation.primaryProjectId ?? null,
            durationMs: Math.round(performance.now() - activationStartedAt),
            success: true,
          });
        } else if (!cancelled) {
          setDegraded(true);
          setData({
            activation: createFallbackActivation(),
            nextAction: createFallbackNextAction(),
          });
          logCoordinationFetch('activation-complete', {
            requestId: activationRequestId,
            durationMs: Math.round(performance.now() - activationStartedAt),
            success: false,
          });
        }
      } catch {
        if (!cancelled) {
          setDegraded(true);
          setData({
            activation: createFallbackActivation(),
            nextAction: createFallbackNextAction(),
          });
        }
        logCoordinationFetch('activation-complete', {
          requestId: activationRequestId,
          durationMs: Math.round(performance.now() - activationStartedAt),
          success: false,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, version]);

  React.useEffect(() => {
    if (!enabled) return;
    const handler = () => refresh();
    window.addEventListener(WORKSPACE_ACTIVATION_REFRESH_EVENT, handler);
    return () => window.removeEventListener(WORKSPACE_ACTIVATION_REFRESH_EVENT, handler);
  }, [enabled, refresh]);

  return {
    activation: data?.activation ?? null,
    nextAction: data?.nextAction ?? null,
    operationalOnboarding: data?.operationalOnboarding ?? null,
    operationalInitialization: data?.operationalInitialization ?? null,
    correlationId: data?.correlationId ?? null,
    loading,
    degraded,
    refresh,
  };
}
