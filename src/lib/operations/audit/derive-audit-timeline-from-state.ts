import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import { mergeAuditTimeline } from '@/lib/operations/audit/operational-audit';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { hasPersistedCompensationTerms } from '@/lib/operations/primitives/participant-earnings-primitives';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';

/** Derive persisted audit entries from participant/deal operational state. */
export function deriveAuditTimelineFromParticipants(
  participants: DemoParticipant[],
  projectId?: string
): OperationalAuditEntry[] {
  const entries: OperationalAuditEntry[] = [];

  for (const raw of participants) {
    const p = hydrateOperationalParticipant(raw);
    const base = { projectId, participantId: p.id };

    if (p.agreementSharedAt || p.inviteSentAt) {
      entries.push({
        id: `agreement_shared-${p.id}-${p.agreementSharedAt ?? p.inviteSentAt}`,
        type: 'agreement_shared',
        title: 'Agreement shared for approval',
        description: `${p.name} received participation agreement.`,
        timestamp: p.agreementSharedAt ?? p.inviteSentAt ?? new Date().toISOString(),
        ...base,
      });
    }

    if (p.agreementViewedAt) {
      entries.push({
        id: `agreement_viewed-${p.id}-${p.agreementViewedAt}`,
        type: 'agreement_viewed',
        title: 'Agreement viewed by participant',
        description: `${p.name} opened the participation agreement.`,
        timestamp: p.agreementViewedAt,
        ...base,
      });
    }

    if (p.approvalStatus === 'Approved') {
      const approvedAt =
        p.approvedAt ??
        p.compensationProfile?.configuredAt ??
        new Date().toISOString();
      entries.push({
        id: `agreement_approved-${p.id}-${approvedAt}`,
        type: 'agreement_approved',
        title: 'Participation agreement approved',
        description: p.approvalNote?.trim()
          ? `${p.name} approved with note: "${p.approvalNote.trim()}"`
          : `${p.name} approved participation agreement.`,
        timestamp: approvedAt,
        ...base,
      });
    }

    if (p.approvalNote?.trim() && p.approvedAt) {
      entries.push({
        id: `participant_note-${p.id}-${p.approvedAt}`,
        type: 'participant_note_added',
        title: 'Participant note received',
        description: p.approvalNote.trim(),
        timestamp: p.approvedAt,
        ...base,
        actor: p.name,
      });
    }

    if (hasPersistedCompensationTerms(p)) {
      const configuredAt =
        p.compensationProfile?.configuredAt ??
        p.approvedAt ??
        new Date().toISOString();
      entries.push({
        id: `compensation_updated-${p.id}-${configuredAt}`,
        type: 'compensation_updated',
        title: 'Participant compensation updated',
        description: `Earnings configured for ${p.name}.`,
        timestamp: configuredAt,
        ...base,
      });
    }

    if (p.payoutVerificationConfirmed) {
      const confirmedAt = p.payoutVerificationConfirmedAt ?? new Date().toISOString();
      entries.push({
        id: `payout_state-${p.id}-${confirmedAt}`,
        type: 'payout_state_updated',
        title: 'Payout details confirmed',
        description: `Supplier onboarding complete for ${p.name}. Bank details, ABN, and GST confirmed.`,
        timestamp: confirmedAt,
        ...base,
      });
    }

    if (p.inviteLink || p.customerCommerceUrl) {
      entries.push({
        id: `attribution_configured-${p.id}`,
        type: 'attribution_configured',
        title: 'Attribution configuration updated',
        description: `Customer commerce link active for ${p.name}.`,
        timestamp: p.approvedAt ?? p.agreementSharedAt ?? new Date().toISOString(),
        ...base,
      });
    }
  }

  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function deriveAuditTimelineFromGraph(
  snapshot: OperationalCoordinationSnapshot,
  projectId?: string
): OperationalAuditEntry[] {
  const fromParticipants = deriveAuditTimelineFromParticipants(
    snapshot.participants.map((p) => p.participant),
    projectId
  );

  const fromObligations: OperationalAuditEntry[] = [];
  if (snapshot.obligations.length > 0) {
    fromObligations.push({
      id: `obligations_generated-${projectId ?? 'workspace'}-${snapshot.obligations.length}`,
      type: 'obligations_generated',
      title: 'Operational obligations tracked',
      description: `${snapshot.obligations.length} obligation line(s) in coordination graph.`,
      timestamp: new Date().toISOString(),
      projectId,
    });
  }

  if (snapshot.summary.releaseReadyCount > 0) {
    fromObligations.push({
      id: `payout_eligible-${projectId ?? 'workspace'}-${snapshot.summary.releaseReadyCount}`,
      type: 'payout_eligible',
      title: 'Release eligibility achieved',
      description: `${snapshot.summary.releaseReadyCount} participant(s) release-ready.`,
      timestamp: new Date().toISOString(),
      projectId,
    });
  }

  if (snapshot.funding.stage?.fundingSourceConnected) {
    fromObligations.push({
      id: `funding_linked-${projectId ?? 'workspace'}`,
      type: 'funding_linked',
      title: 'Funding source connected',
      description: snapshot.funding.stage.primaryLabel,
      timestamp: new Date().toISOString(),
      projectId,
    });
  }

  return mergeAuditTimeline(fromParticipants, fromObligations);
}

export function filterAuditTimeline(
  entries: OperationalAuditEntry[],
  filter?: { projectId?: string; participantId?: string; types?: OperationalAuditEntry['type'][] }
): OperationalAuditEntry[] {
  if (!filter) return entries;
  return entries.filter((e) => {
    if (filter.projectId && e.projectId && e.projectId !== filter.projectId) return false;
    if (filter.participantId && e.participantId && e.participantId !== filter.participantId)
      return false;
    if (filter.types && !filter.types.includes(e.type)) return false;
    return true;
  });
}
