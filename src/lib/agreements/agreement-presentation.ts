/**
 * Organisation-branded agreement presentation and version snapshots.
 *
 * Agreements are still live-rendered in the participant portal. Branding and
 * commercial terms are captured onto the participant payload when an agreement
 * is generated or a new version is issued so later organisation logo changes
 * cannot rewrite historical versions.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { merchantInitials } from '@/lib/branding/resolve-merchant-branding';
import {
  ATTRIBUTION_METHOD_LABELS,
  formatEarningSourceDestination,
  type ReferralEarningSource,
} from '@/lib/workflows/referral-management/earning-source';

export const AGREEMENT_VERSION_STATUSES = ['current', 'superseded'] as const;
export type AgreementVersionStatus = (typeof AGREEMENT_VERSION_STATUSES)[number];

export type AgreementBrandingSnapshot = {
  organizationName: string;
  legalName: string;
  logoUrl: string | null;
  logoSource: string | null;
  initials: string;
  capturedAt: string;
};

export type AgreementPresentationFields = {
  participantName: string;
  email: string;
  phone: string;
  companyName: string;
  role: string;
  commissionLabel: string;
  commissionType: string;
  earningSourceLabel: string;
  attributionLabel: string;
  audienceDiscountLabel: string;
  referralTerms: string;
};

export type AgreementPresentationSnapshot = {
  versionId: string;
  versionNumber: number;
  title: string;
  branding: AgreementBrandingSnapshot;
  fields: AgreementPresentationFields;
  createdAt: string;
  status: AgreementVersionStatus;
  supersededAt?: string;
  supersededByVersionId?: string;
  sourceChangeRequestId?: string;
};

export type ResolvedAgreementPresentation = {
  title: string;
  versionId: string | null;
  versionNumber: number;
  branding: AgreementBrandingSnapshot;
  fields: AgreementPresentationFields;
  fromSnapshot: boolean;
  history: AgreementPresentationSnapshot[];
};

export type OrganizationAgreementBranding = {
  organizationName: string;
  legalName: string;
  logoUrl: string | null;
  logoSource: string | null;
};

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

export function phoneFromParticipant(participant: Pick<DemoParticipant, 'phone' | 'participantNotes'>): string {
  const direct = asString(participant.phone);
  if (direct) return direct;
  const notes = asString(participant.participantNotes);
  const match = notes.match(/phone:\s*(.+)/i);
  return match?.[1]?.trim() ?? '';
}

export function audienceDiscountPctFromParticipant(
  participant: Pick<DemoParticipant, 'audienceDiscountPct' | 'earningSource'>
): number | null {
  if (typeof participant.audienceDiscountPct === 'number' && Number.isFinite(participant.audienceDiscountPct)) {
    return participant.audienceDiscountPct;
  }
  const raw = participant.earningSource?.metadata?.audienceDiscountPct;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw.replace(/%/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function formatAudienceDiscountLabel(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '';
  return `${pct}% audience discount`;
}

export function formatCommissionType(participant: DemoParticipant): string {
  if (participant.participationModel === 'fixed_payout' || participant.commissionKind === 'fixed_amount') {
    return 'Fixed payment';
  }
  if (participant.compensationProfile?.compensationType === 'REVENUE_SHARE') {
    return 'Revenue share';
  }
  if (participant.compensationProfile?.compensationType === 'COMMISSION') {
    return 'Commission';
  }
  if (participant.commissionKind === 'pct_deal_value') return 'Revenue share';
  return participant.commissionKind || 'Commission';
}

export function formatCommissionLabel(participant: DemoParticipant): string {
  const profile = participant.compensationProfile;
  if (profile?.compensationType === 'REVENUE_SHARE' && (profile.percentage ?? 0) > 0) {
    return `${profile.percentage}% revenue share`;
  }
  if (profile?.compensationType === 'COMMISSION' && (profile.percentage ?? 0) > 0) {
    return `${profile.percentage}% commission`;
  }
  if (profile?.compensationType === 'FIXED_FEE' && (profile.fixedAmount ?? 0) > 0) {
    return `$${Number(profile.fixedAmount).toLocaleString()} fixed payment`;
  }
  if (participant.commissionKind === 'pct_deal_value' && (participant.commissionValue ?? 0) > 0) {
    return `${participant.commissionValue}% revenue share`;
  }
  if (participant.commissionKind === 'fixed_amount' && (participant.commissionValue ?? 0) > 0) {
    return `$${Number(participant.commissionValue).toLocaleString()} fixed payment`;
  }
  return '';
}

export function formatEarningSourceLabel(source: ReferralEarningSource | null | undefined): string {
  if (!source) return '';
  if (source.type === 'external') {
    return formatEarningSourceDestination(source) || 'External';
  }
  return 'Internal catalogue';
}

export function formatAttributionLabel(source: ReferralEarningSource | null | undefined): string {
  const method = source?.attributionMethod;
  if (!method) return '';
  return ATTRIBUTION_METHOD_LABELS[method] ?? method;
}

export function defaultAgreementTitle(organizationName: string, role?: string | null): string {
  const org = organizationName.trim() || 'Affiliate';
  const roleLabel = role?.trim();
  if (roleLabel && /affiliate|promoter|partner/i.test(roleLabel)) {
    return `${org} ${roleLabel} Agreement`;
  }
  return `${org} Affiliate Agreement`;
}

export function captureAgreementFields(participant: DemoParticipant): AgreementPresentationFields {
  return {
    participantName: participant.name?.trim() || '',
    email: participant.email?.trim() || '',
    phone: phoneFromParticipant(participant),
    companyName: participant.companyName?.trim() || '',
    role: participant.roleLabel?.trim() || participant.role?.trim() || '',
    commissionLabel: formatCommissionLabel(participant),
    commissionType: formatCommissionType(participant),
    earningSourceLabel: formatEarningSourceLabel(participant.earningSource),
    attributionLabel: formatAttributionLabel(participant.earningSource),
    audienceDiscountLabel: formatAudienceDiscountLabel(audienceDiscountPctFromParticipant(participant)),
    referralTerms: participant.agreementNotes?.trim() || participant.roleDetails?.trim() || '',
  };
}

export function brandingFromOrganization(
  branding: OrganizationAgreementBranding,
  capturedAt = new Date().toISOString()
): AgreementBrandingSnapshot {
  const organizationName = branding.organizationName.trim() || 'Organisation';
  const legalName = branding.legalName.trim() || organizationName;
  return {
    organizationName,
    legalName,
    logoUrl: branding.logoUrl?.trim() || null,
    logoSource: branding.logoSource?.trim() || null,
    initials: merchantInitials(legalName || organizationName),
    capturedAt,
  };
}

export function agreementVersionsOf(participant: DemoParticipant): AgreementPresentationSnapshot[] {
  return Array.isArray(participant.agreementVersions) ? participant.agreementVersions : [];
}

export function currentAgreementVersion(
  participant: DemoParticipant
): AgreementPresentationSnapshot | null {
  const versions = agreementVersionsOf(participant);
  return versions.find((version) => version.status === 'current') ?? versions.at(-1) ?? null;
}

export function nextAgreementVersionNumber(participant: DemoParticipant): number {
  const versions = agreementVersionsOf(participant);
  if (versions.length === 0) return 1;
  return Math.max(...versions.map((version) => version.versionNumber || 0)) + 1;
}

export function createAgreementVersion(input: {
  participant: DemoParticipant;
  branding: OrganizationAgreementBranding;
  title?: string;
  versionId?: string;
  createdAt?: string;
  sourceChangeRequestId?: string;
}): AgreementPresentationSnapshot {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const branding = brandingFromOrganization(input.branding, createdAt);
  return {
    versionId: input.versionId ?? crypto.randomUUID(),
    versionNumber: nextAgreementVersionNumber(input.participant),
    title: input.title?.trim() || defaultAgreementTitle(branding.legalName || branding.organizationName, input.participant.role),
    branding,
    fields: captureAgreementFields(input.participant),
    createdAt,
    status: 'current',
    sourceChangeRequestId: input.sourceChangeRequestId,
  };
}

export function attachAgreementVersion(
  participant: DemoParticipant,
  version: AgreementPresentationSnapshot
): DemoParticipant {
  const previous = agreementVersionsOf(participant).map((existing) =>
    existing.status === 'current' && existing.versionId !== version.versionId
      ? {
          ...existing,
          status: 'superseded' as const,
          supersededAt: version.createdAt,
          supersededByVersionId: version.versionId,
        }
      : existing
  );
  return {
    ...participant,
    agreementVersions: [...previous.filter((row) => row.versionId !== version.versionId), version],
  };
}

export function ensureAgreementVersion(
  participant: DemoParticipant,
  branding: OrganizationAgreementBranding,
  options?: { title?: string; createdAt?: string }
): { participant: DemoParticipant; version: AgreementPresentationSnapshot; created: boolean } {
  const existing = currentAgreementVersion(participant);
  if (existing) {
    return { participant, version: existing, created: false };
  }
  const version = createAgreementVersion({
    participant,
    branding,
    title: options?.title,
    createdAt: options?.createdAt,
  });
  return {
    participant: attachAgreementVersion(participant, version),
    version,
    created: true,
  };
}

export function issueSupersedingAgreementVersion(input: {
  participant: DemoParticipant;
  branding: OrganizationAgreementBranding;
  sourceChangeRequestId?: string;
  title?: string;
  createdAt?: string;
}): { participant: DemoParticipant; previous: AgreementPresentationSnapshot | null; next: AgreementPresentationSnapshot } {
  const next = createAgreementVersion({
    participant: input.participant,
    branding: input.branding,
    title: input.title,
    createdAt: input.createdAt,
    sourceChangeRequestId: input.sourceChangeRequestId,
  });
  const previousId = currentAgreementVersion(input.participant)?.versionId;
  const participant = attachAgreementVersion(input.participant, next);
  const previous =
    participant.agreementVersions?.find((version) => version.versionId === previousId) ?? null;
  return {
    participant,
    previous,
    next,
  };
}

export function resolveAgreementPresentation(
  participant: DemoParticipant,
  liveBranding?: OrganizationAgreementBranding | null,
  options?: { projectName?: string | null }
): ResolvedAgreementPresentation {
  const snapshot = currentAgreementVersion(participant);
  if (snapshot) {
    return {
      title: snapshot.title,
      versionId: snapshot.versionId,
      versionNumber: snapshot.versionNumber,
      branding: snapshot.branding,
      fields: snapshot.fields,
      fromSnapshot: true,
      history: agreementVersionsOf(participant),
    };
  }

  const branding = liveBranding
    ? brandingFromOrganization(liveBranding)
    : brandingFromOrganization({
        organizationName: options?.projectName?.trim() || participant.partner || 'Organisation',
        legalName: options?.projectName?.trim() || participant.partner || 'Organisation',
        logoUrl: null,
        logoSource: null,
      });

  return {
    title: defaultAgreementTitle(branding.legalName || branding.organizationName, participant.role),
    versionId: null,
    versionNumber: 1,
    branding,
    fields: captureAgreementFields(participant),
    fromSnapshot: false,
    history: [],
  };
}

export function resetAgreementForNewVersion(participant: DemoParticipant): DemoParticipant {
  const now = new Date().toISOString();
  return {
    ...participant,
    approvalStatus: 'Pending approval',
    approvedAt: undefined,
    approvalNote: undefined,
    status: 'Pending',
    agreementLifecycle: 'SHARED',
    participantLifecycle: 'INVITE_SENT',
    agreementSharedAt: now,
    inviteSentAt: now,
    agreementViewedAt: undefined,
    inviteStatus: 'Invited',
  };
}
