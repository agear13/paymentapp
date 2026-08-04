import { WorkspaceLayout } from '@/components/journey/lovable/workspace-layout';
import { WorkspaceReadinessShell } from '@/components/journey/lovable/workspace-readiness-shell';

export default function CommercialWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceReadinessShell>
      <WorkspaceLayout>{children}</WorkspaceLayout>
    </WorkspaceReadinessShell>
  );
}
