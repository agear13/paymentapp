import { resolveAnyRailConfigured } from '@/lib/onboarding/workspace-activation-state';
import type { TimelineEvent } from '@/lib/operations/explainability/types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';

export type TimelineInput = {
  workspace: WorkspaceOperationalContext;
  projectName?: string;
  participantNames?: string[];
};

/**
 * Deterministic timeline from known workspace milestones (no invented timestamps).
 */
export function buildOperationalTimeline(input: TimelineInput): TimelineEvent[] {
  const { workspace: w } = input;
  const events: TimelineEvent[] = [];

  if (w.hasOrganization) {
    events.push({
      id: 'workspace',
      type: 'workspace_created',
      title: 'Workspace created',
      description: 'Operational coordination workspace initialized.',
      timestamp: null,
      completed: true,
    });
  }

  if (w.projectCount > 0) {
    events.push({
      id: 'project',
      type: 'state_transition',
      title: input.projectName ? `Project: ${input.projectName}` : 'Project created',
      description: 'Project workspace available for participants and funding.',
      timestamp: null,
      completed: true,
    });
  }

  if (w.participantCount > 0) {
    events.push({
      id: 'participants',
      type: 'participant_invited',
      title: `${w.participantCount} participant${w.participantCount === 1 ? '' : 's'} added`,
      description:
        w.participantsConfiguredCount >= w.participantCount
          ? 'All participants have earnings configured.'
          : `${w.participantsConfiguredCount} of ${w.participantCount} earnings configured.`,
      timestamp: null,
      completed: w.participantsConfiguredCount >= w.participantCount,
    });
  }

  const provider = resolveAnyRailConfigured(w);
  if (provider) {
    events.push({
      id: 'provider',
      type: 'provider_connected',
      title: 'Payment provider connected',
      description: 'Revenue collection rails are active.',
      timestamp: null,
      completed: true,
    });
  }

  if (w.paymentLinkCount > 0 || !w.collectionPreferenceDecideLater) {
    events.push({
      id: 'revenue',
      type: 'revenue_collected',
      title: 'Revenue collection configured',
      description:
        w.paymentLinkCount > 0
          ? `${w.paymentLinkCount} open payment link${w.paymentLinkCount === 1 ? '' : 's'} tracked.`
          : 'Collection preference set for this workspace.',
      timestamp: null,
      completed: provider,
    });
  }

  if (w.obligationCount > 0) {
    events.push({
      id: 'obligations',
      type: 'obligation_approved',
      title: `${w.obligationCount} obligation${w.obligationCount === 1 ? '' : 's'} tracked`,
      description:
        w.releaseEligibleCount > 0
          ? `${w.releaseEligibleCount} ready for release.`
          : 'Waiting for funding confirmation or agreement approval.',
      timestamp: null,
      completed: w.releaseEligibleCount > 0,
    });
  }

  if (w.releaseBatchCount > 0) {
    events.push({
      id: 'release',
      type: 'release_generated',
      title: 'Payout release batch created',
      description: 'Release coordination in progress or completed.',
      timestamp: null,
      completed: true,
    });
    events.push({
      id: 'settlement',
      type: 'settlement_completed',
      title: 'Settlement activity recorded',
      description: 'Review settlement batches for reconciliation status.',
      timestamp: null,
      completed: w.onboardingCompleted && w.releaseBatchCount > 0,
    });
  }

  return events;
}
