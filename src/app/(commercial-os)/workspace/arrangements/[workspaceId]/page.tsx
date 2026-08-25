import { notFound } from 'next/navigation';
import { CommercialWorkspaceDetailScreen } from '@/components/journey/lovable/commercial-workspace-detail-screen';

export default async function CommercialWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  if (!workspaceId.trim()) {
    notFound();
  }

  return <CommercialWorkspaceDetailScreen workspaceId={workspaceId} />;
}
