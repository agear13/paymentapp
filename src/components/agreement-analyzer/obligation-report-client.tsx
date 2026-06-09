'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, FileText, Loader2 } from 'lucide-react';

import { ExecutiveSummaryCard } from '@/components/agreement-analyzer/executive-summary-card';
import { ProvvypayFitCard } from '@/components/agreement-analyzer/provvypay-fit-card';
import { ReportSection } from '@/components/agreement-analyzer/report-section';
import { SettlementReadinessCard } from '@/components/agreement-analyzer/settlement-readiness-card';
import { SettlementRiskCard } from '@/components/agreement-analyzer/settlement-risk-card';
import { SettlementSimulationCard } from '@/components/agreement-analyzer/settlement-simulation-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { attributionToAnalyticsProperties } from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution';
import { getStoredAgreementAnalyzerAttribution } from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution.client';
import { trackAgreementAnalyzerDemoClick } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics';
import type { PublicObligationReportPayload } from '@/lib/agreement-analyzer/report-types';

const POLL_INTERVAL_MS = 3000;

type ObligationReportClientProps = {
  token: string;
};

export function ObligationReportClient({ token }: ObligationReportClientProps) {
  const [payload, setPayload] = useState<PublicObligationReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (poll = false) => {
    const response = await fetch(
      `/api/agreement-analyzer/report/${encodeURIComponent(token)}${poll ? '?poll=1' : ''}`
    );
    const body = (await response.json()) as {
      error?: string;
      data?: PublicObligationReportPayload;
    };

    if (!response.ok) {
      throw new Error(body.error || 'Unable to load this report.');
    }
    if (!body.data) {
      throw new Error('Report response was incomplete.');
    }

    return body.data;
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const load = async (poll = false) => {
      try {
        const data = await fetchReport(poll);
        if (cancelled) return;
        setPayload(data);
        setError(null);
        setLoading(false);

        const shouldPoll = data.status === 'PENDING' || data.status === 'GENERATING';
        if (shouldPoll && !intervalId) {
          intervalId = setInterval(() => {
            void load(true).catch((err: unknown) => {
              if (!cancelled) {
                setError(err instanceof Error ? err.message : 'Unable to refresh report status.');
              }
            });
          }, POLL_INTERVAL_MS);
        }
        if (!shouldPoll && intervalId) {
          clearInterval(intervalId);
          intervalId = undefined;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load this report.');
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchReport]);

  if (loading) {
    return (
      <Card className="mx-auto w-full max-w-4xl shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          <p className="text-slate-600">Loading your obligation report…</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !payload) {
    return (
      <Card className="mx-auto w-full max-w-4xl shadow-sm">
        <CardHeader className="text-center">
          <CardTitle>Report unavailable</CardTitle>
          <CardDescription>{error ?? 'This report could not be found.'}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-8">
          <Button asChild variant="outline">
            <Link href="/agreement-analyzer">Upload another agreement</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (payload.status === 'PENDING' || payload.status === 'GENERATING') {
    return (
      <Card className="mx-auto w-full max-w-4xl border-slate-200 shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-slate-600" />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900">Analyzing your agreement</h1>
            <p className="max-w-lg text-slate-600">
              We&apos;re extracting parties, payment obligations, risks, and settlement readiness from
              your document. This page will refresh automatically.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
            <FileText className="h-4 w-4" />
            <span>{payload.document.filename}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (payload.status === 'FAILED') {
    return (
      <Card className="mx-auto w-full max-w-4xl shadow-sm">
        <CardHeader>
          <CardTitle>We couldn&apos;t complete your report</CardTitle>
          <CardDescription>
            Something went wrong while analyzing{' '}
            <span className="font-medium text-slate-800">{payload.document.filename}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analysis failed</AlertTitle>
            <AlertDescription>
              {payload.failureMessage ??
                'The document could not be processed. Please try uploading again with a clearer file.'}
            </AlertDescription>
          </Alert>
          <Button asChild>
            <Link href="/agreement-analyzer">Upload again</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const report = payload.report;
  const readinessScore =
    report?.settlementReadiness.score ?? payload.settlementReadinessScore ?? 0;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">AI Obligation Report</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {payload.document.companyName ?? 'Commercial agreement analysis'}
        </h1>
        <p className="text-slate-600">
          Generated from <span className="font-medium text-slate-800">{payload.document.filename}</span>
          {payload.document.businessType ? ` · ${payload.document.businessType}` : ''}
        </p>
      </header>

      {report ? (
        <>
          {report.executiveSummary ? (
            <ExecutiveSummaryCard summary={report.executiveSummary} />
          ) : null}

          {report.settlementSimulation ? (
            <SettlementSimulationCard
              simulation={report.settlementSimulation}
              partyCount={report.parties.length}
            />
          ) : null}

          {report.provvypayFit ? <ProvvypayFitCard fit={report.provvypayFit} /> : null}

          {report.settlementRiskAssessment ? (
            <SettlementRiskCard assessment={report.settlementRiskAssessment} />
          ) : null}

          <SettlementReadinessCard score={readinessScore} readiness={report.settlementReadiness} />

          <div className="grid gap-6">
            <ReportSection
              title="Parties"
              description="Identified entities involved in the agreement."
              items={report.parties}
              emptyMessage="No parties were identified in this document."
            />
            <ReportSection
              title="Revenue splits"
              description="Commission, share, or split arrangements detected in the agreement."
              items={report.revenueSplits}
              emptyMessage="No revenue split terms were detected."
            />
            <ReportSection
              title="Payment conditions"
              description="When and how payments are expected to occur."
              items={report.paymentConditions}
              emptyMessage="No explicit payment conditions were identified."
            />
            <ReportSection
              title="Obligations"
              description="Concrete duties, deliverables, and payment obligations."
              items={report.obligations}
              emptyMessage="No specific obligations were extracted."
            />
            <ReportSection
              title="Risks"
              description="Potential legal, operational, or settlement risks flagged by AI review."
              items={report.risks}
              emptyMessage="No material risks were flagged."
              variant="risk"
            />
            <ReportSection
              title="Missing information"
              description="Gaps that may block settlement or require clarification."
              items={report.missingInformation}
              emptyMessage="No missing information was flagged."
              variant="missing"
            />
          </div>
        </>
      ) : (
        <Alert>
          <AlertTitle>Report data unavailable</AlertTitle>
          <AlertDescription>
            The report completed processing but the structured payload could not be displayed.
          </AlertDescription>
        </Alert>
      )}

      <footer className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
        <p>
          This AI-generated summary is for informational purposes only and does not constitute legal,
          tax, or financial advice. Review the original agreement with qualified advisors before making
          settlement decisions.
        </p>
        {payload.demoBooking ? (
          <Button asChild variant="outline">
            <a
              href={payload.demoBooking.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackAgreementAnalyzerDemoClick({
                  leadId: payload.demoBooking?.leadId,
                  reportId: payload.demoBooking?.reportId,
                  score: payload.demoBooking?.overallScore ?? undefined,
                  priorityBand: payload.demoBooking?.priorityBand ?? undefined,
                  recommendedUseCase: payload.demoBooking?.recommendedUseCase ?? undefined,
                  reportAccessToken: payload.reportAccessToken,
                  source: 'report_page_footer',
                  ...attributionToAnalyticsProperties(getStoredAgreementAnalyzerAttribution()),
                })
              }
            >
              Book a Demo
            </a>
          </Button>
        ) : null}
      </footer>
    </div>
  );
}
