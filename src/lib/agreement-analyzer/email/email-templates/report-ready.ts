export type ReportReadyEmailTemplateInput = {
  firstName: string;
  summary: string;
  settlementReadinessScore: number;
  reportUrl: string;
  demoUrl: string | null;
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildReportReadyEmailSubject(): string {
  return 'Your AI Obligation Report Is Ready';
}

export function buildReportReadyEmailText(input: ReportReadyEmailTemplateInput): string {
  const lines = [
    `Hi ${input.firstName},`,
    '',
    'Your AI obligation report is ready.',
    '',
    input.summary,
    '',
    `Settlement readiness score: ${input.settlementReadinessScore}/100`,
    '',
    `View your report: ${input.reportUrl}`,
  ];

  if (input.demoUrl) {
    lines.push('', `Book a demo: ${input.demoUrl}`);
  }

  lines.push(
    '',
    'This AI-generated summary is for informational purposes only and does not constitute legal, tax, or financial advice.'
  );

  return lines.join('\n');
}

export function buildReportReadyEmailHtml(input: ReportReadyEmailTemplateInput): string {
  const safeFirstName = escapeHtml(input.firstName);
  const safeSummary = escapeHtml(input.summary);
  const safeReportUrl = escapeHtml(input.reportUrl);
  const demoSection = input.demoUrl
    ? `
      <p style="margin:24px 0 0 0">
        <a href="${escapeHtml(input.demoUrl)}" style="color:#0f172a;text-decoration:underline;font-weight:600">
          Book a Demo
        </a>
      </p>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:560px">
      <p style="margin:0 0 16px 0">Hi ${safeFirstName},</p>
      <p style="margin:0 0 16px 0">Your AI obligation report is ready.</p>
      <p style="margin:0 0 16px 0">${safeSummary}</p>
      <p style="margin:0 0 16px 0"><strong>Settlement readiness score:</strong> ${input.settlementReadinessScore}/100</p>
      <p style="margin:16px 0">
        <a href="${safeReportUrl}" style="background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;font-weight:600">
          View My Report
        </a>
      </p>
      ${demoSection}
      <p style="margin:24px 0 0 0;font-size:12px;color:#64748b">
        This AI-generated summary is for informational purposes only and does not constitute legal, tax, or financial advice.
      </p>
      <p style="margin:12px 0 0 0;font-size:12px;color:#64748b">
        If the button does not work, copy this link:<br />
        ${safeReportUrl}
      </p>
    </div>
  `.trim();
}
