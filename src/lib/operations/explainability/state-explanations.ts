import type { StateExplanation } from '@/lib/operations/explainability/types';
import type { WorkspaceState } from '@/lib/operations/states/workspace-state';
import { WORKSPACE_STATE_LABELS } from '@/lib/operations/states/workspace-state';
import type { ProjectState } from '@/lib/operations/states/project-state';
import { PROJECT_STATE_LABELS } from '@/lib/operations/states/project-state';
import type { ParticipantState } from '@/lib/operations/states/participant-state';

const WORKSPACE_EXPLANATIONS: Record<
  WorkspaceState,
  Omit<StateExplanation, 'stateKey' | 'title'>
> = {
  DRAFT: {
    whatThisMeans: 'The workspace exists but core coordination setup has not started.',
    whyItMatters: 'No projects, participants, or payout rails are operational yet.',
    whatUnlocksNext: 'Complete workspace onboarding and create your first project.',
    blockingProgress: ['Workspace onboarding incomplete'],
  },
  CONFIGURING: {
    whatThisMeans: 'Projects or participants are being set up; payout coordination is not active.',
    whyItMatters: 'Releases cannot be safely coordinated until earnings and collection are defined.',
    whatUnlocksNext: 'Add participants, configure earnings, and connect a payment provider.',
    blockingProgress: ['Participant earnings', 'Payment provider', 'Revenue sources'],
  },
  COLLECTING: {
    whatThisMeans: 'Funding collection is active — customer revenue can be tracked toward obligations.',
    whyItMatters: 'Obligations and releases depend on confirmed inflows.',
    whatUnlocksNext: 'Once revenue is collected, obligations become payout-ready.',
    blockingProgress: ['Pending revenue collection', 'Unpaid invoices'],
  },
  COORDINATING: {
    whatThisMeans: 'Participants and obligations are being coordinated before release.',
    whyItMatters: 'Payout releases require approved obligations and participant readiness.',
    whatUnlocksNext: 'Approve obligations and confirm participant payout destinations.',
    blockingProgress: ['Obligation approvals', 'Participant payout setup'],
  },
  READY_FOR_SETTLEMENT: {
    whatThisMeans: 'Some payouts are eligible for release; settlement can proceed with review.',
    whyItMatters: 'Premature release risks paying before funding or compliance is complete.',
    whatUnlocksNext: 'Review release confidence, then create a payout release batch.',
    blockingProgress: ['Release validation', 'Final reconciliation'],
  },
  ACTIVE: {
    whatThisMeans: 'The workspace is actively coordinating releases and settlements.',
    whyItMatters: 'Ongoing monitoring ensures payouts match collected revenue.',
    whatUnlocksNext: 'Complete releases and reconcile settlement batches.',
    blockingProgress: [],
  },
  DEGRADED: {
    whatThisMeans: 'Setup is partially complete — a provider or project exists but coordination is blocked.',
    whyItMatters: 'Operating in this state risks payout errors or blocked releases.',
    whatUnlocksNext: 'Resolve compensation gaps before advancing obligations or releases.',
    blockingProgress: ['Participant compensation incomplete', 'Configuration mismatch'],
  },
  ARCHIVED: {
    whatThisMeans: 'The workspace is archived and no longer accepting new coordination.',
    whyItMatters: 'Historical records remain; new releases should not be initiated.',
    whatUnlocksNext: 'Restore or create a new workspace for active coordination.',
    blockingProgress: ['Workspace archived'],
  },
};

const PROJECT_EXPLANATIONS: Record<
  ProjectState,
  Omit<StateExplanation, 'stateKey' | 'title'>
> = {
  DRAFT: {
    whatThisMeans: 'The project shell exists but operational configuration is incomplete.',
    whyItMatters: 'No funding, obligations, or releases can be coordinated yet.',
    whatUnlocksNext: 'Add participants and define how each earns.',
    blockingProgress: ['Project configuration'],
  },
  CONFIGURING: {
    whatThisMeans: 'Participants and funding sources are being configured.',
    whyItMatters: 'Obligations should not be finalized until earnings are defined.',
    whatUnlocksNext: 'Complete participant earnings and add revenue sources.',
    blockingProgress: ['Earnings configuration', 'Funding sources'],
  },
  FUNDING_PENDING: {
    whatThisMeans: 'Customer revenue has not yet fully settled into the project treasury.',
    whyItMatters: 'Some participant payouts cannot yet be released.',
    whatUnlocksNext: 'Once sufficient revenue is collected, obligations become payout-ready.',
    blockingProgress: ['Revenue collection', 'Unsettled invoices'],
  },
  ALLOCATIONS_PENDING: {
    whatThisMeans: 'Collected revenue exists but allocations to participants are not finalized.',
    whyItMatters: 'Obligation amounts may change until allocations are confirmed.',
    whatUnlocksNext: 'Confirm allocations, then record obligations.',
    blockingProgress: ['Allocation confirmation'],
  },
  OBLIGATIONS_PENDING: {
    whatThisMeans: 'Obligations are recorded but not all are approved for release.',
    whyItMatters: 'Unapproved obligations block payout release.',
    whatUnlocksNext: 'Approve obligations and verify participant payout readiness.',
    blockingProgress: ['Obligation approval', 'Participant payout setup'],
  },
  READY_FOR_RELEASE: {
    whatThisMeans: 'Funding and obligations support a payout release with review.',
    whyItMatters: 'Release confidence should be verified before funds move.',
    whatUnlocksNext: 'Create a payout release batch after reviewing held-back amounts.',
    blockingProgress: ['Release validation'],
  },
  RELEASE_IN_PROGRESS: {
    whatThisMeans: 'A payout release batch is processing.',
    whyItMatters: 'Do not duplicate releases until the current batch completes.',
    whatUnlocksNext: 'Monitor batch status and reconcile outcomes.',
    blockingProgress: ['Release in flight'],
  },
  SETTLING: {
    whatThisMeans: 'Funds are moving through settlement and reconciliation.',
    whyItMatters: 'Ledger and provider records must align before marking complete.',
    whatUnlocksNext: 'Complete settlement batch and confirm reconciliation.',
    blockingProgress: ['Settlement reconciliation'],
  },
  SETTLED: {
    whatThisMeans: 'This project cycle has completed settlement.',
    whyItMatters: 'New revenue or obligations start a new coordination cycle.',
    whatUnlocksNext: 'Archive or begin a new funding period as needed.',
    blockingProgress: [],
  },
  BLOCKED: {
    whatThisMeans: 'An operational blocker prevents progress on this project.',
    whyItMatters: 'Continuing without resolution risks incorrect payouts.',
    whatUnlocksNext: 'Resolve listed blockers before resuming coordination.',
    blockingProgress: ['Operational blocker active'],
  },
  ARCHIVED: {
    whatThisMeans: 'The project is archived.',
    whyItMatters: 'No new releases should be created.',
    whatUnlocksNext: 'View historical settlement records only.',
    blockingProgress: ['Project archived'],
  },
};

export function explainWorkspaceState(
  state: WorkspaceState,
  blockers: string[] = []
): StateExplanation {
  const base = WORKSPACE_EXPLANATIONS[state] ?? WORKSPACE_EXPLANATIONS.CONFIGURING;
  return {
    stateKey: state,
    title: WORKSPACE_STATE_LABELS[state],
    ...base,
    blockingProgress: blockers.length > 0 ? blockers : base.blockingProgress,
  };
}

export function explainProjectState(
  state: ProjectState,
  blockers: string[] = []
): StateExplanation {
  const base = PROJECT_EXPLANATIONS[state] ?? PROJECT_EXPLANATIONS.CONFIGURING;
  return {
    stateKey: state,
    title: PROJECT_STATE_LABELS[state],
    ...base,
    blockingProgress: blockers.length > 0 ? blockers : base.blockingProgress,
  };
}

export function explainParticipantState(
  state: ParticipantState,
  issues: string[] = []
): StateExplanation {
  const titles: Record<ParticipantState, string> = {
    INVITED: 'Invited',
    ONBOARDING: 'Onboarding',
    PAYOUT_DETAILS_PENDING: 'Payout details pending',
    COMPENSATION_PENDING: 'Compensation pending',
    READY: 'Payout ready',
    INACTIVE: 'Inactive',
    BLOCKED: 'Blocked',
  };
  const copy: Record<ParticipantState, Omit<StateExplanation, 'stateKey' | 'title'>> = {
    INVITED: {
      whatThisMeans: 'The participant has been invited but has not completed onboarding.',
      whyItMatters: 'Payouts cannot be sent until identity and agreement steps complete.',
      whatUnlocksNext: 'Participant completes invite and payout onboarding.',
      blockingProgress: issues.length ? issues : ['Invite acceptance'],
    },
    ONBOARDING: {
      whatThisMeans: 'The participant is completing onboarding steps.',
      whyItMatters: 'Compliance and payout destination are required before release.',
      whatUnlocksNext: 'Onboarding completes and payout destination is verified.',
      blockingProgress: issues.length ? issues : ['Onboarding incomplete'],
    },
    PAYOUT_DETAILS_PENDING: {
      whatThisMeans: 'Earnings may be defined but payout destination is missing.',
      whyItMatters: 'Funds cannot be routed without a valid payout rail.',
      whatUnlocksNext: 'Add email or connect payout provider for this participant.',
      blockingProgress: issues.length ? issues : ['Payout destination missing'],
    },
    COMPENSATION_PENDING: {
      whatThisMeans: 'How this participant earns has not been saved and confirmed.',
      whyItMatters: 'Obligations and releases depend on defined compensation.',
      whatUnlocksNext: 'Configure and save participant earnings structure.',
      blockingProgress: issues.length ? issues : ['Compensation not configured'],
    },
    READY: {
      whatThisMeans: 'This participant meets payout readiness requirements.',
      whyItMatters: 'Their obligations can be included in release batches when funded.',
      whatUnlocksNext: 'Include in release when obligations are approved and funded.',
      blockingProgress: [],
    },
    INACTIVE: {
      whatThisMeans: 'The participant is inactive for this project.',
      whyItMatters: 'Inactive participants are excluded from new releases.',
      whatUnlocksNext: 'Reactivate if they should receive payouts.',
      blockingProgress: ['Participant inactive'],
    },
    BLOCKED: {
      whatThisMeans: 'Payouts are blocked for this participant.',
      whyItMatters: 'Releases including this participant will be held or fail.',
      whatUnlocksNext: 'Resolve compliance or admin block before release.',
      blockingProgress: issues.length ? issues : ['Payout blocked'],
    },
  };
  const base = copy[state];
  return { stateKey: state, title: titles[state], ...base };
}
