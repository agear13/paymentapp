import { WorkflowDetailScreen } from '@/components/journey/lovable/workflow-detail-screen';

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <WorkflowDetailScreen slug={slug} />;
}
