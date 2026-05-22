/**
 * Draft-safe operational routing — incomplete onboarding state is normal.
 * Routes and pages must never assume fully configured entities.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  normalizeParticipantEntity,
  safeProjectState,
} from '@/lib/operations/guards/hydration-guards';
import { deriveParticipantPayoutReadiness } from '@/lib/operations/readiness/participant-readiness';
import { deriveProjectOperationalReadiness } from '@/lib/operations/readiness/project-readiness';
import type { ProjectState } from '@/lib/operations/states/project-state';

export type OperationalRoutePhase =
  | 'loading'
  | 'configuring'
  | 'ready'
  | 'not_found'
  | 'degraded';

export type SafeProjectRouteContext = {
  projectId: string;
  deal: RecentDeal | null;
  phase: OperationalRoutePhase;
  projectState: ProjectState;
  isDraftProject: boolean;
  guidance: string;
  canRenderParticipants: boolean;
};

export type SafeParticipantRouteContext = {
  participants: DemoParticipant[];
  total: number;
  configuredCount: number;
  payoutReadyCount: number;
  needsEarningsConfiguration: boolean;
  guidance: string;
};

export type SafeCompensationRouteContext = {
  canConfigure: boolean;
  message: string;
};

export type SafeOperationalRouteState = {
  project: SafeProjectRouteContext;
  participants: SafeParticipantRouteContext;
  compensation: SafeCompensationRouteContext;
};

export function isDraftProjectId(projectId: string): boolean {
  return projectId.startsWith('onb-deal-') || projectId.startsWith('draft-');
}

export function safeProjectRouteContext(input: {
  projectId: string;
  deal?: RecentDeal | null;
  loading?: boolean;
  notFound?: boolean;
}): SafeProjectRouteContext {
  const { projectId, deal = null, loading = false, notFound = false } = input;
  const isDraft = isDraftProjectId(projectId);

  if (loading && !deal) {
    return {
      projectId,
      deal: null,
      phase: 'loading',
      projectState: 'CONFIGURING',
      isDraftProject: isDraft,
      guidance: 'Loading project setup…',
      canRenderParticipants: false,
    };
  }

  if (!deal) {
    if (notFound && isDraft) {
      return {
        projectId,
        deal: null,
        phase: 'configuring',
        projectState: 'CONFIGURING',
        isDraftProject: true,
        guidance:
          'Your project is still syncing. Refresh in a moment, or continue from onboarding if you just created it.',
        canRenderParticipants: true,
      };
    }
    return {
      projectId,
      deal: null,
      phase: notFound ? 'not_found' : 'configuring',
      projectState: 'DRAFT',
      isDraftProject: isDraft,
      guidance: notFound
        ? 'This project could not be loaded yet. Your workspace data is still safe.'
        : 'Project setup is in progress.',
      canRenderParticipants: false,
    };
  }

  const projectState = safeProjectState(deal);
  const configuring =
    projectState === 'DRAFT' ||
    projectState === 'CONFIGURING' ||
    deal.setupStatus === 'configuring' ||
    deal.setupStatus === 'draft';

  return {
    projectId,
    deal,
    phase: configuring ? 'configuring' : 'ready',
    projectState,
    isDraftProject: isDraft,
    guidance: configuring
      ? 'Participant earnings still need configuration before payout obligations can be tracked.'
      : 'Project coordination is active.',
    canRenderParticipants: true,
  };
}

export function safeParticipantRouteContext(
  participants: DemoParticipant[] | null | undefined
): SafeParticipantRouteContext {
  const list = (participants ?? []).map(normalizeParticipantEntity);
  const total = list.length;
  let configuredCount = 0;
  let payoutReadyCount = 0;

  for (const p of list) {
    const r = deriveParticipantPayoutReadiness(p);
    if (r.flags.hasCompensation) configuredCount += 1;
    if (r.payoutReady) payoutReadyCount += 1;
  }

  const needsEarningsConfiguration = total > 0 && configuredCount < total;

  return {
    participants: list,
    total,
    configuredCount,
    payoutReadyCount,
    needsEarningsConfiguration,
    guidance:
      total === 0
        ? 'Add participants, then configure how each earns before obligations or payout release.'
        : needsEarningsConfiguration
          ? `${total} participant${total === 1 ? '' : 's'} added · ${configuredCount} earnings configured · ${payoutReadyCount} payout-ready`
          : `${total} participant${total === 1 ? '' : 's'} · ${payoutReadyCount} payout-ready`,
  };
}

export function safeCompensationRouteContext(
  participants: DemoParticipant[] | null | undefined
): SafeCompensationRouteContext {
  const ctx = safeParticipantRouteContext(participants);
  return {
    canConfigure: ctx.total > 0,
    message:
      ctx.total === 0
        ? 'Add at least one participant before configuring earnings.'
        : 'Configure how each participant earns — required before obligations and payout release.',
  };
}

export function safeOperationalRouteState(input: {
  projectId: string;
  deal?: RecentDeal | null;
  participants?: DemoParticipant[] | null;
  loading?: boolean;
  notFound?: boolean;
}): SafeOperationalRouteState {
  const project = safeProjectRouteContext(input);
  const participants = safeParticipantRouteContext(input.participants);

  let compensation = safeCompensationRouteContext(input.participants);

  try {
    if (project.deal) {
      deriveProjectOperationalReadiness(project.deal, participants.participants);
    }
  } catch {
    /* orchestration must never break routing */
  }

  return { project, participants, compensation };
}
