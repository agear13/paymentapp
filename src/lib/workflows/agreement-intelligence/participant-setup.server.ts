import 'server-only';

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OrganizationWorkflowLifecycleStatus } from '@prisma/client';
import { effectiveOnboardingStatus } from '@/lib/deal-network-demo/participant-onboarding';
import { participantHasCompensationTerms } from '@/lib/workflows/agreement-intelligence/operational-hub-coordination.server';

export function filterCompensatedParticipants(participants: DemoParticipant[]): DemoParticipant[] {
  return participants.filter((participant) => participantHasCompensationTerms(participant));
}

export function compensatedParticipantNeedsSetup(
  participant: DemoParticipant,
  operatorApprovalRequired: boolean
): boolean {
  if (!participantHasCompensationTerms(participant)) {
    return false;
  }

  if (operatorApprovalRequired && participant.approvalStatus !== 'Approved') {
    return true;
  }

  const onboardingStatus = effectiveOnboardingStatus(participant);
  return onboardingStatus !== 'COMPLETE';
}

export function workflowRequiresParticipantSetup(input: {
  compensatedParticipants: DemoParticipant[];
  operatorApprovalRequired: boolean;
}): boolean {
  if (input.compensatedParticipants.length === 0) {
    return false;
  }

  return input.compensatedParticipants.some((participant) =>
    compensatedParticipantNeedsSetup(participant, input.operatorApprovalRequired)
  );
}

export function isParticipantSetupComplete(input: {
  compensatedParticipants: DemoParticipant[];
  operatorApprovalRequired: boolean;
}): boolean {
  return !workflowRequiresParticipantSetup(input);
}

export function resolvePostBootstrapLifecycle(input: {
  compensatedParticipants: DemoParticipant[];
  operatorApprovalRequired: boolean;
}): Extract<OrganizationWorkflowLifecycleStatus, 'PARTICIPANT_SETUP' | 'ACTIVE'> {
  return workflowRequiresParticipantSetup(input) ? 'PARTICIPANT_SETUP' : 'ACTIVE';
}

export function participantSetupStatusLabel(
  participant: DemoParticipant,
  operatorApprovalRequired: boolean
): string {
  if (!participantHasCompensationTerms(participant)) {
    return 'Contractual party';
  }

  if (operatorApprovalRequired && participant.approvalStatus !== 'Approved') {
    return 'Awaiting approval';
  }

  const onboardingStatus = effectiveOnboardingStatus(participant);
  if (onboardingStatus === 'NOT_STARTED') {
    return 'Onboarding not started';
  }
  if (onboardingStatus === 'INCOMPLETE') {
    return 'Onboarding incomplete';
  }

  return 'Ready';
}
