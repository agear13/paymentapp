import type { CommercialTimelineEvent } from '@/lib/workspace-timeline/commercial-timeline-types';

export type RelatedActivityLabel =
  | 'Related activity'
  | 'Linked payment activity'
  | 'Related settlement activity'
  | 'Same participant';

function same(a?: string, b?: string): boolean {
  return Boolean(a && b && a === b);
}

function isBatchEvent(event: CommercialTimelineEvent): boolean {
  return event.entityType === 'payout_batch';
}

function isPayoutEvent(event: CommercialTimelineEvent): boolean {
  return event.entityType === 'payout' || event.action === 'payout_paid';
}

function isAgreementEvent(event: CommercialTimelineEvent): boolean {
  return event.entityType === 'organization_workflow_agreement' || Boolean(event.agreementId);
}

function sharesDeal(a: CommercialTimelineEvent, b: CommercialTimelineEvent): boolean {
  return Boolean(a.dealId && b.dealId && a.dealId === b.dealId);
}

function paymentLinkIdsReachedFrom(
  event: CommercialTimelineEvent,
  all: CommercialTimelineEvent[]
): Set<string> {
  const ids = new Set<string>();
  if (event.paymentLinkId) ids.add(event.paymentLinkId);

  for (const item of all) {
    if (event.paymentEventId && item.paymentEventId === event.paymentEventId && item.paymentLinkId) {
      ids.add(item.paymentLinkId);
    }
    if (event.payoutId && item.payoutId === event.payoutId && item.paymentLinkId) {
      ids.add(item.paymentLinkId);
    }
    if (
      event.commissionObligationId &&
      item.commissionObligationId === event.commissionObligationId &&
      item.paymentLinkId
    ) {
      ids.add(item.paymentLinkId);
    }
    if (event.obligationId && item.obligationId === event.obligationId && item.paymentLinkId) {
      ids.add(item.paymentLinkId);
    }
  }

  return ids;
}

function payoutIdsReachedFrom(
  event: CommercialTimelineEvent,
  all: CommercialTimelineEvent[]
): Set<string> {
  const ids = new Set<string>();
  if (event.payoutId) ids.add(event.payoutId);

  const paymentLinks = paymentLinkIdsReachedFrom(event, all);
  for (const item of all) {
    if (item.payoutId && item.paymentLinkId && paymentLinks.has(item.paymentLinkId)) {
      ids.add(item.payoutId);
    }
  }

  return ids;
}

function relatedByPaymentChain(
  origin: CommercialTimelineEvent,
  candidate: CommercialTimelineEvent,
  all: CommercialTimelineEvent[]
): boolean {
  if (isBatchEvent(candidate)) return false;
  if (same(origin.paymentLinkId, candidate.paymentLinkId)) return true;
  if (same(origin.paymentEventId, candidate.paymentEventId)) return true;

  const originLinks = paymentLinkIdsReachedFrom(origin, all);
  if (candidate.paymentLinkId && originLinks.has(candidate.paymentLinkId)) return true;

  if (sharesDeal(origin, candidate)) {
    if (isAgreementEvent(origin) || isAgreementEvent(candidate)) return true;
    if (origin.obligationId || candidate.obligationId) return true;
  }

  const payoutIds = payoutIdsReachedFrom(origin, all);
  if (candidate.payoutId && payoutIds.has(candidate.payoutId)) return true;

  return false;
}

function fundingPaymentLinkIdsForParticipant(
  participantId: string,
  all: CommercialTimelineEvent[]
): Set<string> {
  const ids = new Set<string>();
  for (const item of all) {
    if (item.participantId !== participantId) continue;
    if (item.paymentLinkId) ids.add(item.paymentLinkId);
  }
  return ids;
}

function relatedByParticipant(
  origin: CommercialTimelineEvent,
  candidate: CommercialTimelineEvent,
  all: CommercialTimelineEvent[]
): boolean {
  if (!origin.participantId) return false;
  if (candidate.participantId === origin.participantId) return true;

  const fundingLinks = fundingPaymentLinkIdsForParticipant(origin.participantId, all);
  return Boolean(candidate.paymentLinkId && fundingLinks.has(candidate.paymentLinkId));
}

function relatedByAgreement(origin: CommercialTimelineEvent, candidate: CommercialTimelineEvent): boolean {
  if (same(origin.agreementId, candidate.agreementId)) return true;
  return sharesDeal(origin, candidate);
}

function relatedByPayout(
  origin: CommercialTimelineEvent,
  candidate: CommercialTimelineEvent,
  all: CommercialTimelineEvent[]
): boolean {
  if (same(origin.payoutId, candidate.payoutId)) return true;

  if (isPayoutEvent(origin) && !isBatchEvent(origin)) {
    if (same(origin.payoutBatchId, candidate.payoutBatchId) && isBatchEvent(candidate)) return true;
    if (candidate.payoutId && origin.payoutId && candidate.payoutId !== origin.payoutId) return false;
    return relatedByPaymentChain(origin, candidate, all);
  }

  if (isBatchEvent(origin)) {
    return (
      same(origin.payoutBatchId, candidate.payoutBatchId) &&
      (isBatchEvent(candidate) || isPayoutEvent(candidate))
    );
  }

  return false;
}

export function eventsAreRelated(
  origin: CommercialTimelineEvent,
  candidate: CommercialTimelineEvent,
  all: CommercialTimelineEvent[]
): boolean {
  if (origin.id === candidate.id) return false;

  if (isBatchEvent(origin)) {
    return relatedByPayout(origin, candidate, all);
  }

  if (origin.agreementId && !origin.paymentLinkId && !origin.payoutId) {
    return relatedByAgreement(origin, candidate);
  }

  if (origin.action === 'participant_added' && origin.participantId) {
    return relatedByParticipant(origin, candidate, all);
  }

  if (isPayoutEvent(origin) && origin.payoutId) {
    return relatedByPayout(origin, candidate, all);
  }

  if (origin.paymentLinkId || origin.paymentEventId || origin.commissionObligationId || origin.obligationId) {
    return relatedByPaymentChain(origin, candidate, all);
  }

  if (origin.participantId) {
    return relatedByParticipant(origin, candidate, all);
  }

  if (origin.agreementId || origin.dealId) {
    return relatedByAgreement(origin, candidate);
  }

  return false;
}

export function relatedActivityLabel(
  origin: CommercialTimelineEvent,
  related: CommercialTimelineEvent[]
): RelatedActivityLabel {
  if (related.some((item) => item.paymentLinkId && item.paymentLinkId === origin.paymentLinkId)) {
    return 'Linked payment activity';
  }
  if (origin.payoutBatchId || origin.payoutId) {
    return 'Related settlement activity';
  }
  if (
    origin.participantId &&
    related.every((item) => item.participantId === origin.participantId || Boolean(item.paymentLinkId))
  ) {
    return 'Same participant';
  }
  return 'Related activity';
}

export function findRelatedTimelineEvents(
  origin: CommercialTimelineEvent,
  all: CommercialTimelineEvent[]
): CommercialTimelineEvent[] {
  const seen = new Set<string>([origin.id]);
  const related: CommercialTimelineEvent[] = [];
  for (const candidate of all) {
    if (seen.has(candidate.id)) continue;
    if (!eventsAreRelated(origin, candidate, all)) continue;
    seen.add(candidate.id);
    related.push(candidate);
  }
  return related;
}

export function timelineClusterKey(event: CommercialTimelineEvent): string | null {
  if (event.paymentLinkId) return `payment:${event.paymentLinkId}`;
  if (event.dealId) return `deal:${event.dealId}`;
  return null;
}

export function eventMatchesParticipantFilter(
  event: CommercialTimelineEvent,
  participantId: string,
  all: CommercialTimelineEvent[]
): boolean {
  if (event.participantId === participantId) return true;
  const fundingLinks = fundingPaymentLinkIdsForParticipant(participantId, all);
  return Boolean(event.paymentLinkId && fundingLinks.has(event.paymentLinkId));
}
