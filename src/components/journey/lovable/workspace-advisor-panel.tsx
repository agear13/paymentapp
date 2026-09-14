'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AssessmentProvvyIdentity } from '@/components/journey/lovable/assessment-provvy-identity';
import { createClient } from '@/lib/supabase/client';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import {
  advisorDisplayName,
  buildWorkspaceAdvisorIntro,
} from '@/lib/journey/workspace-advisor-intro';
import { buildWorkspaceRecommendationState } from '@/lib/journey/workspace-recommendation';
import { getWorkspaceAdvisorSeenStore } from '@/lib/journey/workspace-advisor-seen.client';
import type { JourneyAssessmentSnapshot } from '@/lib/journey/journey-assessment-storage.client';

const INTRO_BODY =
  "I've used what you told me during setup to shape this workspace. You can start working now — recommendations are optional.";

const RETURN_BODY = "Here's what I know from your setup so far.";

const SYSTEMS_SUPPORT =
  'Connecting systems is optional. The more you connect, the more context Provvy has later.';

export function WorkspaceAdvisorPanel({
  snapshot,
  deployedWorkflowSlugs = [],
  hidePrimaryRecommendation = false,
}: {
  snapshot: JourneyAssessmentSnapshot;
  deployedWorkflowSlugs?: string[];
  hidePrimaryRecommendation?: boolean;
}) {
  const readiness = useCommercialReadinessOptional();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [firstVisit, setFirstVisit] = useState<boolean | null>(null);

  useEffect(() => {
    const store = getWorkspaceAdvisorSeenStore();
    const seen = store.hasSeen();
    setFirstVisit(!seen);
    if (!seen) {
      store.markSeen();
      void fetch('/api/workspace/advisor/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'viewed_advisor' }),
        credentials: 'include',
      }).catch(() => {});
    }
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

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div className="rounded-2xl border border-primary/20 bg-card p-5 shadow-card">
        <AssessmentProvvyIdentity />

        {firstVisit === null ? (
          <div className="mt-5 h-24 animate-pulse rounded-xl bg-secondary/60" />
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <div className="text-[15px] font-semibold tracking-tight">{intro.greeting}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                {firstVisit ? INTRO_BODY : RETURN_BODY}
              </p>
            </div>

            {intro.findings.length > 0 ? (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
                  What I know so far
                </div>
                <ul className="mt-2 space-y-1 text-[13px] text-foreground">
                  {intro.findings.map((finding) => (
                    <li key={finding.key}>
                      • {finding.label}: {finding.value}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!hidePrimaryRecommendation && intro.recommendation ? (
              <div className="rounded-2xl border border-primary/20 bg-accent p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
                  Recommended next step
                </div>
                {intro.recommendationSourceLabel ? (
                  <p className="mt-1 text-[12px] text-ink-soft">{intro.recommendationSourceLabel}</p>
                ) : null}
                <p className="mt-2 text-[13px] font-medium text-foreground">
                  {intro.recommendation.title}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
                  {intro.recommendation.description}
                </p>
                <Link
                  href={intro.recommendation.destination}
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-transform hover:scale-[1.01]"
                >
                  {intro.recommendation.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : null}

            <p className="text-[12.5px] leading-relaxed text-ink-soft">{intro.learningNote}</p>

            {intro.systemsCta ? (
              <div>
                <Link
                  href={intro.systemsCta.href}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  {intro.systemsCta.label}
                </Link>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{SYSTEMS_SUPPORT}</p>
              </div>
            ) : null}

            <Link
              href={`${COMMERCIAL_OS_ROUTES.accountPreferences}?focus=provvy-advisor`}
              className="group block rounded-lg py-0.5 transition-colors hover:text-foreground"
            >
              <span className="text-[12px] font-medium text-ink-soft group-hover:text-foreground">
                Make Provvy yours
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft/90">
                Personalise Provvy with a name, personality and preferences.
              </span>
            </Link>

            <Link
              href={intro.advisorHref}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
            >
              Open Provvy Advisor
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
