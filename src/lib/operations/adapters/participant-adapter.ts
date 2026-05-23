import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  detectParticipantEntitySource,
  warnLegacyParticipantShape,
  warnMissingParticipantFields,
} from '@/lib/operations/dev/operational-diagnostics';

/** Adapt raw/API/storage participant records into DemoParticipant shape. */
export function adaptParticipantInput(
  raw: DemoParticipant | Record<string, unknown> | null | undefined
): DemoParticipant | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as DemoParticipant;
  return {
    ...p,
    id: typeof p.id === 'string' ? p.id : `participant-${Date.now()}`,
    name: typeof p.name === 'string' ? p.name : 'Unnamed participant',
    email: typeof p.email === 'string' ? p.email : '',
    role: p.role ?? 'Contributor',
    commissionKind: p.commissionKind ?? 'fixed_amount',
    commissionValue: Number.isFinite(p.commissionValue) ? p.commissionValue : 0,
    status: p.status ?? 'Pending',
    approvalStatus: p.approvalStatus ?? 'Pending approval',
    inviteToken: p.inviteToken ?? '',
  };
}

/** Return hydrated storage entity for mutations — never use for UI truth derivation. */
export function participantEntityForMutation(
  participant: DemoParticipant
): DemoParticipant {
  return participant;
}

export function adaptProjectInput(
  raw: RecentDeal | Record<string, unknown> | null | undefined
): RecentDeal | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as RecentDeal;
  return {
    ...p,
    id: typeof p.id === 'string' ? p.id : `project-${Date.now()}`,
    dealName: typeof p.dealName === 'string' ? p.dealName : 'Untitled project',
    partner: typeof p.partner === 'string' ? p.partner : '—',
    value: Number.isFinite(p.value) ? p.value : 0,
    introducer: p.introducer ?? '—',
    closer: p.closer ?? '—',
    status: p.status ?? 'Pending',
    lastUpdated: p.lastUpdated ?? new Date().toISOString(),
    paymentStatus: p.paymentStatus ?? 'Not Paid',
    setupStatus: p.setupStatus ?? 'configuring',
  } as RecentDeal;
}

export function auditParticipantInput(participant: DemoParticipant): void {
  const missing: string[] = [];
  if (participant.participantLifecycle === undefined) missing.push('participantLifecycle');
  if (participant.agreementLifecycle === undefined) missing.push('agreementLifecycle');
  if (participant.compensationProfile === undefined) missing.push('compensationProfile');
  if (participant.payoutVerificationConfirmed === undefined) {
    missing.push('payoutVerificationConfirmed');
  }
  warnMissingParticipantFields(participant, missing);
  warnLegacyParticipantShape(participant);
  void detectParticipantEntitySource(participant);
}
