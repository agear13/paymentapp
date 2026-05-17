'use client';

import * as React from 'react';
import Link from 'next/link';
import { FolderKanban, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardProductProfile } from '@/lib/auth/admin-shared';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { fetchPilotSnapshot, persistPilotSnapshot } from '@/lib/deal-network-demo/pilot-store';
import { CreateDealModal } from '@/components/deal-network-demo/create-deal-modal';
import { ProjectCard } from '@/components/projects/project-card';
import {
  sortProjectsForWorkspace,
  summarizeProject,
} from '@/lib/projects/project-workspace-summary';
import { useDealNetworkExperience } from '@/components/deal-network-demo/deal-network-experience-provider';
import { useToast } from '@/hooks/use-toast';

type ProjectsWorkspaceIndexProps = {
  productProfile: DashboardProductProfile;
};

export function ProjectsWorkspaceIndex({ productProfile }: ProjectsWorkspaceIndexProps) {
  const { dealNetworkExperienceMode } = useDealNetworkExperience();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [deals, setDeals] = React.useState<RecentDeal[]>([]);
  const [participants, setParticipants] = React.useState<DemoParticipant[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);

  const hasRevenueShareAccess = productProfile === 'admin';

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await fetchPilotSnapshot();
      if (snapshot) {
        setDeals(snapshot.deals.filter((d) => !d.archived));
        setParticipants(snapshot.participants);
      } else {
        setDeals([]);
        setParticipants([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const summaries = React.useMemo(() => {
    const items = deals.map((d) => summarizeProject(d, participants));
    return sortProjectsForWorkspace(items);
  }, [deals, participants]);

  const handleCreateProject = React.useCallback(
    async (deal: RecentDeal) => {
      const nextDeals = [deal, ...deals.filter((d) => d.id !== deal.id)];
      setDeals(nextDeals);
      const ok = await persistPilotSnapshot({ deals: nextDeals, participants });
      if (!ok) {
        toast({
          title: 'Could not save project',
          description: 'Try again from the project workspace.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Project created', description: deal.dealName });
      setCreateOpen(false);
    },
    [deals, participants, toast]
  );

  if (!hasRevenueShareAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Projects are your operational container for participants, funding, obligations, and
            payouts.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Project coordination</CardTitle>
            <CardDescription>
              Your account is set up for payment collection. Project coordination workspaces unlock
              when revenue-share features are enabled for your organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/payments">Go to Payments</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Your operational workspace — coordinate participants, funding, obligations, and payouts
            per project.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create project
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading projects…
        </div>
      ) : summaries.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FolderKanban className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Create your first project</CardTitle>
            <CardDescription>
              A project is where you coordinate who gets paid, how funds enter, and when payouts
              can be released safely.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summaries.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <CreateDealModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreateProject}
        experienceMode={dealNetworkExperienceMode}
      />
    </div>
  );
}
