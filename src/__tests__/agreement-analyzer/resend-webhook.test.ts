import { processAgreementAnalyzerResendWebhook } from '@/lib/agreement-analyzer/email/process-resend-webhook.server';
import {
  findObligationReportEmailEventByProviderMessageId,
  markObligationReportEmailClicked,
  markObligationReportEmailOpened,
} from '@/lib/agreement-analyzer/email/obligation-report-email-events.server';

jest.mock('@/lib/agreement-analyzer/email/obligation-report-email-events.server', () => ({
  findObligationReportEmailEventByProviderMessageId: jest.fn(),
  markObligationReportEmailDelivered: jest.fn(),
  markObligationReportEmailOpened: jest.fn(),
  markObligationReportEmailClicked: jest.fn(),
  markObligationReportEmailBounced: jest.fn(),
}));

jest.mock('@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server', () => ({
  trackAgreementAnalyzerEvent: jest.fn(),
}));

describe('agreement analyzer resend webhook processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ignores unknown provider message ids', async () => {
    (findObligationReportEmailEventByProviderMessageId as jest.Mock).mockResolvedValue(null);

    const result = await processAgreementAnalyzerResendWebhook({
      type: 'email.opened',
      data: { email_id: 'msg_unknown' },
    });

    expect(result).toEqual({ processed: false, reason: 'email_event_not_found' });
  });

  it('marks opened and clicked engagement events', async () => {
    (findObligationReportEmailEventByProviderMessageId as jest.Mock).mockResolvedValue({
      id: 'email-event-1',
      lead_id: 'lead-1',
    });

    const opened = await processAgreementAnalyzerResendWebhook({
      type: 'email.opened',
      data: { email_id: 'msg_123' },
    });
    expect(opened).toEqual({ processed: true });
    expect(markObligationReportEmailOpened).toHaveBeenCalledWith('email-event-1');

    const clicked = await processAgreementAnalyzerResendWebhook({
      type: 'email.clicked',
      data: { email_id: 'msg_123' },
    });
    expect(clicked).toEqual({ processed: true });
    expect(markObligationReportEmailClicked).toHaveBeenCalledWith('email-event-1');
  });
});
