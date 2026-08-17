import { notFound } from 'next/navigation';
import { WorkflowDetailScreen } from '@/components/journey/lovable/workflow-detail-screen';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';

export default async function WorkflowPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getWorkflowBySlug(slug)) {
    notFound();
  }
  return <WorkflowDetailScreen slug={slug} />;
}
