'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FolderKanban, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GatedButton } from '@/components/entitlements/feature-gate';
import { StarterLimitAlert } from '@/components/entitlements/starter-limit-alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { fetchPilotSnapshot, persistPilotSnapshot } from '@/lib/deal-network-demo/pilot-store';
import { CreateDealModal } from '@/components/deal-network-demo/create-deal-modal';
import { ProjectCard } from '@/components/projects/project-card';
import { AgreementHealthOverview } from '@/components/agreements/health/agreement-health-overview';
import { AgreementComparativeIntelligence } from '@/components/agreements/health/agreement-comparative-intelligence';
import { useAgreementHealthPortfolio } from '@/hooks/use-agreement-health-portfolio';
import {
  sortProjectsForWorkspace,
  summarizeProject,
  type ProjectWorkspaceSummary,
} from '@/lib/projects/project-workspace-summary';
import { useDealNetworkExperience } from '@/components/deal-network-demo/deal-network-experience-provider';
import { useToast } from '@/hooks/use-toast';
import { CreateFromConversationButton } from '@/components/ai-extractor/create-from-conversation-button';
import { trackOutcomeOnce } from '@/lib/agreements/validation/agreement-intelligence-analytics';

export function ProjectsWorkspaceIndex() {
  const router = useRouter();
  const { dealNetworkExperienceMode } = useDealNetworkExperience();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [deals, setDeals] = React.useState<RecentDeal[]>([]);
  const [participants, setParticipants] = React.useState<DemoParticipant[]>([]);
  const [summaries, setSummaries] = React.useState<ProjectWorkspaceSummary[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const { portfolio, snapshots, loading: healthLoading } = useAgreementHealthPortfolio({
    enabled: !loading && deals.length > 0,
  });
  const healthByProjectId = React.useMemo(
    () => new Map(snapshots.map((s) => [s.projectId, s])),
    [snapshots]
  );

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

  React.useEffect(() => {
    if (loading) return;
    if (deals.length === 0) {
      setSummaries([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const items = await Promise.all(
        deals.map(async (d) => {
          try {
            const res = await fetch(
              `/api/operations/coordination-snapshot?projectId=${encodeURIComponent(d.id)}`,
              { cache: 'no-store', credentials: 'include' }
            );
            if (res.ok) {
              const json = (await res.json()) as {
                data?: {
                  summary?: {
                    releaseReadyCount: number;
                    payoutReadyCount: number;
                    participantCount: number;
                    blockerCount: number;
                  };
                };
              };
              const s = json.data?.summary;
              if (s) {
                return summarizeProject(d, participants, undefined, {
                  releaseReadyCount: s.releaseReadyCount,
                  payoutReadyCount: s.payoutReadyCount,
                  participantCount: s.participantCount,
                  blockerCount: s.blockerCount,
                  needsAttention:
                    s.blockerCount > 0 || s.releaseReadyCount < s.participantCount,
                });
              }
            }
          } catch {
            /* graph unavailable — legacy fallback */
          }
          return summarizeProject(d, participants);
        })
      );
      if (!cancelled) setSummaries(sortProjectsForWorkspace(items));
    })();
    return () => {
      cancelled = true;
    };
  }, [deals, participants, loading]);

  const handleCreateProject = React.useCallback(
    async (deal: RecentDeal) => {
      const nextDeals = [deal, ...deals.filter((d) => d.id !== deal.id)];
      setDeals(nextDeals);
      const ok = await persistPilotSnapshot({ deals: nextDeals, participants });
      if (!ok) {
        toast({
          title: 'Could not save agreement',
          description: 'Try again from the agreements workspace.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Agreement created', description: deal.dealName });
      trackOutcomeOnce('outcome_first_agreement', { agreementName: deal.dealName, projectId: deal.id });
      setCreateOpen(false);
      router.push(`/dashboard/projects/${encodeURIComponent(deal.id)}`);
      router.refresh();
    },
    [deals, participants, router, toast]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agreements</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Coordinate participants, funding, obligations, and settlement per agreement in one
            workspace.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <StarterLimitAlert feature="create_agreement" className="w-full sm:max-w-lg" />
          <div className="flex items-center gap-2">
            <CreateFromConversationButton
              entryPoint="project_create"
              onComplete={(dealId) => {
                if (dealId) {
                  void reload();
                  router.push(`/dashboard/projects/${encodeURIComponent(dealId)}`);
                  router.refresh();
                }
              }}
            />
            <GatedButton feature="create_agreement" onClick={() => setCreateOpen(true)} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Create agreement
            </GatedButton>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading agreements…
        </div>
      ) : summaries.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FolderKanban className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Create your first agreement</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Start by naming an agreement. You will add participants, link funding, track obligations,
              and coordinate settlement in one place.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 pb-8">
            <StarterLimitAlert feature="create_agreement" className="w-full max-w-md" />
            <CreateFromConversationButton
              entryPoint="project_create"
              size="lg"
              onComplete={(dealId) => {
                if (dealId) {
                  void reload();
                  router.push(`/dashboard/projects/${encodeURIComponent(dealId)}`);
                  router.refresh();
                }
              }}
            />
            <GatedButton feature="create_agreement" variant="ghost" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create agreement manually
            </GatedButton>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <AgreementHealthOverview portfolio={portfolio} loading={healthLoading} compact />

          {snapshots.length > 1 ? (
            <AgreementComparativeIntelligence snapshots={snapshots} loading={healthLoading} />
          ) : null}

          <div
            className={
              summaries.length === 1
                ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]'
                : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
            }
          >
            {summaries.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                health={healthByProjectId.get(project.id)}
              />
            ))}
            {summaries.length === 1 ? (
              <Card className="border-dashed bg-muted/10 h-fit">
                <CardHeader>
                  <CardTitle className="text-base">How agreements work</CardTitle>
                  <CardDescription>
                    Each agreement coordinates one commercial relationship from participant approvals
                    through settlement readiness.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}
          </div>
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
