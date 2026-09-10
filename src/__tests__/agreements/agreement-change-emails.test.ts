import {
  buildAgreementChangeRejectedEmail,
  buildAgreementUpdatedEmail,
} from '@/lib/email/templates/agreement-change-decision';

describe('agreement change decision emails', () => {
  it('tells the affiliate to review the new version after approval', () => {
    const email = buildAgreementUpdatedEmail({
      participantName: 'Rachel Smith',
      organizationName: 'Weso',
      agreementTitle: 'Weso Affiliate Agreement',
      workspaceUrl: 'https://example.com/participant/token',
    });
    expect(email.subject).toContain('has been updated');
    expect(email.subject).toContain('review and sign the new version');
    expect(email.text).toContain('Weso Affiliate Agreement');
    expect(email.html).toContain('https://example.com/participant/token');
  });

  it('tells the affiliate when a suggested change was not approved', () => {
    const email = buildAgreementChangeRejectedEmail({
      participantName: 'Rachel Smith',
      organizationName: 'Weso',
      agreementTitle: 'Weso Affiliate Agreement',
    });
    expect(email.subject).toBe('Your suggested change was not approved.');
    expect(email.text).toContain('was not approved');
  });
});
