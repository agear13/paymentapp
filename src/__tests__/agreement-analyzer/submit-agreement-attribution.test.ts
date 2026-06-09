import { submitAgreementUpload } from '@/lib/agreement-analyzer/submit-agreement.server';
import { getAgreementUploadStorage } from '@/lib/agreement-analyzer/upload-storage';
import { prisma } from '@/lib/server/prisma';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/agreement-analyzer/upload-storage', () => ({
  getAgreementUploadStorage: jest.fn(),
}));

describe('submitAgreementUpload attribution persistence', () => {
  const uploadMock = {
    upload: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getAgreementUploadStorage as jest.Mock).mockReturnValue(uploadMock);
  });

  it('persists first-touch attribution when creating a new lead', async () => {
    const createLead = jest.fn().mockResolvedValue({ id: 'lead-1' });
    const createUpload = jest.fn().mockResolvedValue({ id: 'upload-1' });
    const createReport = jest.fn().mockResolvedValue({
      id: 'report-1',
      report_access_token: 'rpt_abc1234567',
    });

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({
        obligation_report_leads: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: createLead,
          update: jest.fn(),
        },
        agreement_uploads: {
          create: createUpload,
        },
        agreement_obligation_reports: {
          create: createReport,
        },
      })
    );

    await submitAgreementUpload({
      firstName: 'Alex',
      lastName: 'Smith',
      email: 'alex@example.com',
      companyName: 'Harbour Events',
      businessType: 'Hospitality',
      attribution: {
        utm_source: 'linkedin',
        utm_medium: 'organic',
        utm_campaign: 'agreement-analyzer-launch',
        referrer: 'https://www.linkedin.com/',
        landing_page: '/agreement-analyzer?utm_source=linkedin',
        first_touch_at: '2026-06-09T10:00:00.000Z',
      },
      bytes: Buffer.from('pdf'),
      mimeType: 'application/pdf',
      sanitizedFilename: 'agreement.pdf',
    });

    expect(createLead).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'alex@example.com',
        utm_source: 'linkedin',
        utm_medium: 'organic',
        utm_campaign: 'agreement-analyzer-launch',
        referrer: 'https://www.linkedin.com/',
        landing_page: '/agreement-analyzer?utm_source=linkedin',
        first_touch_at: new Date('2026-06-09T10:00:00.000Z'),
      }),
    });
  });

  it('does not overwrite attribution for an existing lead', async () => {
    const updateLead = jest.fn().mockResolvedValue({ id: 'lead-existing' });

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({
        obligation_report_leads: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'lead-existing',
            email: 'alex@example.com',
            utm_source: 'linkedin',
            utm_campaign: 'agreement-analyzer-launch',
          }),
          create: jest.fn(),
          update: updateLead,
        },
        agreement_uploads: {
          create: jest.fn().mockResolvedValue({ id: 'upload-1' }),
        },
        agreement_obligation_reports: {
          create: jest.fn().mockResolvedValue({
            id: 'report-1',
            report_access_token: 'rpt_abc1234567',
          }),
        },
      })
    );

    await submitAgreementUpload({
      firstName: 'Alex',
      lastName: 'Smith',
      email: 'alex@example.com',
      companyName: 'Harbour Events',
      businessType: 'Hospitality',
      attribution: {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'retargeting',
      },
      bytes: Buffer.from('pdf'),
      mimeType: 'application/pdf',
      sanitizedFilename: 'agreement.pdf',
    });

    expect(updateLead).toHaveBeenCalledWith({
      where: { id: 'lead-existing' },
      data: expect.not.objectContaining({
        utm_source: 'google',
        utm_campaign: 'retargeting',
      }),
    });
  });
});
