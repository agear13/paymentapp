import { generateReportEmailSummary } from '@/lib/agreement-analyzer/email/generate-report-email-summary.server';
import { buildReportReadyEmailPayload } from '@/lib/agreement-analyzer/email/build-report-ready-email-payload';

describe('agreement analyzer report email summary', () => {
  const reportJson = {
    parties: [{}, {}, {}],
    revenueSplits: [
      {
        splits: [{ percentage: 70 }, { percentage: 30 }],
      },
    ],
    paymentConditions: [],
    obligations: Array.from({ length: 7 }, () => ({})),
    risks: [{}, {}],
    missingInformation: [],
    settlementReadiness: { score: 82, summary: 'Ready', factors: [] },
  };

  it('generates a plain-language summary under 120 words', () => {
    const summary = generateReportEmailSummary(reportJson);
    expect(summary).toContain('3 parties');
    expect(summary).toContain('7 obligations');
    expect(summary).toContain('2 revenue sharing arrangements');
    expect(summary).toContain('2 potential risks');
    expect(summary.split(/\s+/).length).toBeLessThanOrEqual(120);
  });

  it('builds html and text email payloads with CTAs', () => {
    const payload = buildReportReadyEmailPayload({
      firstName: 'Alex',
      reportJson,
      settlementReadinessScore: 82,
      reportUrl: 'https://app.provvypay.com/agreement-analyzer/report/rpt_abc1234567',
      demoUrl: 'https://calendly.com/provvypay/demo',
    });

    expect(payload.subject).toBe('Your AI Obligation Report Is Ready');
    expect(payload.html).toContain('View My Report');
    expect(payload.html).toContain('Book a Demo');
    expect(payload.text).toContain('Hi Alex,');
    expect(payload.text).toContain('Settlement readiness score: 82/100');
    expect(payload.templateInput.summary).toContain('3 parties');
  });
});
