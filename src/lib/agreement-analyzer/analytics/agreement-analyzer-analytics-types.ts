export const AGREEMENT_ANALYZER_ANALYTICS_EVENTS = [
  'agreement_upload_stored',
  'agreement_job_created',
  'agreement_job_started',
  'agreement_job_completed',
  'agreement_job_failed',
  'agreement_job_retried',
  'agreement_report_email_sent',
  'agreement_report_email_opened',
  'agreement_report_email_clicked',
  'agreement_report_demo_clicked',
  'agreement_analyzer_demo_click',
  'agreement_analyzer_demo_booked',
  'agreement_report_viewed',
  'agreement_analyzer_lead_scored',
  'agreement_structural_fit_calculated',
  'agreement_analyzer_page_viewed',
  'agreement_analyzer_upload_started',
  'agreement_analyzer_upload_completed',
  'agreement_analyzer_customer',
  'agreement_queue_backlog_detected',
] as const;

export type AgreementAnalyzerAnalyticsEvent =
  (typeof AGREEMENT_ANALYZER_ANALYTICS_EVENTS)[number];

export type AgreementAnalyzerAnalyticsProperties = {
  leadId?: string;
  reportId?: string;
  reportAccessToken?: string;
  emailEventId?: string;
  providerMessageId?: string;
  source?: string;
  [key: string]: string | number | boolean | null | undefined;
};
