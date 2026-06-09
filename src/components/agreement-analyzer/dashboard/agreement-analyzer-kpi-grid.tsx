import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgreementAnalyzerOverviewKpis } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';

type AgreementAnalyzerKpiGridProps = {
  kpis: AgreementAnalyzerOverviewKpis;
};

function formatScore(value: number | null): string {
  if (value == null) return '—';
  return value.toFixed(1);
}

function formatRate(value: number | null): string {
  if (value == null) return '—';
  return `${value}%`;
}

export function AgreementAnalyzerKpiGrid({ kpis }: AgreementAnalyzerKpiGridProps) {
  const cards = [
    { title: 'Total Leads', value: kpis.totalLeads },
    { title: 'Leads This Week', value: kpis.leadsThisWeek },
    { title: 'Reports Generated', value: kpis.reportsGenerated },
    { title: 'Reports Viewed', value: kpis.reportsViewed },
    { title: 'Demo Clicks', value: kpis.demoClicks },
    { title: 'Demo Bookings', value: kpis.demoBookings },
    { title: 'Demo Conversion Rate', value: formatRate(kpis.demoConversionRate) },
    { title: 'Average Lead Score', value: formatScore(kpis.averageLeadScore) },
    { title: 'Revenue Share Opportunities', value: kpis.revenueShareOpportunities },
    { title: 'Hospitality Opportunities', value: kpis.hospitalityOpportunities },
    { title: 'Event Opportunities', value: kpis.eventOpportunities },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
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
