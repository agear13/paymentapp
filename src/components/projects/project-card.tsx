import { SafeOperationalLink } from '@/components/operations/safe-operational-link';
import { ArrowRight, Users, Wallet, Banknote } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ProjectWorkspaceSummary } from '@/lib/projects/project-workspace-summary';
import { formatParticipantPayoutReadiness } from '@/lib/projects/format-participant-payout-readiness';

type ProjectCardProps = {
  project: ProjectWorkspaceSummary;
};

export function ProjectCard({ project }: ProjectCardProps) {
  const participantLabel = formatParticipantPayoutReadiness(
    project.participantsReady,
    project.participantCount
  );

  return (
    <SafeOperationalLink intent="open_project" projectId={project.id}>
      <Card
        className={`h-full transition-colors hover:bg-accent/40 ${
          project.needsAttention ? 'border-amber-500/35' : ''
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-lg truncate">{project.name}</CardTitle>
              {project.description ? (
                <CardDescription className="line-clamp-2 mt-1">{project.description}</CardDescription>
              ) : null}
            </div>
            {project.needsAttention ? (
              <Badge variant="outline" className="shrink-0 border-amber-500/50 text-amber-800">
                Needs attention
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{project.operationalStageLabel}</Badge>
            <Badge variant="outline">{project.settlementStatus}</Badge>
            <Badge variant="outline">{project.currencyLabel}</Badge>
          </div>

          <dl className="grid gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>
                Participants: {participantLabel}
                {project.participantsPending > 0 && project.participantCount > 0
                  ? ` · ${project.participantsPending} pending`
                  : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-3.5 w-3.5 shrink-0" />
              <span>Funding: {project.fundingLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Banknote className="h-3.5 w-3.5 shrink-0" />
              <span>Payouts: {project.payoutLabel}</span>
            </div>
          </dl>

          <div className="flex items-center text-sm font-medium text-primary pt-1">
            Open project
            <ArrowRight className="ml-1 h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </SafeOperationalLink>
  );
}
