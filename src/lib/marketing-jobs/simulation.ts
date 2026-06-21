import type { MarketingJob, MarketingJobStage, MarketingJobStatus } from '@/lib/marketing-jobs/types';
import { AI_CREATIVE_TEAM } from '@/lib/marketing-jobs/creative-team';

function resolveJobStatus(elapsed: number): MarketingJobStatus {
  const readyOffset = AI_CREATIVE_TEAM[AI_CREATIVE_TEAM.length - 1]!.offsetMs;
  if (elapsed >= readyOffset) return 'completed';

  const qaOffset = AI_CREATIVE_TEAM.find((s) => s.id === 'quality-assurance')?.offsetMs ?? 4_000;
  if (elapsed >= qaOffset) return 'reviewing';

  const queuedOffset = AI_CREATIVE_TEAM[0]!.offsetMs;
  if (elapsed > queuedOffset) return 'generating';

  return 'queued';
}

function buildStages(createdMs: number, elapsed: number): MarketingJobStage[] {
  const firstIncompleteIndex = AI_CREATIVE_TEAM.findIndex(
    (specialist) => elapsed < specialist.offsetMs
  );

  return AI_CREATIVE_TEAM.map((specialist, index) => {
    const completed = elapsed >= specialist.offsetMs;
    const isActive =
      !completed &&
      (firstIncompleteIndex === -1 ? index === AI_CREATIVE_TEAM.length - 1 : index === firstIncompleteIndex);

    let status: MarketingJobStage['status'] = 'pending';
    if (completed) status = 'completed';
    else if (isActive) status = 'active';

    return {
      specialistId: specialist.id,
      title: specialist.stageTitle,
      description: specialist.stageDescription,
      icon: specialist.icon,
      status,
      completedAt: completed
        ? new Date(createdMs + specialist.offsetMs).toISOString()
        : undefined,
    };
  });
}

function resolveProgress(elapsed: number): number {
  let progress = AI_CREATIVE_TEAM[0]!.progress;
  for (const specialist of AI_CREATIVE_TEAM) {
    if (elapsed >= specialist.offsetMs) {
      progress = specialist.progress;
    }
  }
  return progress;
}

function resolveCurrentStageId(elapsed: number): string {
  const firstIncomplete = AI_CREATIVE_TEAM.find((specialist) => elapsed < specialist.offsetMs);
  return firstIncomplete?.id ?? AI_CREATIVE_TEAM[AI_CREATIVE_TEAM.length - 1]!.id;
}

export function reconcileVisualJobStages(job: MarketingJob, nowMs: number): MarketingJob {
  if (job.jobType !== 'generate_visuals' || job.status === 'failed') {
    return job;
  }

  const createdMs = Date.parse(job.createdAt);
  if (Number.isNaN(createdMs)) return job;

  const elapsed = Math.max(0, nowMs - createdMs);
  const stages = buildStages(createdMs, elapsed);
  const nextStatus = resolveJobStatus(elapsed);
  const nextProgress = resolveProgress(elapsed);
  const currentStageId = resolveCurrentStageId(elapsed);

  const unchanged =
    job.status === nextStatus &&
    job.progress === nextProgress &&
    job.currentStageId === currentStageId &&
    JSON.stringify(job.stages) === JSON.stringify(stages);

  if (unchanged) return job;

  return {
    ...job,
    status: nextStatus,
    progress: nextProgress,
    stages,
    currentStageId,
    updatedAt: new Date(nowMs).toISOString(),
  };
}

/** @deprecated Use reconcileVisualJobStages */
export function reconcileVisualJob(job: MarketingJob, nowMs: number): MarketingJob {
  return reconcileVisualJobStages(job, nowMs);
}

export function isVisualJobInFlight(job: MarketingJob): boolean {
  return job.jobType === 'generate_visuals' && job.status !== 'completed' && job.status !== 'failed';
}

export function isVisualJobReadyForDispatch(job: MarketingJob): boolean {
  return job.jobType === 'generate_visuals' && job.status === 'completed';
}

export function jobStatusRank(status: MarketingJobStatus): number {
  switch (status) {
    case 'queued':
      return 0;
    case 'generating':
      return 1;
    case 'reviewing':
      return 2;
    case 'completed':
      return 3;
    case 'failed':
      return 4;
    default:
      return 0;
  }
}

export function buildAiTeamActivity(job: MarketingJob | null) {
  if (!job?.stages?.length) return [];

  return job.stages
    .filter((stage) => stage.specialistId !== 'queued')
    .map((stage) => {
      const specialist = AI_CREATIVE_TEAM.find((member) => member.id === stage.specialistId);
      return {
        id: stage.specialistId,
        specialistId: stage.specialistId,
        role: specialist?.role ?? stage.title,
        title: stage.title,
        description:
          stage.status === 'completed'
            ? (specialist?.completedActivity ?? stage.description)
            : stage.status === 'active'
              ? stage.description
              : (specialist?.responsibility ?? stage.description),
        icon: stage.icon,
        completedAt: stage.completedAt,
        status: stage.status,
      };
    });
}

export function getActiveStageLabel(job: MarketingJob | null): string {
  if (!job?.stages?.length) return 'Not started';
  const active = job.stages.find((stage) => stage.status === 'active');
  if (active) return `${active.title} — ${active.description}`;
  const lastCompleted = [...job.stages].reverse().find((stage) => stage.status === 'completed');
  if (lastCompleted) return `${lastCompleted.title} complete`;
  return 'Queued';
}
