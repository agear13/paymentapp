import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  applyApprovedChangeToParticipant,
  cancelPendingChangeRequests,
  markChangeRequest,
  pendingAgreementChangeRequests,
  submitAgreementChangeRequest,
  type AgreementChangeRequest,
  type SubmitAgreementChangeInput,
} from '@/lib/agreements/agreement-change-request';
import {
  defaultAgreementTitle,
  issueSupersedingAgreementVersion,
  resetAgreementForNewVersion,
  resolveAgreementPresentation,
} from '@/lib/agreements/agreement-presentation';
import { loadOrganizationAgreementBranding } from '@/lib/agreements/organization-agreement-branding.server';
import { dispatchCommercialNotification } from '@/lib/commercial/dispatch-commercial-notification.server';
import { sendEmail } from '@/lib/email/client';
import {
  buildAgreementChangeClarificationEmail,
  buildAgreementChangeRejectedEmail,
  buildAgreementUpdatedEmail,
} from '@/lib/email/templates/agreement-change-decision';
import {
  participantRowToDemo,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { ensureParticipantPortalToken } from '@/lib/participant-portal/participant-portal.server';
import { buildParticipantWorkspaceUrl } from '@/lib/participant-portal/participant-portal-url';
import { resolveOrganizationIdForPilotDeal } from '@/lib/referrals/ensure-referral-issuance';

export class AgreementChangeRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = 'AgreementChangeRequestError';
  }
}

async function persistParticipantRecord(participant: DemoParticipant): Promise<DemoParticipant> {
  const { authenticatedUserId: _boundId, ...payload } = participant;
  const pending = participant.approvalStatus !== 'Approved';
  const row = await prisma.deal_network_pilot_participants.update({
    where: { id: participant.id },
    data: {
      name: participant.name.trim() || undefined,
      email: participant.email?.trim() ? participant.email.trim() : null,
      approval_status: pending ? 'Pending approval' : 'Approved',
      approved_at: pending || !participant.approvedAt ? null : new Date(participant.approvedAt),
      participant_payload: payload as unknown as Prisma.InputJsonValue,
    },
  });
  return participantRowToDemo(row);
}

async function organizationContextForParticipant(participant: DemoParticipant, origin?: string | null) {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participant.id },
    include: { deal: true },
  });
  if (!row?.deal) {
    throw new AgreementChangeRequestError('Participant not found', 'NOT_FOUND', 404);
  }
  const organizationId = await resolveOrganizationIdForPilotDeal(row.deal.user_id, row.deal_id);
  const branding = await loadOrganizationAgreementBranding(organizationId, origin);
  const dealPayload = row.deal.deal_payload as { dealName?: string } | null;
  const projectName = dealPayload?.dealName?.trim() || row.deal.name?.trim() || branding?.legalName || 'Affiliate Agreement';
  return {
    row,
    organizationId,
    branding,
    projectName,
    operatorUserId: row.deal.user_id,
  };
}

export async function submitParticipantAgreementChange(input: {
  participant: DemoParticipant;
  origin?: string | null;
  suggestion: SubmitAgreementChangeInput;
}): Promise<{ participant: DemoParticipant; request: AgreementChangeRequest; duplicate: boolean }> {
  const result = submitAgreementChangeRequest(input.participant, input.suggestion);
  if (!result.ok) {
    throw new AgreementChangeRequestError(result.error, result.code, 400);
  }
  if (result.duplicate) {
    return { participant: input.participant, request: result.request, duplicate: true };
  }

  const persisted = await persistParticipantRecord(result.participant);
  const ctx = await organizationContextForParticipant(persisted, input.origin);
  if (ctx.organizationId) {
    void dispatchCommercialNotification({
      organizationId: ctx.organizationId,
      eventKind: 'agreement_change_suggested',
      projectId: persisted.dealId ?? ctx.row.deal_id,
      participantId: persisted.id,
      participantName: persisted.name,
      idempotencySuffix: result.request.id,
      actionUrl: `/workspace/workflows/referral-management?participant=${encodeURIComponent(persisted.id)}`,
    });
  }

  return { participant: persisted, request: result.request, duplicate: false };
}

export async function reviewParticipantAgreementChange(input: {
  participant: DemoParticipant;
  requestId: string;
  decision: 'approve' | 'reject' | 'request_clarification';
  reviewedBy: string;
  reviewNote?: string | null;
  origin?: string | null;
  organizationId?: string | null;
}): Promise<{
  participant: DemoParticipant;
  request: AgreementChangeRequest;
  resultingVersionId?: string;
}> {
  const pending = pendingAgreementChangeRequests(input.participant).find((row) => row.id === input.requestId);
  if (!pending) {
    throw new AgreementChangeRequestError('Change request not found or already reviewed.', 'NOT_FOUND', 404);
  }

  const reviewedAt = new Date().toISOString();
  const ctx = await organizationContextForParticipant(input.participant, input.origin);
  const organizationId = input.organizationId ?? ctx.organizationId;
  const branding = ctx.branding ?? {
    organizationName: ctx.projectName,
    legalName: ctx.projectName,
    logoUrl: null,
    logoSource: null,
  };

  if (input.decision === 'reject') {
    const marked = markChangeRequest(input.participant, pending.id, {
      status: 'rejected',
      reviewedBy: input.reviewedBy,
      reviewedAt,
      reviewNote: input.reviewNote?.trim() || null,
    });
    if (!marked.request) {
      throw new AgreementChangeRequestError('Change request not found.', 'NOT_FOUND', 404);
    }
    const persisted = await persistParticipantRecord(marked.participant);
    const presentation = resolveAgreementPresentation(persisted, branding, { projectName: ctx.projectName });
    await notifyParticipantDecision({
      participant: persisted,
      origin: input.origin,
      operatorUserId: ctx.operatorUserId,
      kind: 'rejected',
      organizationName: branding.legalName || branding.organizationName,
      agreementTitle: presentation.title,
      reviewNote: input.reviewNote,
      logoUrl: branding.logoUrl,
    });
    if (organizationId) {
      void dispatchCommercialNotification({
        organizationId,
        eventKind: 'agreement_change_rejected',
        projectId: persisted.dealId ?? ctx.row.deal_id,
        participantId: persisted.id,
        participantName: persisted.name,
        idempotencySuffix: pending.id,
        actionUrl: `/workspace/workflows/referral-management?participant=${encodeURIComponent(persisted.id)}`,
      });
    }
    return { participant: persisted, request: marked.request };
  }

  if (input.decision === 'request_clarification') {
    const note = input.reviewNote?.trim();
    if (!note) {
      throw new AgreementChangeRequestError('Add a clarification question.', 'INVALID_REASON', 400);
    }
    const marked = markChangeRequest(input.participant, pending.id, {
      status: 'clarification_requested',
      reviewedBy: input.reviewedBy,
      reviewedAt,
      reviewNote: note,
    });
    if (!marked.request) {
      throw new AgreementChangeRequestError('Change request not found.', 'NOT_FOUND', 404);
    }
    const persisted = await persistParticipantRecord(marked.participant);
    const presentation = resolveAgreementPresentation(persisted, branding, { projectName: ctx.projectName });
    await notifyParticipantDecision({
      participant: persisted,
      origin: input.origin,
      operatorUserId: ctx.operatorUserId,
      kind: 'clarification',
      organizationName: branding.legalName || branding.organizationName,
      agreementTitle: presentation.title,
      reviewNote: note,
      logoUrl: branding.logoUrl,
    });
    return { participant: persisted, request: marked.request };
  }

  let next = applyApprovedChangeToParticipant(input.participant, pending);
  next = resetAgreementForNewVersion(next);
  const issued = issueSupersedingAgreementVersion({
    participant: next,
    branding,
    sourceChangeRequestId: pending.id,
  });
  next = issued.participant;
  next = cancelPendingChangeRequests(next, pending.id, reviewedAt);
  const marked = markChangeRequest(next, pending.id, {
    status: 'approved',
    reviewedBy: input.reviewedBy,
    reviewedAt,
    reviewNote: input.reviewNote?.trim() || null,
    resultingAgreementVersionId: issued.next.versionId,
  });
  next = marked.participant;
  if (!marked.request) {
    throw new AgreementChangeRequestError('Change request not found.', 'NOT_FOUND', 404);
  }

  const portal = await ensureParticipantPortalToken(next.id, ctx.operatorUserId);
  next = {
    ...portal.participant,
    ...next,
    participantPortalToken: portal.token,
    agreementUrl: portal.participant.agreementUrl ?? next.agreementUrl,
  };

  const persisted = await persistParticipantRecord(next);
  const workspaceUrl = buildParticipantWorkspaceUrl(portal.token, input.origin ?? undefined);
  await notifyParticipantDecision({
    participant: persisted,
    origin: input.origin,
    operatorUserId: ctx.operatorUserId,
    kind: 'approved',
    organizationName: branding.legalName || branding.organizationName,
    agreementTitle: issued.next.title || defaultAgreementTitle(branding.legalName),
    workspaceUrl,
    logoUrl: branding.logoUrl,
  });

  if (organizationId) {
    void dispatchCommercialNotification({
      organizationId,
      eventKind: 'agreement_change_approved',
      projectId: persisted.dealId ?? ctx.row.deal_id,
      participantId: persisted.id,
      participantName: persisted.name,
      idempotencySuffix: `${pending.id}:${issued.next.versionId}`,
      actionUrl: `/workspace/workflows/referral-management?participant=${encodeURIComponent(persisted.id)}`,
    });
  }

  return {
    participant: persisted,
    request: { ...marked.request, resultingAgreementVersionId: issued.next.versionId },
    resultingVersionId: issued.next.versionId,
  };
}

async function notifyParticipantDecision(input: {
  participant: DemoParticipant;
  origin?: string | null;
  operatorUserId: string;
  kind: 'approved' | 'rejected' | 'clarification';
  organizationName: string;
  agreementTitle: string;
  reviewNote?: string | null;
  workspaceUrl?: string;
  logoUrl?: string | null;
}) {
  const to = input.participant.email?.trim();
  if (!to) return;
  const workspaceUrl =
    input.workspaceUrl ??
    (input.participant.participantPortalToken
      ? buildParticipantWorkspaceUrl(input.participant.participantPortalToken, input.origin ?? undefined)
      : '');
  const content =
    input.kind === 'approved'
      ? buildAgreementUpdatedEmail({
          participantName: input.participant.name,
          organizationName: input.organizationName,
          agreementTitle: input.agreementTitle,
          workspaceUrl,
          logoUrl: input.logoUrl,
        })
      : input.kind === 'clarification'
        ? buildAgreementChangeClarificationEmail({
            participantName: input.participant.name,
            organizationName: input.organizationName,
            agreementTitle: input.agreementTitle,
            reviewNote: input.reviewNote ?? '',
            workspaceUrl,
            logoUrl: input.logoUrl,
          })
        : buildAgreementChangeRejectedEmail({
            participantName: input.participant.name,
            organizationName: input.organizationName,
            agreementTitle: input.agreementTitle,
            reviewNote: input.reviewNote,
            workspaceUrl,
            logoUrl: input.logoUrl,
          });
  await sendEmail({
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [
      { name: 'category', value: `agreement-change-${input.kind}` },
      { name: 'participant_id', value: input.participant.id },
    ],
  });
}
