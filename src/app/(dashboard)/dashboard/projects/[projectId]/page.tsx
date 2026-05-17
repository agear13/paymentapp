import { ProjectDetailHub } from '@/components/projects/project-detail-hub';

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = await params;
  return <ProjectDetailHub projectId={projectId} />;
}
