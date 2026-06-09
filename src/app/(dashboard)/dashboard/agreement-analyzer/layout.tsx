import { redirect } from 'next/navigation';

import { AgreementAnalyzerDashboardNav } from '@/components/agreement-analyzer/dashboard/agreement-analyzer-dashboard-nav';
import { checkAgreementAnalyzerDashboardAuth } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-auth.server';

export const dynamic = 'force-dynamic';

export default async function AgreementAnalyzerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await checkAgreementAnalyzerDashboardAuth();

  if (!auth.isAuthorized) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agreement Analyzer</h1>
        <p className="text-muted-foreground">
          Review, qualify, and prioritize obligation report leads.
        </p>
      </div>
      <AgreementAnalyzerDashboardNav />
      {children}
    </div>
  );
}
