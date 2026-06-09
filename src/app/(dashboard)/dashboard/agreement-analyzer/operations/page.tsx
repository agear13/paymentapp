import { AgreementAnalyzerOperationsKpiGrid } from '@/components/agreement-analyzer/dashboard/agreement-analyzer-operations-kpi-grid';
import { getAgreementAnalyzerOperationsKpis } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-queries.server';

export const dynamic = 'force-dynamic';

export default async function AgreementAnalyzerOperationsPage() {
  const kpis = await getAgreementAnalyzerOperationsKpis();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Operations</h2>
        <p className="text-muted-foreground">
          Monitor agreement extraction job queue health and processing throughput.
        </p>
      </div>
      <AgreementAnalyzerOperationsKpiGrid kpis={kpis} />
    </div>
  );
}
