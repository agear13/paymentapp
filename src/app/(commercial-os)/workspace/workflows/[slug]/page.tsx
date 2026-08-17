import { notFound } from 'next/navigation';
import { WorkflowSlugScreen } from '@/components/journey/lovable/workflow-slug-screen';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getWorkflowBySlug(slug)) {
    notFound();
  }
  return <WorkflowSlugScreen slug={slug} />;
}
