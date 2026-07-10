'use client';

import * as React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import type { AgreementIntelligenceValidationReport } from '@/lib/agreements/validation/aggregate-validation-metrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-white/70 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

export function AgreementIntelligenceValidationDashboard() {
  const [windowDays, setWindowDays] = React.useState('30');
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<AgreementIntelligenceValidationReport | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - Number(windowDays));
      const res = await fetch(
        `/api/agreements/intelligence/analytics?since=${encodeURIComponent(since.toISOString())}`,
        { credentials: 'include', cache: 'no-store' }
      );
      if (!res.ok) return;
      const json = (await res.json()) as { data: AgreementIntelligenceValidationReport };
      setReport(json.data);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading validation metrics…
      </div>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No validation data yet. Open project briefings to begin collecting intelligence usage signals.
        </CardContent>
      </Card>
    );
  }

  const recommendationHelpfulTotal =
    report.feedback.recommendationHelpfulYes + report.feedback.recommendationHelpfulNo;
  const recommendationHelpfulRate =
    recommendationHelpfulTotal > 0
      ? Math.round((report.feedback.recommendationHelpfulYes / recommendationHelpfulTotal) * 100)
      : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={windowDays} onValueChange={setWindowDays}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Window" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="surface-intelligence border-0">
        <CardHeader>
          <CardTitle>{PRODUCT_TERMINOLOGY.projectIntelligence} Usage Report</CardTitle>
          <CardDescription>
            {report.eventCount} events · {report.usage.uniqueUsers} operator(s) ·{' '}
            {report.usage.uniqueAgreementsViewed} {PRODUCT_TERMINOLOGY.projectLower}(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="Briefing views" value={report.usage.briefingViews} />
          <MetricTile label="Health section views" value={report.usage.healthSectionViews} />
          <MetricTile label="Recommendation views" value={report.usage.recommendationViews} />
          <MetricTile label="Recommendation acted upon" value={report.usage.recommendationActedUpon} />
          <MetricTile label="Blocker interactions" value={report.usage.blockerCtaClicks} />
          <MetricTile label="Participant action clicks" value={report.usage.participantActionClicks} />
          <MetricTile label="Settlement readiness views" value={report.usage.settlementReadinessViews} />
          <MetricTile
            label="Avg dwell (sec)"
            value={
              report.usage.averageDwellMs != null
                ? Math.round(report.usage.averageDwellMs / 1000)
                : '—'
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommendation Effectiveness Report</CardTitle>
          <CardDescription>Which recommendations drive operator behavior</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-4 font-medium">Recommendation</th>
                <th className="py-2 pr-4 font-medium">Viewed</th>
                <th className="py-2 pr-4 font-medium">Acted</th>
                <th className="py-2 pr-4 font-medium">Dismissed</th>
                <th className="py-2 pr-4 font-medium">Completed</th>
                <th className="py-2 font-medium">Action rate</th>
              </tr>
            </thead>
            <tbody>
              {report.recommendationEffectiveness.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-muted-foreground">
                    No recommendation events recorded in this window.
                  </td>
                </tr>
              ) : (
                report.recommendationEffectiveness.map((row) => (
                  <tr key={row.recommendationAction} className="border-b border-border/40">
                    <td className="py-3 pr-4 max-w-xs">{row.recommendationAction}</td>
                    <td className="py-3 pr-4">{row.viewed}</td>
                    <td className="py-3 pr-4">{row.actedUpon}</td>
                    <td className="py-3 pr-4">{row.dismissed}</td>
                    <td className="py-3 pr-4">{row.completed}</td>
                    <td className="py-3">{row.actionRate}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Health Score Accuracy Report</CardTitle>
          <CardDescription>Does health predict settlement readiness outcomes?</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-4 font-medium">Health category</th>
                <th className="py-2 pr-4 font-medium">Samples</th>
                <th className="py-2 pr-4 font-medium">Reached readiness</th>
                <th className="py-2 pr-4 font-medium">Released</th>
                <th className="py-2 font-medium">Predictive rate</th>
              </tr>
            </thead>
            <tbody>
              {report.healthAccuracy.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-muted-foreground">
                    No health score samples in this window.
                  </td>
                </tr>
              ) : (
                report.healthAccuracy.map((row) => (
                  <tr key={row.healthCategory} className="border-b border-border/40">
                    <td className="py-3 pr-4">{row.healthCategory}</td>
                    <td className="py-3 pr-4">{row.count}</td>
                    <td className="py-3 pr-4">{row.settlementReadinessReached}</td>
                    <td className="py-3 pr-4">{row.settlementReleaseReached}</td>
                    <td className="py-3">{row.predictiveRate}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outcome timing</CardTitle>
          <CardDescription>Median hours from first briefing view to milestone (when both events exist)</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {report.outcomeTiming.map((row) => (
            <MetricTile
              key={row.outcome}
              label={row.outcome}
              value={
                row.medianHoursFromBriefing != null
                  ? `${row.medianHoursFromBriefing}h (${row.eventCount})`
                  : `${row.eventCount} events`
              }
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User understanding feedback</CardTitle>
          <CardDescription>Lightweight Yes/No prompts from project briefings</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="Recommendation helpful (Yes)" value={report.feedback.recommendationHelpfulYes} />
          <MetricTile label="Recommendation helpful (No)" value={report.feedback.recommendationHelpfulNo} />
          <MetricTile
            label="Helpful rate"
            value={recommendationHelpfulRate != null ? `${recommendationHelpfulRate}%` : '—'}
          />
          <MetricTile label="Blocker understood (Yes)" value={report.feedback.blockerUnderstoodYes} />
          <MetricTile label="Blocker understood (No)" value={report.feedback.blockerUnderstoodNo} />
        </CardContent>
      </Card>
    </div>
  );
}
