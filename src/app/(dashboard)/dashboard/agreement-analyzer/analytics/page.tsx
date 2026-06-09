import { AgreementAnalyzerAnalyticsDashboard } from '@/components/agreement-analyzer/dashboard/agreement-analyzer-analytics-dashboard';
import { getAgreementAnalyzerAnalytics } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-analytics.server';

export const dynamic = 'force-dynamic';

export default async function AgreementAnalyzerAnalyticsPage() {
  const analytics = await getAgreementAnalyzerAnalytics();

  return <AgreementAnalyzerAnalyticsDashboard analytics={analytics} />;
}
