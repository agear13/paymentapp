import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OnboardingDraftParticipant } from '@/components/onboarding/onboarding-participant-card';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { mapReviewToParticipants } from '@/lib/ai-extractor/extraction-mapper';
import type { ExtractionResult, SourceType } from '@/lib/ai-extractor/extraction-types';
import { reviewFormFromExtraction } from '@/lib/ai-extractor/review-form-types';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';
import {
  PARTICIPANT_COMPENSATION_TYPES,
  type ParticipantCompensationProfile,
} from '@/lib/participants/participant-compensation-types';
import {
  buildOnboardingParticipant,
  mapOnboardingRoleToOperational,
} from '@/lib/onboarding/build-onboarding-project';
import type { OnboardingParticipantRole } from '@/lib/onboarding/operator-onboarding-types';
import {
  buildProjectParticipant,
  participationModelToCommissionKind,
  type ProjectParticipationModel,
} from '@/lib/projects/participant-entitlement';
import { draftParticipantDefaults } from '@/lib/operations/guards/hydration-guards';
import { z } from 'zod';
import { ONBOARDING_PARTICIPANT_ROLE_VALUES } from '@/lib/onboarding/operator-onboarding-types';

const participationModelSchema = z.enum([
  'fixed_payout',
  'revenue_share',
  'customer_attribution',
]);

export const onboardingCompensationProfileSchema = z
  .object({
    compensationType: z.enum(PARTICIPANT_COMPENSATION_TYPES),
    percentage: z.number().nullable().optional(),
    fixedAmount: z.number().nullable().optional(),
    configured: z.boolean().optional(),
    configuredAt: z.string().optional(),
    customerAttributionEnabled: z.boolean().optional(),
    exemptFromPayout: z.boolean().optional(),
  })
  .passthrough();

export const onboardingParticipantBodySchema = z.object({
  name: z.string().min(1).max(255),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  role: z.enum(ONBOARDING_PARTICIPANT_ROLE_VALUES),
  notes: z.string().max(2000).optional(),
  participationModel: participationModelSchema.optional(),
  commissionValue: z.number().optional(),
  compensationProfile: onboardingCompensationProfileSchema.nullable().optional(),
});

export const onboardingParticipantsPostSchema = z.object({
  projectId: z.string().min(1),
  participants: z.array(onboardingParticipantBodySchema).max(20),
});

export type OnboardingParticipantBody = z.infer<typeof onboardingParticipantBodySchema>;

function normalizeCompensationProfile(
  raw: OnboardingParticipantBody['compensationProfile']
): ParticipantCompensationProfile | undefined {
  if (raw == null) return undefined;
  return {
    compensationType: raw.compensationType,
    percentage: raw.percentage ?? undefined,
    fixedAmount: raw.fixedAmount ?? undefined,
    configured: raw.configured,
    configuredAt: raw.configuredAt,
    customerAttributionEnabled: raw.customerAttributionEnabled,
    exemptFromPayout: raw.exemptFromPayout,
  };
}

/**
 * Map AI extraction → onboarding POST drafts using the same compensation path as workspace import
 * (reviewFormFromExtraction → mapReviewToParticipants → mapDemoParticipantToOnboardingDraft).
 */
export function onboardingDraftsFromExtraction(
  result: ExtractionResult,
  deal: RecentDeal,
  sourceType: SourceType,
  workspaceCurrency?: string | null
): OnboardingDraftParticipant[] {
  const form = reviewFormFromExtraction(result, 'onboarding', sourceType, undefined, {
    project: deal,
    workspaceCurrency,
  });
  const originalsById = new Map(result.parties.map((party) => [party.id, party]));
  return mapReviewToParticipants(form, deal, originalsById)
    .filter((participant) => participant.name.trim().length > 0)
    .map((participant) => mapDemoParticipantToOnboardingDraft(participant));
}

/** Map validated POST body row to onboarding draft (single source of truth). */
export function onboardingDraftFromRequestBody(
  body: OnboardingParticipantBody
): OnboardingDraftParticipant {
  return {
    name: body.name,
    email: body.email ?? '',
    role: body.role,
    notes: body.notes,
    participationModel: body.participationModel,
    commissionValue: body.commissionValue,
    compensationProfile: normalizeCompensationProfile(body.compensationProfile),
  };
}

/** True when conversation import stored a compensation profile on the draft row. */
export function hasImportedCompensationProfile(
  draft: Pick<OnboardingDraftParticipant, 'compensationProfile'>
): boolean {
  return draft.compensationProfile != null;
}

/** Map extracted DemoParticipant role + model to onboarding checklist role. */
export function inferOnboardingRoleFromDemo(participant: DemoParticipant): OnboardingParticipantRole {
  if (participant.participationModel === 'revenue_share') return 'Promoter';
  if (participant.participationModel === 'customer_attribution') return 'Venue';
  if (participant.participationModel === 'fixed_payout') return 'Performer';
  switch (participant.role) {
    case 'Introducer':
      return 'Referrer';
    case 'Connector':
      return 'Partner';
    default:
      return 'Contractor';
  }
}

/** Single onboarding draft row from a post-extraction DemoParticipant (preserves compensation). */
export function mapDemoParticipantToOnboardingDraft(
  participant: DemoParticipant
): OnboardingDraftParticipant {
  const notesFromImport = participant.participantNotes?.trim();
  return {
    name: participant.name,
    email: participant.email ?? '',
    role: inferOnboardingRoleFromDemo(participant),
    notes: notesFromImport || undefined,
    participationModel: participant.participationModel,
    commissionValue: participant.commissionValue,
    compensationProfile: participant.compensationProfile ?? undefined,
  };
}

function buildImportedOnboardingParticipant(
  draft: OnboardingDraftParticipant,
  deal: RecentDeal
): DemoParticipant {
  const participationModel: ProjectParticipationModel =
    draft.participationModel ?? 'fixed_payout';
  const operationalRole = mapOnboardingRoleToOperational(draft.role);
  const commissionKind = participationModelToCommissionKind(participationModel);
  const commissionValue = draft.commissionValue ?? 0;
  const profile = draft.compensationProfile as ParticipantCompensationProfile;

  const noteParts: string[] = [];
  if (draft.notes?.trim()) noteParts.push(draft.notes.trim());
  noteParts.push(`${draft.role} · added during onboarding`);

  const built = buildProjectParticipant({
    name: draft.name.trim(),
    email: draft.email?.trim() || undefined,
    role: operationalRole,
    project: deal,
    notes: noteParts.join(' · '),
    participationModel,
    commissionKind,
    commissionValue,
    enableCustomerAttribution: participationModel === 'customer_attribution',
  });

  const withProfile = applyCompensationProfileToParticipant(built, profile);
  return {
    ...withProfile,
    ...draftParticipantDefaults(),
  };
}

/**
 * Persistable pilot participant from one onboarding draft row.
 * Uses imported compensation when present; otherwise default draft builder.
 */
export function participantFromOnboardingDraft(
  draft: OnboardingDraftParticipant,
  deal: RecentDeal
): DemoParticipant {
  if (hasImportedCompensationProfile(draft)) {
    return buildImportedOnboardingParticipant(draft, deal);
  }
  return buildOnboardingParticipant({
    name: draft.name,
    email: draft.email?.trim() || undefined,
    role: draft.role,
    deal,
  });
}

export function participantsFromOnboardingDrafts(
  drafts: OnboardingDraftParticipant[],
  deal: RecentDeal
): DemoParticipant[] {
  return drafts
    .filter((p) => p.name.trim().length > 0)
    .map((draft) => participantFromOnboardingDraft(draft, deal));
}
