import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import {
  buildParticipantCoordinationView,
} from '@/lib/workflows/agreement-intelligence/participant-coordination';
import { REFERRAL_MANAGEMENT_SLUG } from '@/lib/workflows/referral-management/constants';

export const DUPLICATE_PROMOTER_MESSAGE =
  'A promoter with this email already exists. Open the existing relationship instead of creating a duplicate.';

export type ExistingPromoterRelationship = {
  participantId: string;
  name: string;
  email: string;
  role: string;
  statusLabel: string;
  compensationLabel: string | null;
  serviceSummary: string | null;
  manageUrl: string;
};

export function normalizePromoterEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isCompensatedPromoterEmailMatch(
  participant: Pick<DemoParticipant, 'email'>,
  email: string,
  isCompensated: boolean
): boolean {
  if (!isCompensated) return false;
  return normalizePromoterEmail(participant.email) === normalizePromoterEmail(email);
}

export function buildExistingPromoterRelationship(
  participant: DemoParticipant,
  catalog: Array<{ id: string; name: string }> = []
): ExistingPromoterRelationship {
  const view = buildParticipantCoordinationView(participant, {
    catalogItems: catalog,
    operatorApprovalRequired: true,
  });
  const statusLabel =
    view.referralStatus === 'active'
      ? 'Referral operational'
      : view.agreementStatus === 'approved'
        ? 'Approved'
        : participant.approvalStatus?.trim() || 'Needs setup';
  const serviceNames = view.eligibleServiceIds
    .map((id) => catalog.find((item) => item.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  const noteRole = participant.participantNotes?.split('·')[0]?.trim();
  const role =
    noteRole && /^(Promoter|Affiliate|Partner|Other|Stakeholder)$/i.test(noteRole)
      ? noteRole
      : participant.role?.trim() || 'Promoter';

  return {
    participantId: participant.id,
    name: participant.name.trim() || 'Promoter',
    email: participant.email.trim(),
    role,
    statusLabel,
    compensationLabel: view.compensationLabel,
    serviceSummary: view.referral?.destinationLabel || serviceNames.join(', ') || null,
    manageUrl: COMMERCIAL_OS_ROUTES.workflowParticipant(REFERRAL_MANAGEMENT_SLUG, participant.id),
  };
}

export function findExistingPromoterByEmail<T extends { email?: string | null }>(
  promoters: T[],
  email: string
): T | null {
  const needle = normalizePromoterEmail(email);
  if (!needle) return null;
  return promoters.find((row) => normalizePromoterEmail(row.email ?? '') === needle) ?? null;
}
