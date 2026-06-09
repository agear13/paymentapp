import 'server-only';

import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import {
  findObligationReportEmailEventByProviderMessageId,
  markObligationReportEmailBounced,
  markObligationReportEmailClicked,
  markObligationReportEmailDelivered,
  markObligationReportEmailOpened,
} from '@/lib/agreement-analyzer/email/obligation-report-email-events.server';
import { loggers } from '@/lib/logger';

export type ResendWebhookPayload = {
  type?: string;
  data?: {
    email_id?: string;
    bounce?: { message?: string };
  };
};

export async function processAgreementAnalyzerResendWebhook(
  payload: ResendWebhookPayload
): Promise<{ processed: boolean; reason?: string }> {
  const type = payload.type;
  const providerMessageId = payload.data?.email_id;

  if (!type || !providerMessageId) {
    return { processed: false, reason: 'missing_type_or_email_id' };
  }

  const emailEvent = await findObligationReportEmailEventByProviderMessageId(providerMessageId);
  if (!emailEvent) {
    return { processed: false, reason: 'email_event_not_found' };
  }

  switch (type) {
    case 'email.sent':
      return { processed: true };

    case 'email.delivered':
      await markObligationReportEmailDelivered(emailEvent.id);
      return { processed: true };

    case 'email.opened':
      await markObligationReportEmailOpened(emailEvent.id);
      trackAgreementAnalyzerEvent('agreement_report_email_opened', {
        leadId: emailEvent.lead_id,
        emailEventId: emailEvent.id,
        providerMessageId,
      });
      return { processed: true };

    case 'email.clicked':
      await markObligationReportEmailClicked(emailEvent.id);
      trackAgreementAnalyzerEvent('agreement_report_email_clicked', {
        leadId: emailEvent.lead_id,
        emailEventId: emailEvent.id,
        providerMessageId,
      });
      return { processed: true };

    case 'email.bounced':
      await markObligationReportEmailBounced(emailEvent.id);
      loggers.api.warn('Agreement analyzer report email bounced', {
        leadId: emailEvent.lead_id,
        emailEventId: emailEvent.id,
        providerMessageId,
        bounceMessage: payload.data?.bounce?.message,
      });
      return { processed: true };

    default:
      return { processed: false, reason: 'unsupported_event_type' };
  }
}
