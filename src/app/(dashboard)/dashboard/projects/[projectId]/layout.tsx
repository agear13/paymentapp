import { ProjectWorkspaceProvider } from '@/components/projects/project-workspace-provider';
import { ProjectWorkspaceShell } from '@/components/projects/project-workspace-shell';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
};

export default async function ProjectWorkspaceLayout({ children, params }: LayoutProps) {
  const { projectId } = await params;
  return (
    <ProjectWorkspaceProvider projectId={projectId}>
      <ProjectWorkspaceShell projectId={projectId}>{children}</ProjectWorkspaceShell>
    </ProjectWorkspaceProvider>
  );
}
