import { notFound } from 'next/navigation';
import { AgreementIntelligenceHubScreen } from '@/components/journey/lovable/agreement-intelligence-hub-screen';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';

export default async function WorkflowAgreementDetailPage({
  params,
}: {
  params: Promise<{ slug: string; agreementId: string }>;
}) {
  const { slug, agreementId } = await params;
  if (slug !== 'agreement-intelligence' || !getWorkflowBySlug(slug) || !agreementId.trim()) {
    notFound();
  }

  return <AgreementIntelligenceHubScreen agreementId={agreementId} />;
}
