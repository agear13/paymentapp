import '@/components/journey/lovable/lovable-journey.css';
import { WorkflowDetailScreen } from '@/components/journey/lovable/workflow-detail-screen';

export default async function PublicWorkflowDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="lovable-journey min-h-screen bg-background px-6 py-10 text-foreground antialiased">
      <div className="mx-auto max-w-5xl">
        <WorkflowDetailScreen
          slug={slug}
          backHref="/journey#workflow-library"
          backLabel="Back to Workflow Library"
        />
      </div>
    </div>
  );
}
