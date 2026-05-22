/**
 * Central route safety for guided operational CTAs.
 * Incomplete onboarding state must never produce fatal navigation.
 */

import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  isDraftProjectId as isDraftProjectIdGuard,
  safeProjectRouteContext,
  type OperationalRoutePhase,
  type SafeProjectRouteContext,
} from '@/lib/operations/routing/draft-safe-routing';
import {
  projectOverviewPath,
  projectParticipantsPath,
  projectObligationsPath,
} from '@/lib/projects/project-routes';
import {
  PAYOUTS_OBLIGATIONS_HREF,
  PAYOUTS_SETTLEMENTS_HREF,
} from '@/lib/navigation/operator-nav';

export type OperationalRouteIntent =
  | 'open_project'
  | 'configure_earnings'
  | 'resolve_issue'
  | 'review_obligations'
  | 'continue_setup'
  | 'review_release'
  | 'connect_provider';

export type SafeOperationalRouteResult = {
  href: string;
  phase: OperationalRoutePhase;
  guidance: string;
  /** Prefer configuring UI over error boundary when true */
  expectConfiguring: boolean;
  isDraftProject: boolean;
};

export type RouteRecoveryInput = {
  projectId?: string | null;
  deal?: RecentDeal | null;
  loading?: boolean;
  notFound?: boolean;
};

function draftSafeProjectId(projectId: string | null | undefined): string {
  if (projectId?.trim()) return projectId.trim();
  return 'unknown';
}

export function recoverDraftProjectRoute(
  projectId: string,
  input: Pick<RouteRecoveryInput, 'deal' | 'loading' | 'notFound'> = {}
): SafeProjectRouteContext {
  return safeProjectRouteContext({
    projectId,
    deal: input.deal ?? null,
    loading: input.loading ?? false,
    notFound: input.notFound ?? !input.deal,
  });
}

/**
 * Whether the UI should show configuring/loading instead of an error boundary.
 */
export function ensureProjectHydrated(
  projectId: string,
  input: RouteRecoveryInput = {}
): { ready: boolean; phase: OperationalRoutePhase; guidance: string } {
  const ctx = recoverDraftProjectRoute(draftSafeProjectId(projectId), input);
  const ready =
    ctx.phase === 'ready' ||
    (ctx.phase === 'configuring' && ctx.canRenderParticipants);
  return {
    ready,
    phase: ctx.phase,
    guidance: ctx.guidance,
  };
}

export function resolveSafeOperationalRoute(
  intent: OperationalRouteIntent,
  input: RouteRecoveryInput = {}
): SafeOperationalRouteResult {
  const projectId = draftSafeProjectId(input.projectId);
  const ctx = recoverDraftProjectRoute(projectId, input);
  const isDraft = isDraftProjectIdGuard(projectId) || ctx.isDraftProject;
  const expectConfiguring =
    ctx.phase === 'configuring' ||
    ctx.phase === 'loading' ||
    (isDraft && ctx.phase !== 'not_found');

  let href: string;

  switch (intent) {
    case 'configure_earnings':
    case 'resolve_issue':
      href =
        projectId !== 'unknown'
          ? projectParticipantsPath(projectId)
          : '/dashboard/projects';
      break;
    case 'open_project':
      href =
        projectId !== 'unknown'
          ? projectOverviewPath(projectId)
          : '/dashboard/projects';
      break;
    case 'review_obligations':
      href =
        projectId !== 'unknown' && !isDraft
          ? projectObligationsPath(projectId)
          : PAYOUTS_OBLIGATIONS_HREF;
      break;
    case 'review_release':
      href = PAYOUTS_SETTLEMENTS_HREF;
      break;
    case 'continue_setup':
      href = '/onboarding';
      break;
    case 'connect_provider':
      href = '/dashboard/settings/merchant';
      break;
    default:
      href = '/dashboard/projects';
  }

  if (expectConfiguring && intent === 'open_project' && projectId !== 'unknown') {
    href = projectOverviewPath(projectId);
  }

  return {
    href,
    phase: ctx.phase,
    guidance: ctx.guidance,
    expectConfiguring,
    isDraftProject: isDraft,
  };
}

export { isDraftProjectIdGuard as isDraftProjectId };

/** Resolve href for a guided CTA — never returns empty or invalid paths. */
export function safeOperationalNavigation(
  intent: OperationalRouteIntent,
  projectId?: string | null
): string {
  return resolveSafeOperationalRoute(intent, { projectId }).href;
}
