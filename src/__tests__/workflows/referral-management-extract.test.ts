jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organization_workflows: { findFirst: jest.fn() },
    organization_services: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/ai-extractor/extraction-service', () => ({
  extractAgreementFromText: jest.fn(),
}));

jest.mock('@/lib/agreement-analyzer/extraction/document-parsers.server', () => ({
  extractDocumentText: jest.fn(),
}));

import { testParty, field } from '@/lib/ai-extractor/test-helpers/party-fixture';
import { extractAgreementFromText } from '@/lib/ai-extractor/extraction-service';
import { prisma } from '@/lib/server/prisma';
import { extractReferralRelationshipsFromText } from '@/lib/workflows/referral-management/extract.server';
import { REFERRAL_MANAGEMENT_SLUG } from '@/lib/workflows/referral-management/constants';

const ORG = 'org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const WF = 'wf-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SERVICE = '11111111-1111-1111-1111-111111111111';

describe('Referral Management extract adapter', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    prisma.organization_workflows.findFirst.mockResolvedValue({
      id: WF,
      organization_id: ORG,
      template_slug: REFERRAL_MANAGEMENT_SLUG,
      status: 'DEPLOYED',
    });
    prisma.organization_services.findMany.mockResolvedValue([
      { id: SERVICE, name: 'Summer Launch Package' },
    ]);
    (extractAgreementFromText as jest.Mock).mockResolvedValue({
      projectName: field('Summer Launch'),
      projectDescription: field(null, 'absent'),
      projectValue: field(null, 'absent'),
      currency: field('AUD'),
      counterparty: field('Apex'),
      parties: [
        testParty({
          id: 'apex',
          name: field('Apex Promotions'),
          email: field('apex@example.com'),
          role: field('Promoter'),
          participationModel: field('revenue_share'),
          revenueSharePct: field(20),
          deliverables: [
            { description: field('Summer Launch Package'), category: field(null, 'absent') },
          ],
        }),
      ],
      paymentTerms: [],
      uncertainties: [],
      overallConfidence: 'high',
      sourceHint: null,
      extractedAt: '2026-08-20T00:00:00.000Z',
    });
  });

  afterAll(() => {
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('I: uses the existing extractor and does not write Agreement Intelligence rows', async () => {
    const preview = await extractReferralRelationshipsFromText({
      organizationId: ORG,
      workflowId: WF,
      text: 'Apex Promotions receives 20% revenue share on Summer Launch Package.',
      sourceLabel: 'Pasted agreement or conversation',
    });
    expect(extractAgreementFromText).toHaveBeenCalled();
    expect(preview.candidates[0].name).toBe('Apex Promotions');
    expect(prisma).not.toHaveProperty('organization_workflow_agreements');
  });

  it('rejects extraction on a non-Referral Management workflow', async () => {
    prisma.organization_workflows.findFirst.mockResolvedValue({
      id: WF,
      organization_id: ORG,
      template_slug: 'agreement-intelligence',
      status: 'DEPLOYED',
    });
    await expect(
      extractReferralRelationshipsFromText({
        organizationId: ORG,
        workflowId: WF,
        text: 'Apex gets 20%',
      })
    ).rejects.toMatchObject({ code: 'INVALID_TEMPLATE' });
    expect(extractAgreementFromText).not.toHaveBeenCalled();
  });
});
