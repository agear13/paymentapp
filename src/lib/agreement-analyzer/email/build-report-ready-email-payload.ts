import { generateReportEmailSummary } from '@/lib/agreement-analyzer/email/generate-report-email-summary.server';
import {
  buildReportReadyEmailHtml,
  buildReportReadyEmailSubject,
  buildReportReadyEmailText,
  type ReportReadyEmailTemplateInput,
} from '@/lib/agreement-analyzer/email/email-templates/report-ready';

export type ReportReadyEmailPayload = {
  subject: string;
  html: string;
  text: string;
  templateInput: ReportReadyEmailTemplateInput;
};

export function buildReportReadyEmailPayload(input: {
  firstName: string;
  reportJson: unknown;
  settlementReadinessScore: number;
  reportUrl: string;
  demoUrl: string | null;
}): ReportReadyEmailPayload {
  const templateInput: ReportReadyEmailTemplateInput = {
    firstName: input.firstName,
    summary: generateReportEmailSummary(input.reportJson),
    settlementReadinessScore: input.settlementReadinessScore,
    reportUrl: input.reportUrl,
    demoUrl: input.demoUrl,
  };

  return {
    subject: buildReportReadyEmailSubject(),
    html: buildReportReadyEmailHtml(templateInput),
    text: buildReportReadyEmailText(templateInput),
    templateInput,
  };
}
