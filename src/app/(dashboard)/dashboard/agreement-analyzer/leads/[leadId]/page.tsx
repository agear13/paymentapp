import { notFound } from 'next/navigation';

import { AgreementAnalyzerLeadDetailView } from '@/components/agreement-analyzer/dashboard/agreement-analyzer-lead-detail';
import { getAgreementAnalyzerLeadDetail } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-queries.server';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ leadId: string }>;
};

export default async function AgreementAnalyzerLeadDetailPage({ params }: PageProps) {
  const { leadId } = await params;
  const lead = await getAgreementAnalyzerLeadDetail(leadId);

  if (!lead) {
    notFound();
  }

  return <AgreementAnalyzerLeadDetailView lead={lead} />;
}
