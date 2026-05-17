'use client';

import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { ProjectContextNav } from '@/components/projects/project-context-nav';

type ProjectWorkspaceShellProps = {
  projectId: string;
  children: React.ReactNode;
};

export function ProjectWorkspaceShell({ projectId, children }: ProjectWorkspaceShellProps) {
  const ctx = useProjectWorkspace();

  if (ctx.loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading project…
      </div>
    );
  }

  if (ctx.notFound || !ctx.deal) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            All projects
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Project not found</CardTitle>
            <CardDescription>This project may have been removed or you may not have access.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/projects">Back to projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" className="w-fit px-0" asChild>
        <Link href="/dashboard/projects">
          <ArrowLeft className="mr-2 h-4 w-4" />
          All projects
        </Link>
      </Button>

      <ProjectContextNav projectId={projectId} />

      {children}
    </div>
  );
}
