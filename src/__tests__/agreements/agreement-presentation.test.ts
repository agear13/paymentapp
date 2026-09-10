import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  attachAgreementVersion,
  brandingFromOrganization,
  createAgreementVersion,
  currentAgreementVersion,
  ensureAgreementVersion,
  issueSupersedingAgreementVersion,
  resolveAgreementPresentation,
} from '@/lib/agreements/agreement-presentation';

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
    companyName: 'Rachel Smith',
    compensationProfile: {
      compensationType: 'REVENUE_SHARE',
      percentage: 2,
      configured: true,
    },
    earningSource: {
      type: 'external',
      externalProvider: 'weso',
      attributionMethod: 'discount_code',
      metadata: { providerLabel: 'Weso', audienceDiscountPct: 10 },
    },
    audienceDiscountPct: 10,
    ...overrides,
  } as DemoParticipant;
}

const wesoBranding = {
  organizationName: 'Weso',
  legalName: 'Weso',
  logoUrl: 'https://cdn.example.com/weso.png',
  logoSource: '/uploads/logos/weso.png',
};

describe('organisation agreement presentation', () => {
  it('lets an organisation have a logo on the branding snapshot', () => {
    const branding = brandingFromOrganization(wesoBranding);
    expect(branding.logoUrl).toBe('https://cdn.example.com/weso.png');
    expect(branding.legalName).toBe('Weso');
    expect(branding.initials).toBe('WE');
  });

  it('uses the organisation logo on a newly generated agreement', () => {
    const version = createAgreementVersion({
      participant: participant(),
      branding: wesoBranding,
    });
    expect(version.branding.logoUrl).toBe('https://cdn.example.com/weso.png');
    expect(version.branding.legalName).toBe('Weso');
    expect(version.title).toMatch(/Weso/);
    expect(version.fields.participantName).toBe('Rachel Smyth');
    expect(version.fields.commissionLabel).toContain('2%');
    expect(version.fields.audienceDiscountLabel).toContain('10%');
    expect(version.fields.earningSourceLabel).toContain('Weso');
  });

  it('resolves the current version logo for a new agreement', () => {
    const withVersion = attachAgreementVersion(
      participant(),
      createAgreementVersion({ participant: participant(), branding: wesoBranding })
    );
    const presentation = resolveAgreementPresentation(withVersion, {
      organizationName: 'Other Co',
      legalName: 'Other Co',
      logoUrl: 'https://cdn.example.com/other.png',
      logoSource: 'other',
    });
    expect(presentation.fromSnapshot).toBe(true);
    expect(presentation.branding.logoUrl).toBe('https://cdn.example.com/weso.png');
  });

  it('does not mutate a historical agreement snapshot when the organisation logo later changes', () => {
    const first = createAgreementVersion({
      participant: participant(),
      branding: wesoBranding,
      createdAt: '2026-09-01T00:00:00.000Z',
    });
    const afterLogoChange = issueSupersedingAgreementVersion({
      participant: attachAgreementVersion(participant(), first),
      branding: {
        organizationName: 'Weso',
        legalName: 'Weso Pty Ltd',
        logoUrl: 'https://cdn.example.com/weso-v2.png',
        logoSource: '/uploads/logos/weso-v2.png',
      },
      createdAt: '2026-09-09T00:00:00.000Z',
    });
    const previous = afterLogoChange.participant.agreementVersions?.find(
      (version) => version.versionId === first.versionId
    );
    expect(previous?.status).toBe('superseded');
    expect(previous?.branding.logoUrl).toBe('https://cdn.example.com/weso.png');
    expect(afterLogoChange.next.branding.logoUrl).toBe('https://cdn.example.com/weso-v2.png');
    expect(afterLogoChange.next.versionNumber).toBe(2);
  });

  it('renders gracefully when the organisation has no logo', () => {
    const version = createAgreementVersion({
      participant: participant(),
      branding: {
        organizationName: 'Weso',
        legalName: 'Weso',
        logoUrl: null,
        logoSource: null,
      },
    });
    expect(version.branding.logoUrl).toBeNull();
    expect(version.branding.initials).toBe('WE');
    expect(resolveAgreementPresentation(participant(), null).branding.logoUrl).toBeNull();
  });

  it('does not rewrite an existing snapshot when ensureAgreementVersion is called again', () => {
    const first = ensureAgreementVersion(participant(), wesoBranding);
    const second = ensureAgreementVersion(first.participant, {
      organizationName: 'Weso',
      legalName: 'Weso',
      logoUrl: 'https://cdn.example.com/changed.png',
      logoSource: 'changed',
    });
    expect(second.created).toBe(false);
    expect(currentAgreementVersion(second.participant)?.branding.logoUrl).toBe(
      'https://cdn.example.com/weso.png'
    );
  });

  it('keeps issued agreement wording when participant identity is later corrected', () => {
    const issued = attachAgreementVersion(
      participant(),
      createAgreementVersion({ participant: participant(), branding: wesoBranding })
    );
    const afterIdentityEdit = {
      ...issued,
      name: 'Rachel Smith',
      email: 'rachel.corrected@example.com',
      phone: '0400 111 222',
      roleLabel: 'Community Organiser',
    };
    const presentation = resolveAgreementPresentation(afterIdentityEdit, wesoBranding);
    expect(presentation.fromSnapshot).toBe(true);
    expect(presentation.fields.participantName).toBe('Rachel Smyth');
    expect(presentation.fields.email).toBe('rachel@example.com');
    expect(presentation.fields.commissionLabel).toContain('2%');
    expect(currentAgreementVersion(afterIdentityEdit)?.fields.participantName).toBe('Rachel Smyth');
  });
});
