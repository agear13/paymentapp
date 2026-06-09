import 'server-only';

import config from '@/lib/config/env';
import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import { buildReportReadyEmailPayload } from '@/lib/agreement-analyzer/email/build-report-ready-email-payload';
import { createObligationReportEmailEvent } from '@/lib/agreement-analyzer/email/obligation-report-email-events.server';
import {
  getAgreementAnalyzerDemoUrl,
  isAgreementAnalyzerEmailConfigured,
  sendAgreementAnalyzerEmail,
} from '@/lib/agreement-analyzer/email/resend-client.server';
import { loggers } from '@/lib/logger';
import { prisma } from '@/lib/server/prisma';

const MAX_SEND_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hasRecentReportReadyEmail(leadId: string, reportUpdatedAt: Date): Promise<boolean> {
  const existing = await prisma.obligation_report_email_events.findFirst({
    where: {
      lead_id: leadId,
      email_type: 'REPORT_READY',
      created_at: { gte: reportUpdatedAt },
    },
    select: { id: true },
  });

  return Boolean(existing);
}

export async function sendReportReadyEmail(input: {
  reportId: string;
}): Promise<{ success: boolean; skipped?: boolean; error?: string; providerMessageId?: string }> {
  if (!isAgreementAnalyzerEmailConfigured()) {
    return { success: false, skipped: true, error: 'Agreement analyzer email is not configured' };
  }

  const report = await prisma.agreement_obligation_reports.findUnique({
    where: { id: input.reportId },
    include: {
      upload: {
        include: {
          lead: {
            select: {
              id: true,
              first_name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!report || report.status !== 'COMPLETED' || !report.report_access_token) {
    return { success: false, error: 'Completed report with access token not found' };
  }

  const lead = report.upload.lead;
  if (await hasRecentReportReadyEmail(lead.id, report.updated_at)) {
    return { success: true, skipped: true };
  }

  const reportUrl = `${config.appUrl}/agreement-analyzer/report/${report.report_access_token}`;
  const { subject, html, text } = buildReportReadyEmailPayload({
    firstName: lead.first_name,
    reportJson: report.report_json,
    settlementReadinessScore: report.settlement_readiness_score ?? 0,
    reportUrl,
    demoUrl: getAgreementAnalyzerDemoUrl(),
  });

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
    const response = await sendAgreementAnalyzerEmail({
      to: lead.email,
      subject,
      html,
      text,
      tags: [
        { name: 'type', value: 'obligation_report_ready' },
        { name: 'lead_id', value: lead.id },
        { name: 'report_id', value: report.id },
      ],
    });

    if (response.success) {
      const emailEvent = await createObligationReportEmailEvent({
        leadId: lead.id,
        emailType: 'REPORT_READY',
        providerMessageId: response.id || null,
      });

      trackAgreementAnalyzerEvent('agreement_report_email_sent', {
        leadId: lead.id,
        reportId: report.id,
        reportAccessToken: report.report_access_token,
        emailEventId: emailEvent.id,
        providerMessageId: response.id,
        attempt,
      });

      loggers.api.info('Agreement report ready email sent', {
        reportId: report.id,
        leadId: lead.id,
        emailEventId: emailEvent.id,
        providerMessageId: response.id,
        attempt,
      });

      return { success: true, providerMessageId: response.id };
    }

    lastError = response.error || 'Failed to send report ready email';
    loggers.api.warn('Agreement report ready email attempt failed', {
      reportId: report.id,
      leadId: lead.id,
      attempt,
      error: lastError,
    });

    if (attempt < MAX_SEND_ATTEMPTS) {
      await sleep(attempt * 1000);
    }
  }

  loggers.api.error('Agreement report ready email failed after retries', new Error(lastError), {
    reportId: report.id,
    leadId: lead.id,
    attempts: MAX_SEND_ATTEMPTS,
  });

  return { success: false, error: lastError };
}

export function scheduleReportReadyEmail(reportId: string): void {
  void sendReportReadyEmail({ reportId }).catch((error) => {
    loggers.api.error('Background report ready email failed', error, { reportId });
  });
}
