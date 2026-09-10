import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  applyApprovedChangeToParticipant,
  classificationForField,
  pendingAgreementChangeRequests,
  submitAgreementChangeRequest,
} from '@/lib/agreements/agreement-change-request';
import {
  attachAgreementVersion,
  createAgreementVersion,
  currentAgreementVersion,
  issueSupersedingAgreementVersion,
  resetAgreementForNewVersion,
} from '@/lib/agreements/agreement-presentation';
import { canParticipantApproveAgreement } from '@/lib/operations/contracts/canonical-agreement-lifecycle';

function participant(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
  return {
    id: 'p-rachel',
    name: 'Rachel Smyth',
    email: 'rachel@example.com',
    role: 'Affiliate',
    commissionKind: 'pct_deal_value',
    commissionValue: 2,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: 'invite-1',
    dealId: 'rmwf-1',
    agreementSharedAt: '2026-09-08T00:00:00.000Z',
    compensationProfile: {
      compensationType: 'REVENUE_SHARE',
      percentage: 2,
      configured: true,
    },
    earningSource: {
      type: 'external',
      externalProvider: 'weso',
      attributionMethod: 'discount_code',
      metadata: { providerLabel: 'Weso' },
    },
    audienceDiscountPct: 10,
    ...overrides,
  } as DemoParticipant;
}

const branding = {
  organizationName: 'Weso',
  legalName: 'Weso',
  logoUrl: 'https://cdn.example.com/weso.png',
  logoSource: 'weso.png',
};

describe('affiliate suggested agreement changes', () => {
  it('lets an affiliate submit a correction without mutating the agreement', () => {
    const issued = attachAgreementVersion(
      participant(),
      createAgreementVersion({ participant: participant(), branding })
    );
    const result = submitAgreementChangeRequest(issued, {
      fieldKey: 'legal_name',
      suggestedValue: 'Rachel Smith',
      reason: 'My surname is spelled incorrectly.',
      requestId: 'chg-1',
      createdAt: '2026-09-09T00:00:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.status).toBe('pending');
    expect(result.request.previousValue).toBe('Rachel Smyth');
    expect(result.request.suggestedValue).toBe('Rachel Smith');
    expect(result.participant.name).toBe('Rachel Smyth');
    expect(result.participant.commissionValue).toBe(2);
  });

  it('creates a pending review item the operator can see', () => {
    const result = submitAgreementChangeRequest(participant(), {
      fieldKey: 'legal_name',
      suggestedValue: 'Rachel Smith',
      reason: 'Spelling',
      requestId: 'chg-1',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const pending = pendingAgreementChangeRequests(result.participant);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.status).toBe('pending');
    expect(pending[0]?.fieldKey).toBe('legal_name');
  });

  it('applies an approved administrative correction and issues a new version', () => {
    const issued = attachAgreementVersion(
      participant(),
      createAgreementVersion({ participant: participant(), branding })
    );
    const submitted = submitAgreementChangeRequest(issued, {
      fieldKey: 'legal_name',
      suggestedValue: 'Rachel Smith',
      reason: 'Spelling',
      requestId: 'chg-1',
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const applied = applyApprovedChangeToParticipant(submitted.participant, submitted.request);
    expect(applied.name).toBe('Rachel Smith');
    const reset = resetAgreementForNewVersion(applied);
    const next = issueSupersedingAgreementVersion({
      participant: reset,
      branding,
      sourceChangeRequestId: submitted.request.id,
    });
    expect(next.previous?.status).toBe('superseded');
    expect(next.previous?.fields.participantName).toBe('Rachel Smyth');
    expect(next.next.fields.participantName).toBe('Rachel Smith');
    expect(next.next.versionNumber).toBe(2);
    expect(next.next.sourceChangeRequestId).toBe('chg-1');
    expect(reset.approvalStatus).toBe('Pending approval');
    expect(canParticipantApproveAgreement(reset)).toBe(true);
  });

  it('preserves a signed agreement and requires a new signature after approval', () => {
    const signed = participant({
      approvalStatus: 'Approved',
      approvedAt: '2026-09-08T12:00:00.000Z',
      agreementLifecycle: 'APPROVED',
    });
    const issued = attachAgreementVersion(
      signed,
      createAgreementVersion({ participant: signed, branding })
    );
    const submitted = submitAgreementChangeRequest(issued, {
      fieldKey: 'legal_name',
      suggestedValue: 'Rachel Smith',
      reason: 'Spelling',
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.participant.approvalStatus).toBe('Approved');
    const applied = resetAgreementForNewVersion(
      applyApprovedChangeToParticipant(submitted.participant, submitted.request)
    );
    const next = issueSupersedingAgreementVersion({ participant: applied, branding });
    expect(currentAgreementVersion(next.participant)?.fields.participantName).toBe('Rachel Smith');
    expect(next.previous?.fields.participantName).toBe('Rachel Smyth');
    expect(applied.approvalStatus).toBe('Pending approval');
    expect(applied.approvedAt).toBeUndefined();
  });

  it('classifies commercial term changes as requiring operator approval', () => {
    expect(classificationForField('legal_name')).toBe('administrative');
    expect(classificationForField('email')).toBe('administrative');
    expect(classificationForField('commission_rate')).toBe('commercial');
    expect(classificationForField('discount_terms')).toBe('commercial');
    expect(classificationForField('earning_source')).toBe('commercial');
    const submitted = submitAgreementChangeRequest(participant(), {
      fieldKey: 'commission_rate',
      suggestedValue: '3%',
      reason: 'We discussed 3%',
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.request.classification).toBe('commercial');
    expect(submitted.participant.commissionValue).toBe(2);
    expect(submitted.participant.compensationProfile?.percentage).toBe(2);
    const applied = applyApprovedChangeToParticipant(submitted.participant, submitted.request);
    expect(applied.commissionValue).toBe(3);
    expect(applied.compensationProfile?.percentage).toBe(3);
  });

  it('records an audit trail of who suggested what and when', () => {
    const result = submitAgreementChangeRequest(participant(), {
      fieldKey: 'email',
      suggestedValue: 'rachel.smith@example.com',
      reason: 'Use my work email',
      requestId: 'chg-audit',
      createdAt: '2026-09-09T01:00:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request).toMatchObject({
      id: 'chg-audit',
      agreementId: 'p-rachel',
      participantId: 'p-rachel',
      fieldKey: 'email',
      previousValue: 'rachel@example.com',
      suggestedValue: 'rachel.smith@example.com',
      reason: 'Use my work email',
      status: 'pending',
      createdAt: '2026-09-09T01:00:00.000Z',
      suggestedByParticipantId: 'p-rachel',
    });
  });

  it('handles duplicate submissions safely', () => {
    const first = submitAgreementChangeRequest(participant(), {
      fieldKey: 'legal_name',
      suggestedValue: 'Rachel Smith',
      reason: 'Spelling',
      requestId: 'chg-1',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const duplicate = submitAgreementChangeRequest(first.participant, {
      fieldKey: 'legal_name',
      suggestedValue: 'Rachel Smith',
      reason: 'Still spelled wrong',
    });
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) return;
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.request.id).toBe('chg-1');
    expect(pendingAgreementChangeRequests(duplicate.participant)).toHaveLength(1);

    const replacement = submitAgreementChangeRequest(first.participant, {
      fieldKey: 'legal_name',
      suggestedValue: 'Rachel A. Smith',
      reason: 'Full legal name',
      requestId: 'chg-2',
    });
    expect(replacement.ok).toBe(true);
    if (!replacement.ok) return;
    expect(replacement.duplicate).toBe(false);
    const pending = pendingAgreementChangeRequests(replacement.participant);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe('chg-2');
    expect(
      replacement.participant.agreementChangeRequests?.find((row) => row.id === 'chg-1')?.status
    ).toBe('superseded');
  });

  it('keeps internal catalogue and external earning-source relationships representable', () => {
    const internal = submitAgreementChangeRequest(
      participant({
        earningSource: { type: 'internal_service', catalogueServiceIds: ['svc-1'] },
      }),
      {
        fieldKey: 'earning_source',
        suggestedValue: 'Summer Launch Package',
        reason: 'Confirm destination',
      }
    );
    expect(internal.ok).toBe(true);
    const external = submitAgreementChangeRequest(participant(), {
      fieldKey: 'discount_terms',
      suggestedValue: '15%',
      reason: 'Audience discount should be 15%',
    });
    expect(external.ok).toBe(true);
    if (!external.ok) return;
    expect(external.participant.audienceDiscountPct).toBe(10);
    const applied = applyApprovedChangeToParticipant(external.participant, external.request);
    expect(applied.audienceDiscountPct).toBe(15);
  });

  it('rejects a suggestion that does not change the current value', () => {
    const result = submitAgreementChangeRequest(participant(), {
      fieldKey: 'legal_name',
      suggestedValue: 'Rachel Smyth',
      reason: 'No change',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NO_CHANGE');
  });
});
