import 'server-only';

import { cookies } from 'next/headers';
import { resolveCsrfSecret } from '@/lib/security/csrf-secret.server';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import {
  dealRowToRecentDeal,
  participantRowToDemo,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  classifyAgreementInvoiceCompensation,
  parsePartyOwnedCalendarDate,
} from '@/lib/invoices/agreement-invoice-prefill';
import { inferCompensationTypeFromParticipant } from '@/lib/participants/participant-compensation';
import { PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT } from '@/lib/ai-extractor/party-linked-settlement';
import { resolveParticipantExportPayoutTiming } from '@/lib/deal-network-demo/export-payout-timing';
import {
  createParticipantTestContextPayload,
  isEligibleParticipantTestSubject,
  isParticipantTestContextEnabled,
  PARTICIPANT_TEST_CONTEXT_COOKIE,
  resolveVerifiedParticipantTestContext,
  signParticipantTestContext,
  type VerifiedParticipantTestContext,
} from '@/lib/participant-portal/participant-test-context';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export async function readParticipantTestContextCookieValue(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(PARTICIPANT_TEST_CONTEXT_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function resolveRequestParticipantTestContext(input: {
  actorUserId: string;
  participantId: string;
  dealOwnerUserId: string;
  authenticatedUserId?: string | null;
  portalToken?: string | null;
  cookieValue?: string | null;
  testContext?: VerifiedParticipantTestContext | null;
}): Promise<VerifiedParticipantTestContext | null> {
  if (input.testContext !== undefined) {
    return input.testContext;
  }
  const cookieValue =
    input.cookieValue !== undefined
      ? input.cookieValue
      : await readParticipantTestContextCookieValue();
  return resolveVerifiedParticipantTestContext({
    enabled: isParticipantTestContextEnabled(),
    cookieValue,
    secret: resolveCsrfSecret(),
    actorUserId: input.actorUserId,
    participantId: input.participantId,
    portalToken: input.portalToken,
    dealOwnerUserId: input.dealOwnerUserId,
    authenticatedUserId: input.authenticatedUserId,
  });
}

export type ParticipantTestFixtureRow = {
  participantId: string;
  name: string;
  invitedEmail: string | null;
  projectName: string;
  portalToken: string | null;
  portalPath: string | null;
  eligible: boolean;
  ineligibleReason: string | null;
  converted: boolean;
  convertedOrganizationId: string | null;
  sourceOrganizationId: string | null;
  boundToActor: boolean;
  boundToOtherUser: boolean;
  unbound: boolean;
  labels: string[];
};

export async function listParticipantTestFixturesForActor(
  actorUserId: string
): Promise<ParticipantTestFixtureRow[]> {
  const deals = await prisma.deal_network_pilot_deals.findMany({
    where: { user_id: actorUserId },
    orderBy: { updated_at: 'desc' },
  });
  if (deals.length === 0) return [];

  const rows = await prisma.deal_network_pilot_participants.findMany({
    where: { deal_id: { in: deals.map((deal) => deal.id) } },
    include: { deal: true },
    orderBy: { updated_at: 'desc' },
  });

  return rows.map((row) => {
    const participant = participantRowToDemo(row);
    const deal = dealRowToRecentDeal(row.deal);
    const portalToken = participant.participantPortalToken?.trim() || null;
    const eligibility = isEligibleParticipantTestSubject({
      actorUserId,
      dealOwnerUserId: row.deal.user_id,
      authenticatedUserId: row.authenticated_user_id,
    });
    const boundId = row.authenticated_user_id?.trim() || null;
    return {
      participantId: row.id,
      name: participant.name?.trim() || 'Participant',
      invitedEmail: row.email?.trim() || participant.email?.trim() || null,
      projectName: deal.dealName?.trim() || 'Project',
      portalToken,
      portalPath: portalToken ? `/participant/${encodeURIComponent(portalToken)}` : null,
      eligible: eligibility.eligible && Boolean(portalToken),
      ineligibleReason: !portalToken
        ? 'missing_portal_token'
        : eligibility.eligible
          ? null
          : eligibility.reason,
      converted: Boolean(row.converted_organization_id?.trim()),
      convertedOrganizationId: row.converted_organization_id,
      sourceOrganizationId: row.source_organization_id,
      boundToActor: Boolean(boundId && boundId === actorUserId),
      boundToOtherUser: Boolean(boundId && boundId !== actorUserId),
      unbound: !boundId,
      labels: deriveParticipantTestLabels({
        participant,
        convertedOrganizationId: row.converted_organization_id,
        sourceOrganizationId: row.source_organization_id,
        authenticatedUserId: row.authenticated_user_id,
        actorUserId,
      }),
    };
  });
}

export async function mintParticipantTestContextForActor(input: {
  actorUserId: string;
  participantId: string;
}): Promise<
  | { ok: true; cookieValue: string; portalPath: string; participantId: string }
  | { ok: false; status: number; error: string }
> {
  if (!isParticipantTestContextEnabled()) {
    return { ok: false, status: 404, error: 'Not found' };
  }

  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: input.participantId },
    include: { deal: true },
  });
  if (!row?.deal) {
    return { ok: false, status: 404, error: 'Participant not found' };
  }

  const eligibility = isEligibleParticipantTestSubject({
    actorUserId: input.actorUserId,
    dealOwnerUserId: row.deal.user_id,
    authenticatedUserId: row.authenticated_user_id,
  });
  if (!eligibility.eligible) {
    return { ok: false, status: 403, error: 'Participant is not eligible for test access' };
  }

  const participant = participantRowToDemo(row);
  const portalToken = participant.participantPortalToken?.trim();
  if (!portalToken) {
    return { ok: false, status: 400, error: 'Participant has no portal token' };
  }

  const payload = createParticipantTestContextPayload({
    actorUserId: input.actorUserId,
    participantId: row.id,
    portalToken,
  });
  const cookieValue = signParticipantTestContext(payload, resolveCsrfSecret());
  log.info('participant.test_context_minted', {
    actorUserId: input.actorUserId,
    participantId: row.id,
  });
  return {
    ok: true,
    cookieValue,
    portalPath: `/participant/${encodeURIComponent(portalToken)}`,
    participantId: row.id,
  };
}

export function deriveParticipantTestLabels(input: {
  participant: DemoParticipant;
  convertedOrganizationId?: string | null;
  sourceOrganizationId?: string | null;
  authenticatedUserId?: string | null;
  actorUserId: string;
}): string[] {
  const labels: string[] = [];
  const compensationType = inferCompensationTypeFromParticipant(input.participant);
  const classified = classifyAgreementInvoiceCompensation(input.participant);
  if (compensationType === 'HYBRID') {
    labels.push('hybrid');
  } else if (classified === 'variable') {
    labels.push('variable');
  } else {
    labels.push('fixed-fee');
  }

  if (input.convertedOrganizationId?.trim()) {
    labels.push('converted');
    labels.push('already-attributed');
  } else {
    labels.push('unconverted');
  }

  if (input.sourceOrganizationId?.trim()) {
    labels.push('source-org-present');
    if (!input.convertedOrganizationId?.trim()) {
      labels.push('reuse-eligible-if-actor-bound-owner');
    }
  } else {
    labels.push('missing-source-org');
  }

  const boundId = input.authenticatedUserId?.trim() || null;
  if (!boundId) labels.push('unbound');
  else if (boundId === input.actorUserId) labels.push('bound-to-actor');
  else labels.push('bound-to-other-user');

  const hasPaymentSetup = Boolean(
    input.participant.paymentSetup?.token ||
      input.participant.supplierOnboarding?.payment ||
      input.participant.supplierOnboarding?.submission
  );
  if (!hasPaymentSetup) labels.push('no-payment-rails');

  const calendarDue = parsePartyOwnedCalendarDate(input.participant.payoutDueDate);
  if (calendarDue) {
    labels.push('party-owned-due-date');
  } else {
    const timingText = resolveParticipantExportPayoutTiming(input.participant);
    if (!timingText || timingText === PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT) {
      labels.push('narrative-timing');
    } else if (!parsePartyOwnedCalendarDate(timingText)) {
      labels.push('narrative-timing');
    }
  }

  return labels;
}
