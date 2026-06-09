'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type {
  AgreementAnalyzerAnalyticsSnapshot,
  AgreementAnalyzerAttributionBreakdown,
  AgreementAnalyzerMarketingFunnelRow,
} from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-types';

type AgreementAnalyzerAnalyticsDashboardProps = {
  analytics: AgreementAnalyzerAnalyticsSnapshot;
};

function formatRate(value: number | null): string {
  if (value == null) return '—';
  return `${value}%`;
}

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function AttributionBreakdownList({ items }: { items: AgreementAnalyzerAttributionBreakdown[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No attributed activity yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label} className="flex items-center justify-between text-sm">
          <span className="font-medium">{item.label}</span>
          <span className="text-muted-foreground">
            {item.count} ({item.percentage}%)
          </span>
        </li>
      ))}
    </ul>
  );
}

function FunnelTable({ rows }: { rows: AgreementAnalyzerMarketingFunnelRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No funnel data yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Label</th>
            <th className="py-2 pr-4 font-medium">Uploads</th>
            <th className="py-2 pr-4 font-medium">Reports Viewed</th>
            <th className="py-2 pr-4 font-medium">Demo Booked</th>
            <th className="py-2 pr-4 font-medium">Customers</th>
            <th className="py-2 pr-4 font-medium">Upload → View</th>
            <th className="py-2 pr-4 font-medium">View → Demo</th>
            <th className="py-2 font-medium">Demo → Customer</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((row) => (
            <tr key={row.label} className="border-b border-border/60 last:border-b-0">
              <td className="py-3 pr-4 font-medium">{row.label}</td>
              <td className="py-3 pr-4">{row.uploads}</td>
              <td className="py-3 pr-4">{row.reportsViewed}</td>
              <td className="py-3 pr-4">{row.demoBooked}</td>
              <td className="py-3 pr-4">{row.customers}</td>
              <td className="py-3 pr-4">{formatRate(row.uploadToReportViewedRate)}</td>
              <td className="py-3 pr-4">{formatRate(row.reportViewedToDemoBookedRate)}</td>
              <td className="py-3">{formatRate(row.demoBookedToCustomerRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AgreementAnalyzerAnalyticsDashboard({
  analytics,
}: AgreementAnalyzerAnalyticsDashboardProps) {
  const chartConfig = {
    count: { label: 'Count', color: 'hsl(var(--primary))' },
    score: { label: 'Average score', color: 'hsl(var(--chart-2))' },
  };

  const rateCards = [
    { title: 'Report View Rate', value: formatRate(analytics.reportViewRate) },
    { title: 'Email Open Rate', value: formatRate(analytics.emailOpenRate) },
    { title: 'Demo Click Rate', value: formatRate(analytics.demoClickRate) },
    { title: 'Demo Conversion Rate', value: formatRate(analytics.demoConversionRate) },
    {
      title: 'Revenue Share Detection Rate',
      value: formatRate(analytics.revenueShareDetectionRate),
    },
  ];

  const attributionSections = [
    { title: 'Top Converting Use Cases', items: analytics.topConvertingUseCases },
    { title: 'Top Converting Business Types', items: analytics.topConvertingBusinessTypes },
    { title: 'Top Converting Priority Bands', items: analytics.topConvertingPriorityBands },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {rateCards.map((card) => (
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads Per Day</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={analytics.leadsPerDay}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatShortDate} minTickGap={24} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reports Generated Per Day</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={analytics.reportsGeneratedPerDay}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatShortDate} minTickGap={24} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {attributionSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>Share of attributed demo bookings</CardDescription>
            </CardHeader>
            <CardContent>
              {section.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No demo bookings yet.</p>
              ) : (
                <ul className="space-y-3">
                  {section.items.map((item) => (
                    <li key={item.label} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground">{item.percentage}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Attribution — Top Sources</CardTitle>
            <CardDescription>Last 30 days by first-touch utm_source</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="mb-3 text-sm font-medium">Uploads</p>
              <AttributionBreakdownList items={analytics.marketingAttribution.topSources.uploads} />
            </div>
            <div>
              <p className="mb-3 text-sm font-medium">Reports Viewed</p>
              <AttributionBreakdownList
                items={analytics.marketingAttribution.topSources.reportsViewed}
              />
            </div>
            <div>
              <p className="mb-3 text-sm font-medium">Demo Bookings</p>
              <AttributionBreakdownList
                items={analytics.marketingAttribution.topSources.demoBookings}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attribution — Top Campaigns</CardTitle>
            <CardDescription>Uploads and demo bookings by utm_campaign</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-medium">Uploads</p>
              <AttributionBreakdownList
                items={analytics.marketingAttribution.topCampaigns.uploads}
              />
            </div>
            <div>
              <p className="mb-3 text-sm font-medium">Demo Bookings</p>
              <AttributionBreakdownList
                items={analytics.marketingAttribution.topCampaigns.demoBookings}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attribution — Top Referrers</CardTitle>
            <CardDescription>Uploads and demo bookings by referrer host</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-medium">Uploads</p>
              <AttributionBreakdownList
                items={analytics.marketingAttribution.topReferrers.uploads}
              />
            </div>
            <div>
              <p className="mb-3 text-sm font-medium">Demo Bookings</p>
              <AttributionBreakdownList
                items={analytics.marketingAttribution.topReferrers.demoBookings}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Funnel by Source</CardTitle>
            <CardDescription>Upload → report view → demo → customer conversion rates</CardDescription>
          </CardHeader>
          <CardContent>
            <FunnelTable rows={analytics.marketingAttribution.funnelBySource} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funnel by Campaign</CardTitle>
            <CardDescription>Conversion rates grouped by utm_campaign</CardDescription>
          </CardHeader>
          <CardContent>
            <FunnelTable rows={analytics.marketingAttribution.funnelByCampaign} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funnel by Medium</CardTitle>
            <CardDescription>Conversion rates grouped by utm_medium</CardDescription>
          </CardHeader>
          <CardContent>
            <FunnelTable rows={analytics.marketingAttribution.funnelByMedium} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Average Lead Score Trend</CardTitle>
            <CardDescription>Daily average score for new scoring events</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <AreaChart data={analytics.averageLeadScoreTrend}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatShortDate} minTickGap={24} />
                <YAxis domain={[0, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-score)"
                  fill="var(--color-score)"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
