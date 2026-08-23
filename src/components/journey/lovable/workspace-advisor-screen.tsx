'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import { useCommercialTimeline } from '@/hooks/use-commercial-timeline';
import { useDeployedWorkflows } from '@/hooks/use-deployed-workflows';
import {
  ADVISOR_LEARNING_NOTE,
  advisorDisplayName,
  buildWorkspaceAdvisorIntro,
  deriveAdvisorActivityNote,
  snapshotFromOnboardingPayload,
} from '@/lib/journey/workspace-advisor-intro';
import { buildWorkspaceRecommendationState } from '@/lib/journey/workspace-recommendation';
import {
  hasJourneyAssessmentData,
  parseJourneyAssessmentContext,
  persistJourneyBusiness,
  persistJourneyObjective,
  restoreJourneyAssessment,
  type JourneyAssessmentSnapshot,
} from '@/lib/journey/journey-assessment-storage.client';

const SYSTEMS_SUPPORT =
  'Connecting systems is optional. The more you connect, the more context Provvy has later.';

export function WorkspaceAdvisorScreen() {
  const readiness = useCommercialReadinessOptional();
  const { workflows } = useDeployedWorkflows();
  const timeline = useCommercialTimeline();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<JourneyAssessmentSnapshot>({
    objective: null,
    business: null,
  });

  useEffect(() => {
    const local = restoreJourneyAssessment();
    if (hasJourneyAssessmentData(local)) {
      setSnapshot(local);
      return;
    }

    let cancelled = false;
    void fetch('/api/onboarding', { credentials: 'include', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { state?: { onboarding_context?: string; workspace_industry?: string } } | null) => {
        if (cancelled || !payload) return;
        const fromServer = snapshotFromOnboardingPayload(payload);
        if (!fromServer) return;
        const parsed = parseJourneyAssessmentContext(payload.state?.onboarding_context);
        if (parsed?.objective) persistJourneyObjective(parsed.objective);
        if (parsed?.business) persistJourneyBusiness(parsed.business);
        setSnapshot(fromServer);
      })
      .catch(() => {
        /* keep empty snapshot — do not invent assessment data */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      setDisplayName(
        advisorDisplayName({
          fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
          email: user.email,
        })
      );
    });
  }, []);

  const deployedWorkflowSlugs = useMemo(
    () => workflows.map((workflow) => workflow.templateSlug),
    [workflows]
  );

  const intro = useMemo(
    () =>
      buildWorkspaceAdvisorIntro({
        snapshot,
        displayName,
        workspace: buildWorkspaceRecommendationState({
          xeroConnected: readiness?.connection.connected === true,
          deployedWorkflowSlugs,
          readinessKnown: Boolean(readiness && !readiness.loading),
          merchantRails: readiness?.merchantRails,
        }),
      }),
    [snapshot, displayName, readiness, deployedWorkflowSlugs]
  );

  const activityNote = deriveAdvisorActivityNote({
    timelineLoaded: !timeline.loading && !timeline.error,
    hasCommercialActivity: timeline.hasCommercialActivity,
  });

  return (
    <div className="animate-fade-up mx-auto max-w-3xl space-y-8 pb-16">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full bg-gradient-purple px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-primary-foreground">
          <Sparkles className="h-3 w-3" />
          AI Advisor
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          {intro.greeting}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">
          Tell Provvy a little, start working, and recommendations can become more useful as you
          actually work. This is not a chatbot.
        </p>
        <p className="mt-2 text-[12px] text-ink-soft">{intro.statusLabel}</p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
          What Provvy knows so far
        </div>
        <p className="mt-1 text-[12px] text-ink-soft">What you told us during setup</p>
        {intro.findings.length > 0 ? (
          <ul className="mt-4 space-y-2 text-[14px] text-foreground">
            {intro.findings.map((finding) => (
              <li key={finding.key}>
                <span className="text-ink-soft">{finding.label}:</span> {finding.value}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">
            You have not told Provvy anything during setup yet. You can start working anyway.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
          What I recommend next
        </div>
        <p className="mt-1 text-[12px] text-ink-soft">
          {intro.recommendationSourceLabel ?? 'Based on what you told us during setup'}
        </p>
        {intro.recommendation ? (
          <div className="mt-4 rounded-2xl border border-primary/20 bg-accent p-4">
            <p className="text-[15px] font-medium text-foreground">{intro.recommendation.title}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
              {intro.recommendation.description}
            </p>
            <Link
              href={intro.recommendation.destination}
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground"
            >
              {intro.recommendation.actionLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">
            No setup recommendation right now. You can start working in the workspace.
          </p>
        )}
        {intro.systemsCta ? (
          <div className="mt-4">
            <Link
              href={intro.systemsCta.href}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-[13px] font-medium text-foreground hover:border-primary/40 hover:bg-accent"
            >
              {intro.systemsCta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{SYSTEMS_SUPPORT}</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
          What Provvy is learning
        </div>
        <p className="mt-1 text-[12px] text-ink-soft">From how you actually work — not from setup answers</p>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">{ADVISOR_LEARNING_NOTE}</p>
        {activityNote ? (
          <p className="mt-3 text-[14px] leading-relaxed text-foreground">{activityNote}</p>
        ) : null}
      </section>

      <Link
        href={COMMERCIAL_OS_ROUTES.workspace}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
      >
        Back to Workspace
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
