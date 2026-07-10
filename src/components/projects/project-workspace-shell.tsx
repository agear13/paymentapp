'use client';

import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { ProjectContextNav } from '@/components/projects/project-context-nav';
import { ProjectContextHeader } from '@/components/projects/project-context-header';
import { opProjectWidth, opSpace } from '@/lib/design/operational-spacing';
import { ProjectOperationalGuidance } from '@/components/operations/project-operational-guidance';
import { safeProjectRouteContext } from '@/lib/operations/routing/draft-safe-routing';
import { ProjectOperationalLoadingState } from '@/components/projects/project-operational-loading-state';
import { WorkflowHeader } from '@/components/workflow/workflow-header';
import { CommercialBrainProvider } from '@/components/workflow/commercial-brain-context';
import { cn } from '@/lib/utils';

type ProjectWorkspaceShellProps = {
  projectId: string;
  children: React.ReactNode;
};

export function ProjectWorkspaceShell({ projectId, children }: ProjectWorkspaceShellProps) {
  const ctx = useProjectWorkspace();

  if (ctx.loading && !ctx.deal) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading agreement…
      </div>
    );
  }

  const routeProject = safeProjectRouteContext({
    projectId,
    deal: ctx.deal,
    loading: ctx.loading,
    notFound: ctx.notFound || !ctx.deal,
  });

  if ((ctx.notFound || !ctx.deal) && routeProject.phase === 'configuring') {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {PRODUCT_TERMINOLOGY.allProjects}
          </Link>
        </Button>
        <ProjectOperationalLoadingState
          variant="configuring"
          message={routeProject.guidance}
          onRetry={() => void ctx.refresh({ scope: 'all', force: true })}
        />
      </div>
    );
  }

  if (ctx.notFound || !ctx.deal) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {PRODUCT_TERMINOLOGY.allProjects}
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{PRODUCT_TERMINOLOGY.projectNotFound}</CardTitle>
            <CardDescription>
              This agreement may still be syncing. Your workspace data is safe — try refresh or
              return to onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => void ctx.refresh({ scope: 'all', force: true })}>Refresh</Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/projects">Back to agreements</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    // CommercialBrainProvider runs the Decision Engine once per agreement workspace.
    // WorkflowHeader, ProjectPageCopilot, and CommercialReadiness all consume this
    // shared result via useCommercialBrain() — no duplicated engine calls.
    <CommercialBrainProvider>
      <div className="space-y-6">
        <Button variant="ghost" className="w-fit px-0" asChild>
          <Link href="/dashboard/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {PRODUCT_TERMINOLOGY.allProjects}
          </Link>
        </Button>

        {/* Persistent workflow header — every agreement page begins with mission context */}
        <WorkflowHeader />

        <ProjectContextNav projectId={projectId} />

        <ProjectOperationalGuidance />

        {children}
      </div>
    </CommercialBrainProvider>
  );
}
