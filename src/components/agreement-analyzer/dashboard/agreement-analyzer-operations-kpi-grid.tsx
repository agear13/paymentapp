import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgreementAnalyzerOperationsKpis } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';

type AgreementAnalyzerOperationsKpiGridProps = {
  kpis: AgreementAnalyzerOperationsKpis;
};

function formatDurationMs(value: number | null): string {
  if (value == null) return '—';
  if (value < 1000) return `${Math.round(value)} ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)} min`;
}

export function AgreementAnalyzerOperationsKpiGrid({
  kpis,
}: AgreementAnalyzerOperationsKpiGridProps) {
  const cards = [
    { title: 'Pending Jobs', value: kpis.pendingJobs },
    { title: 'Processing Jobs', value: kpis.processingJobs },
    { title: 'Failed Jobs', value: kpis.failedJobs },
    { title: 'Completed Today', value: kpis.completedToday },
    { title: 'Average Processing Time', value: formatDurationMs(kpis.averageProcessingTimeMs) },
    { title: 'Retry Count', value: kpis.retryCount },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
