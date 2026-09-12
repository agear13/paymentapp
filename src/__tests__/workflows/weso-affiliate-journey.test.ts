import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { field, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import {
  applyApprovedChangeToParticipant,
  pendingAgreementChangeRequests,
  submitAgreementChangeRequest,
} from '@/lib/agreements/agreement-change-request';
import {
  attachAgreementVersion,
  createAgreementVersion,
  currentAgreementVersion,
  issueSupersedingAgreementVersion,
  resetAgreementForNewVersion,
  resolveAgreementPresentation,
} from '@/lib/agreements/agreement-presentation';
import { operationalRoleLabel } from '@/lib/projects/participants-for-project';
import { canParticipantApproveAgreement } from '@/lib/operations/contracts/canonical-agreement-lifecycle';
import { applyParticipantAgreementViewed } from '@/lib/operations/lifecycle/participant-lifecycle';
import { buildParticipantCoordinationView } from '@/lib/workflows/agreement-intelligence/participant-coordination';
import {
  candidateToPromoterInput,
  mapExtractedRole,
  mapExtractionToReferralPreview,
} from '@/lib/workflows/referral-management/import-from-extraction';
import { buildManualAddPromoterInput } from '@/lib/workflows/referral-management/manual-promoter-input';
import {
  inferAudienceDiscountPctFromText,
  inferReferralEarningSource,
  normalizeReferralEarningSource,
} from '@/lib/workflows/referral-management/earning-source';
import { buildReferralAttentionItems } from '@/lib/workflows/referral-management/attention';

const RACHEL_CONVERSATION = `Danielle: Hi Rachel, I'd like you to become a Weso affiliate as a Community Organiser.
Rachel: Yes, I'd love to.
Danielle: You'll receive a unique discount code. Your audience receives 10% off Weso. You'll receive 2% revenue share on qualifying referred revenue.
Rachel: Agreed, let's proceed.`;

const wesoBranding = {
  organizationName: 'Weso',
  legalName: 'Weso',
  logoUrl: 'https://cdn.example.com/weso.png',
  logoSource: '/uploads/logos/weso.png',
};

function extractionFromConversation(): ExtractionResult {
  return {
    projectName: field('Weso Affiliate'),
    projectDescription: field(null, 'absent'),
    projectValue: field(null, 'absent'),
    currency: field(null, 'absent'),
    counterparty: field('Weso'),
    parties: [
      testParty({
        id: 'ep-1',
        name: field('Rachel Smith'),
        email: field('rachel@example.com'),
        role: field('Community Organiser'),
        participationModel: field('revenue_share'),
        revenueSharePct: field(2),
        notes: field('Unique discount code for Weso audience'),
        referralEarningSource: {
          type: field('external'),
          externalPlatform: field('Weso'),
          externalService: field(null, 'absent'),
          attributionMethod: field('discount_code'),
        },
      }),
    ],
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: 'conversation',
    extractedAt: '2026-09-09T00:00:00.000Z',
  };
}

function participantFromConfirmedCandidate(): DemoParticipant {
  const preview = mapExtractionToReferralPreview({
    extraction: extractionFromConversation(),
    catalog: [{ id: 'svc-1', name: 'Provvy Consulting' }],
    sourceLabel: 'Pasted agreement or conversation',
    sourceText: RACHEL_CONVERSATION,
  });
  const candidate = preview.candidates[0];
  const mapped = candidateToPromoterInput({ ...candidate, email: 'rachel@example.com' });
  if ('error' in mapped) throw new Error(mapped.error);
  const earningSource = normalizeReferralEarningSource(mapped.compensation.earningSource, []);
  return {
    id: 'p-rachel',
    name: mapped.name,
    email: mapped.email,
    role: 'Introducer',
    roleLabel: mapped.roleLabel,
    commissionKind: 'pct_deal_value',
    commissionValue:
      mapped.compensation.kind === 'revenue_share' ? mapped.compensation.percentage : 0,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: 'invite-rachel',
    dealId: 'rmwf-1',
    agreementSharedAt: '2026-09-09T01:00:00.000Z',
    compensationProfile: {
      compensationType: 'REVENUE_SHARE',
      percentage: mapped.compensation.kind === 'revenue_share' ? mapped.compensation.percentage : 0,
      configured: true,
    },
    earningSource,
    audienceDiscountPct:
      typeof earningSource.metadata?.audienceDiscountPct === 'number'
        ? earningSource.metadata.audienceDiscountPct
        : undefined,
  } as DemoParticipant;
}

describe('Weso affiliate production journey — Rachel Smith', () => {
  it('extracts Weso terms from the pasted conversation without a Provvy catalogue service', () => {
    expect(inferReferralEarningSource({ evidenceText: RACHEL_CONVERSATION })).toMatchObject({
      type: 'external',
      externalProvider: 'weso',
      attributionMethod: 'discount_code',
    });
    expect(inferAudienceDiscountPctFromText(RACHEL_CONVERSATION)).toBe(10);
    expect(mapExtractedRole('Community Organiser')).toBe('Affiliate');

    const preview = mapExtractionToReferralPreview({
      extraction: extractionFromConversation(),
      catalog: [{ id: 'svc-1', name: 'Provvy Consulting' }],
      sourceLabel: 'Pasted agreement or conversation',
      sourceText: RACHEL_CONVERSATION,
    });
    expect(preview.candidates).toHaveLength(1);
    const candidate = preview.candidates[0];
    expect(candidate.name).toBe('Rachel Smith');
    expect(candidate.extractedRole).toBe('Community Organiser');
    expect(candidate.role).toBe('Affiliate');
    expect(candidate.percentage).toBe(2);
    expect(candidate.earningSourceType).toBe('external');
    expect(candidate.externalProvider).toBe('Weso');
    expect(candidate.attributionMethod).toBe('discount_code');
    expect(candidate.audienceDiscountPct).toBe(10);
    expect(candidate.serviceId).toBeNull();

    const mapped = candidateToPromoterInput({ ...candidate, email: 'rachel@example.com' });
    expect(mapped).not.toHaveProperty('error');
    if ('error' in mapped) return;
    expect(mapped.compensation).toMatchObject({
      kind: 'revenue_share',
      percentage: 2,
      earningSource: {
        type: 'external',
        externalProvider: 'Weso',
        attributionMethod: 'discount_code',
        audienceDiscountPct: 10,
      },
    });
    expect('serviceId' in mapped.compensation ? mapped.compensation.serviceId : undefined).toBeUndefined();
  });

  it('snapshots Weso branding and Community Organiser terms onto a newly issued agreement', () => {
    const participant = participantFromConfirmedCandidate();
    expect(operationalRoleLabel(participant)).toBe('Community Organiser');
    expect(participant.audienceDiscountPct).toBe(10);

    const version = createAgreementVersion({ participant, branding: wesoBranding });
    const issued = attachAgreementVersion(participant, version);
    const presentation = resolveAgreementPresentation(issued, {
      organizationName: 'Weso',
      legalName: 'Weso Pty Ltd',
      logoUrl: 'https://cdn.example.com/weso-v2.png',
      logoSource: 'changed',
    });

    expect(presentation.fromSnapshot).toBe(true);
    expect(presentation.branding.logoUrl).toBe('https://cdn.example.com/weso.png');
    expect(presentation.fields.participantName).toBe('Rachel Smith');
    expect(presentation.fields.role).toBe('Community Organiser');
    expect(presentation.fields.commissionLabel).toContain('2%');
    expect(presentation.fields.audienceDiscountLabel).toContain('10%');
    expect(presentation.fields.earningSourceLabel).toContain('Weso');
    expect(presentation.fields.attributionLabel).toBe('Discount code');
  });

  it('lets Rachel suggest a name correction without mutating the issued agreement', () => {
    const issued = attachAgreementVersion(
      participantFromConfirmedCandidate(),
      createAgreementVersion({
        participant: participantFromConfirmedCandidate(),
        branding: wesoBranding,
      })
    );
    const submitted = submitAgreementChangeRequest(issued, {
      fieldKey: 'legal_name',
      suggestedValue: 'Rachel Smyth',
      reason: 'Please update my surname spelling.',
      requestId: 'chg-name',
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.participant.name).toBe('Rachel Smith');
    expect(currentAgreementVersion(submitted.participant)?.fields.participantName).toBe('Rachel Smith');
    expect(pendingAgreementChangeRequests(submitted.participant)).toHaveLength(1);

    const attention = buildReferralAttentionItems([
      {
        id: submitted.participant.id,
        name: submitted.participant.name,
        manageUrl: '/workspace/workflows/referral-management?participant=p-rachel',
        agreementStatus: 'requested',
        payoutSetupStatus: 'required',
        pendingChangeRequests: pendingAgreementChangeRequests(submitted.participant).map((request) => ({
          id: request.id,
          fieldLabel: request.fieldLabel,
          previousValue: request.previousValue,
          suggestedValue: request.suggestedValue,
          reason: request.reason,
          classification: request.classification,
          createdAt: request.createdAt,
          agreementVersionNumber: request.agreementVersionNumber,
          status: request.status,
        })),
      },
    ]);
    expect(attention[0]?.kind).toBe('change_request');
    expect(attention[0]?.label).toMatch(/awaiting review/i);

    const coordination = buildParticipantCoordinationView(submitted.participant, {
      catalogItems: [],
      operatorApprovalRequired: true,
    });
    expect(coordination.nextActionKind).toBe('review_change_request');
    expect(coordination.nextActionLabel).toBe('1 agreement change awaiting review');
    expect(coordination.pendingChangeRequests).toHaveLength(1);
  });

  it('persists VIEWED when the affiliate opens a shared agreement', () => {
    const shared = {
      ...participantFromConfirmedCandidate(),
      agreementSharedAt: '2026-09-09T00:00:00.000Z',
      agreementLifecycle: 'SHARED' as const,
    };
    const viewed = applyParticipantAgreementViewed(shared);
    expect(viewed.agreementViewedAt).toBeTruthy();
    expect(viewed.inviteStatus).toBe('Opened');
    expect(viewed.agreementLifecycle).toBe('VIEWED');
    expect(viewed.approvalStatus).toBe(shared.approvalStatus);
  });

  it('approves the name correction by issuing a new unsigned version and preserving v1', () => {
    const issued = attachAgreementVersion(
      participantFromConfirmedCandidate(),
      createAgreementVersion({
        participant: participantFromConfirmedCandidate(),
        branding: wesoBranding,
      })
    );
    const submitted = submitAgreementChangeRequest(issued, {
      fieldKey: 'legal_name',
      suggestedValue: 'Rachel Smyth',
      reason: 'Please update my surname spelling.',
      requestId: 'chg-name',
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const applied = resetAgreementForNewVersion(
      applyApprovedChangeToParticipant(submitted.participant, submitted.request)
    );
    const next = issueSupersedingAgreementVersion({
      participant: applied,
      branding: wesoBranding,
      sourceChangeRequestId: submitted.request.id,
    });

    expect(next.previous?.status).toBe('superseded');
    expect(next.previous?.fields.participantName).toBe('Rachel Smith');
    expect(next.next.fields.participantName).toBe('Rachel Smyth');
    expect(next.next.versionNumber).toBe(2);
    expect(next.next.branding.logoUrl).toBe('https://cdn.example.com/weso.png');
    expect(applied.approvalStatus).toBe('Pending approval');
    expect(canParticipantApproveAgreement(applied)).toBe(true);
  });

  it('protects a commercial 2% → 3% suggestion behind operator approval and a new version', () => {
    const issued = attachAgreementVersion(
      participantFromConfirmedCandidate(),
      createAgreementVersion({
        participant: participantFromConfirmedCandidate(),
        branding: wesoBranding,
      })
    );
    const submitted = submitAgreementChangeRequest(issued, {
      fieldKey: 'commission_rate',
      suggestedValue: '3%',
      reason: 'We agreed 3%.',
      requestId: 'chg-commission',
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.request.classification).toBe('commercial');
    expect(submitted.participant.commissionValue).toBe(2);
    expect(currentAgreementVersion(submitted.participant)?.fields.commissionLabel).toContain('2%');

    const applied = resetAgreementForNewVersion(
      applyApprovedChangeToParticipant(submitted.participant, submitted.request)
    );
    const next = issueSupersedingAgreementVersion({
      participant: applied,
      branding: wesoBranding,
      sourceChangeRequestId: submitted.request.id,
    });
    expect(applied.commissionValue).toBe(3);
    expect(next.next.fields.commissionLabel).toContain('3%');
    expect(next.previous?.fields.commissionLabel).toContain('2%');
    expect(canParticipantApproveAgreement(applied)).toBe(true);
  });

  it('keeps a previously issued logo when the organisation logo later changes', () => {
    const v1 = attachAgreementVersion(
      participantFromConfirmedCandidate(),
      createAgreementVersion({
        participant: participantFromConfirmedCandidate(),
        branding: wesoBranding,
      })
    );
    const v2 = issueSupersedingAgreementVersion({
      participant: v1,
      branding: {
        organizationName: 'Weso',
        legalName: 'Weso',
        logoUrl: 'https://cdn.example.com/weso-new.png',
        logoSource: 'new',
      },
    });
    expect(v2.previous?.branding.logoUrl).toBe('https://cdn.example.com/weso.png');
    expect(v2.next.branding.logoUrl).toBe('https://cdn.example.com/weso-new.png');
  });

  it('lets Danielle create Rachel without an email and add it later without recreating the relationship', () => {
    const preview = mapExtractionToReferralPreview({
      extraction: extractionFromConversation(),
      catalog: [],
      sourceLabel: 'Pasted agreement or conversation',
      sourceText: RACHEL_CONVERSATION,
    });
    const candidate = { ...preview.candidates[0], email: '' };
    const mapped = candidateToPromoterInput(candidate);
    expect(mapped).not.toHaveProperty('error');
    if ('error' in mapped) return;
    expect(mapped.email).toBe('');
    expect(mapped.compensation).toMatchObject({
      kind: 'revenue_share',
      percentage: 2,
      earningSource: {
        type: 'external',
        externalProvider: 'Weso',
        attributionMethod: 'discount_code',
        audienceDiscountPct: 10,
      },
    });

    const created: DemoParticipant = {
      ...participantFromConfirmedCandidate(),
      email: '',
      agreementSharedAt: undefined,
    };
    const afterEmail = { ...created, email: 'rachel@example.com' };
    expect(afterEmail.id).toBe(created.id);
    expect(afterEmail.email).toBe('rachel@example.com');
    expect(afterEmail.commissionValue).toBe(2);
    expect(afterEmail.audienceDiscountPct).toBe(10);
    expect(afterEmail.earningSource?.type).toBe('external');
    expect(afterEmail.earningSource?.externalProvider).toBe('weso');
    expect(afterEmail.roleLabel).toBe('Community Organiser');
    expect(operationalRoleLabel(afterEmail)).toBe('Community Organiser');

    const sent = {
      ...afterEmail,
      agreementSharedAt: '2026-09-09T01:00:00.000Z',
    };
    const issued = attachAgreementVersion(
      sent,
      createAgreementVersion({ participant: sent, branding: wesoBranding })
    );
    expect(resolveAgreementPresentation(issued, wesoBranding).fields.email).toBe('rachel@example.com');
    expect(canParticipantApproveAgreement(issued)).toBe(true);

    const renamed = { ...issued, name: 'Rachel Operational Name' };
    expect(resolveAgreementPresentation(renamed, wesoBranding).fields.participantName).toBe('Rachel Smith');
    expect(renamed.commissionValue).toBe(2);
    expect(renamed.audienceDiscountPct).toBe(10);
  });

  it('lets Danielle create the same Weso relationship from the manual add-promoter flow', () => {
    const mapped = buildManualAddPromoterInput({
      name: 'Rachel Smith',
      role: 'Affiliate',
      roleLabel: 'Community Organiser',
      compensationKind: 'revenue_share',
      percentage: 2,
      serviceIds: [],
      earningSourceType: 'external',
      externalProvider: 'Weso',
      externalService: 'Weso App Store',
      attributionMethod: 'discount_code',
      audienceDiscountPct: 10,
    });
    expect(mapped).not.toHaveProperty('error');
    if ('error' in mapped) return;
    expect(mapped.compensation).toMatchObject({
      kind: 'revenue_share',
      percentage: 2,
      earningSource: {
        type: 'external',
        externalProvider: 'Weso',
        externalService: 'Weso App Store',
        attributionMethod: 'discount_code',
        audienceDiscountPct: 10,
      },
    });
    expect('serviceId' in mapped.compensation ? mapped.compensation.serviceId : undefined).toBeUndefined();
    expect('serviceIds' in mapped.compensation ? mapped.compensation.serviceIds : undefined).toBeUndefined();
  });
});
