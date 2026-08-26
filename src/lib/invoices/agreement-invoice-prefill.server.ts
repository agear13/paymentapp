import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { parseSourceParticipantHint } from '@/lib/participants/source-participant-hint';
import { isAuthorisedParticipantWorkspaceIdentity } from '@/lib/participant-portal/participant-access';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import {
  dealRowToRecentDeal,
  participantRowToDemo,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  buildAgreementInvoicePrefill,
  PARTICIPANT_PORTAL_INVOICE_ORIGIN,
  type AgreementInvoicePrefill,
  type ParticipantPortalInvoiceProvenance,
} from '@/lib/invoices/agreement-invoice-prefill';

export type AuthorizedAgreementInvoicePrefillResult =
  | { kind: 'ok'; prefill: AgreementInvoicePrefill }
  | { kind: 'denied' };

export type AuthorizedInvoiceOriginProvenanceResult =
  | { kind: 'ok'; provenance: ParticipantPortalInvoiceProvenance }
  | { kind: 'denied' };

async function loadAuthorizedParticipantInvoiceRow(input: {
  user: { id: string; email?: string | null };
  sourceParticipantId: unknown;
}) {
  const parsed = parseSourceParticipantHint(input.sourceParticipantId);
  const actorId = input.user.id?.trim();
  if (parsed.kind !== 'hint' || !actorId) {
    return { kind: 'denied' as const };
  }

  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: parsed.value },
    include: { deal: true },
  });
  if (!row?.deal) {
    return { kind: 'denied' as const };
  }

  const authorised = isAuthorisedParticipantWorkspaceIdentity({
    user: input.user,
    participantEmail: row.email,
    authenticatedUserId: row.authenticated_user_id,
    dealOwnerUserId: row.deal.user_id,
  });
  if (!authorised) {
    return { kind: 'denied' as const };
  }

  return { kind: 'ok' as const, row };
}

/**
 * Load agreement-origin invoice prefill for the signed-in participant.
 * sourceParticipantId is a routing hint, not commercial authority.
 * Operator preview and unauthenticated callers never receive compensation facts.
 */
export async function loadAuthorizedAgreementInvoicePrefill(input: {
  user: { id: string; email?: string | null };
  sourceParticipantId: unknown;
}): Promise<AuthorizedAgreementInvoicePrefillResult> {
  const loaded = await loadAuthorizedParticipantInvoiceRow(input);
  if (loaded.kind !== 'ok') {
    return { kind: 'denied' };
  }

  const { row } = loaded;
  const actorId = input.user.id.trim();
  if (row.converted_organization_id) {
    const org = await getOrganizationForAuthenticatedUser(actorId);
    if (org && org.id !== row.converted_organization_id) {
      return { kind: 'denied' };
    }
  }

  const participant = participantRowToDemo(row);
  const deal = dealRowToRecentDeal(row.deal);
  const prefill = buildAgreementInvoicePrefill({
    participant,
    deal,
    originSourceOrganizationId: row.source_organization_id,
  });

  return { kind: 'ok', prefill };
}

/**
 * Server-derived participant-portal provenance for payment_links.
 * Requires the authenticated user's current org to be the converted workspace.
 * Never trusts client-supplied origin IDs.
 */
export async function resolveParticipantPortalInvoiceProvenance(input: {
  user: { id: string; email?: string | null };
  organizationId: string;
  sourceParticipantId: unknown;
}): Promise<AuthorizedInvoiceOriginProvenanceResult> {
  const organizationId = input.organizationId.trim();
  if (!organizationId) {
    return { kind: 'denied' };
  }

  const loaded = await loadAuthorizedParticipantInvoiceRow(input);
  if (loaded.kind !== 'ok') {
    return { kind: 'denied' };
  }

  const { row } = loaded;
  if (!row.converted_organization_id || row.converted_organization_id !== organizationId) {
    return { kind: 'denied' };
  }

  return {
    kind: 'ok',
    provenance: {
      invoiceOrigin: PARTICIPANT_PORTAL_INVOICE_ORIGIN,
      originParticipantId: row.id,
      originSourceOrganizationId: row.source_organization_id,
      originDealId: row.deal_id,
    },
  };
}
