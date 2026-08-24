jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organization_workflow_agreements: { findUnique: jest.fn(), findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/workflows/organization-workflows.server', () => ({
  getOrganizationWorkflowById: jest.fn(),
}));

jest.mock('@/lib/email/client', () => ({
  sendEmail: jest.fn(),
}));

import { field, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';
import { sendEmail } from '@/lib/email/client';
import { prisma } from '@/lib/server/prisma';
import { shareWorkflowAgreementExtraction } from '@/lib/workflows/agreement-intelligence/share-extraction.server';
import { getOrganizationWorkflowById } from '@/lib/workflows/organization-workflows.server';

const ORG = 'org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const WF = 'wf-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('shareWorkflowAgreementExtraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getOrganizationWorkflowById as jest.Mock).mockResolvedValue({
      id: WF,
      templateSlug: 'agreement-intelligence',
    });
    prisma.organization_workflow_agreements.findFirst.mockResolvedValue({
      title: 'Festival Revenue Share',
      extraction_result: {
        projectName: field('Festival Revenue Share'),
        projectDescription: field(null, 'absent'),
        projectValue: field(null, 'absent'),
        currency: field('AUD'),
        counterparty: field('Apex'),
        parties: [
          testParty({
            id: 'apex',
            name: field('Apex Promotions'),
            email: field('operator@example.com'),
            role: field('Promoter'),
            participationModel: field('revenue_share'),
            revenueSharePct: field(20),
          }),
        ],
        paymentTerms: [],
        uncertainties: [],
        overallConfidence: 'high',
        sourceHint: null,
        extractedAt: '2026-08-24T00:00:00.000Z',
      },
    });
  });

  it('sends the structured extraction JSON through the existing email client', async () => {
    (sendEmail as jest.Mock).mockResolvedValue({ success: true, id: 'email-1' });

    await expect(
      shareWorkflowAgreementExtraction({
        organizationId: ORG,
        workflowId: WF,
        to: 'ops@example.com',
        senderName: 'alisha@example.com',
      })
    ).resolves.toEqual({ sent: true, emailId: 'email-1' });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ops@example.com',
        subject: expect.stringContaining('Festival Revenue Share'),
        attachments: [
          expect.objectContaining({
            filename: expect.stringMatching(/^provvy-extraction-festival-revenue-share-/),
            contentType: 'application/json',
          }),
        ],
      })
    );
    const attachment = (sendEmail as jest.Mock).mock.calls[0][0].attachments[0];
    const decoded = Buffer.from(attachment.content, 'base64').toString('utf8');
    expect(decoded).toContain('Apex Promotions');
    expect(decoded).toContain('revenue_share');
  });

  it('does not report a fake sent state when the email provider fails', async () => {
    (sendEmail as jest.Mock).mockResolvedValue({
      success: false,
      id: '',
      error: 'Email provider not configured (Resend not available)',
    });

    await expect(
      shareWorkflowAgreementExtraction({
        organizationId: ORG,
        workflowId: WF,
        to: 'ops@example.com',
      })
    ).resolves.toEqual({
      sent: false,
      error: 'Email provider not configured (Resend not available)',
    });
  });

  it('refuses to share when no extraction exists', async () => {
    prisma.organization_workflow_agreements.findFirst.mockResolvedValue(null);
    await expect(
      shareWorkflowAgreementExtraction({
        organizationId: ORG,
        workflowId: WF,
        to: 'ops@example.com',
      })
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
