'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useOptionalLandingAdvisor } from '@/components/journey/lovable/landing-advisor-context';
import { useOptionalLandingIntelligence } from '@/components/journey/lovable/landing-intelligence-context';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import {
  advisorExcludeDigitalDollarFilters,
  hasSeenAdvisorIntro,
  markAdvisorIntroSeen,
  presentAdvisor,
  type AdvisorAction,
  type AdvisorActionId,
} from '@/lib/journey/landing-advisor';
import { findIntelligenceItem, searchHintForItem } from '@/lib/journey/payment-intelligence-rank';
import { persistJourneyBusiness, persistJourneyObjective } from '@/lib/journey/journey-assessment-storage.client';
import { objectiveFromLandingSearch } from '@/lib/journey/landing-route-model';
import { hasExplicitThemePreference, markThemeHintSeen } from '@/lib/theme/provvy-theme';
import { useProvvyTheme } from '@/hooks/use-provvy-theme';

function isDesktop() {
  return window.matchMedia('(min-width: 768px)').matches;
}

function AdvisorMark() {
  return (
    <span
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-purple text-[10px] font-semibold text-primary-foreground"
      aria-hidden="true"
    >
      P
    </span>
  );
}

const PRIMARY_ACTIONS = new Set<AdvisorActionId>(['personalise']);
const LOW_EMPHASIS_ACTIONS = new Set<AdvisorActionId>(['see-how-provvy-works']);

export function LandingAdvisor() {
  const advisor = useOptionalLandingAdvisor();
  const intelligence = useOptionalLandingIntelligence();
  const { setTheme } = useProvvyTheme();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [activeAction, setActiveAction] = useState<AdvisorActionId | null>(null);

  const update = advisor?.update;
  const stage = advisor?.context.stage;
  const priority = advisor?.context.priority;
  const recommendedProviderId = advisor?.context.recommendedProviderId;
  const filterNote = advisor?.context.filterNote;

  useEffect(() => {
    setOpen(!hasSeenAdvisorIntro() && isDesktop());
    setReady(true);
  }, []);

  useEffect(() => {
    update?.({ showThemeChoice: !hasExplicitThemePreference() });
  }, [update]);

  useEffect(() => {
    if (!ready || !advisor) return;
    if ((stage === 'results' || stage === 'detail') && isDesktop()) {
      setOpen(true);
    }
  }, [stage, priority, recommendedProviderId, filterNote, ready, advisor]);

  useEffect(() => {
    setActiveAction(null);
  }, [priority, recommendedProviderId, filterNote, stage]);

  if (!advisor || !ready) return null;

  const highlightedIntelligenceId =
    intelligence?.highlightedId ?? advisor.context.highlightedIntelligenceId;

  const presentation = presentAdvisor(
    {
      ...advisor.context,
      highlightedIntelligenceId,
      showThemeChoice: advisor.context.showThemeChoice && !hasExplicitThemePreference(),
    },
    activeAction
  );

  const collapse = (persistIntro = true) => {
    if (persistIntro) markAdvisorIntroSeen();
    setActiveAction(null);
    setOpen(false);
  };

  const handleAction = (action: AdvisorAction) => {
    switch (action.id) {
      case 'theme-light':
        setTheme('light');
        markThemeHintSeen();
        advisor.update({ showThemeChoice: false });
        markAdvisorIntroSeen();
        return;
      case 'theme-dark':
        setTheme('dark');
        markThemeHintSeen();
        advisor.update({ showThemeChoice: false });
        markAdvisorIntroSeen();
        return;
      case 'keep-exploring':
        collapse(true);
        return;
      case 'see-how-provvy-works':
        setActiveAction((current) =>
          current === 'see-how-provvy-works' ? null : 'see-how-provvy-works'
        );
        return;
      case 'show-developments':
      case 'show-affected-routes': {
        const highlighted = findIntelligenceItem(highlightedIntelligenceId);
        const hint =
          action.id === 'show-affected-routes' && highlighted
            ? searchHintForItem(highlighted)
            : null;
        intelligence?.requestCompare(hint);
        if (isDesktop()) setOpen(true);
        return;
      }
      case 'why-first':
        setActiveAction('why-first');
        return;
      case 'what-is-digital-dollar':
        setActiveAction((current) =>
          current === 'what-is-digital-dollar' ? null : 'what-is-digital-dollar'
        );
        return;
      case 'exclude-digital-dollar':
        setActiveAction(null);
        advisor.applyFilters(advisorExcludeDigitalDollarFilters());
        return;
      case 'whats-faster':
        setActiveAction(null);
        advisor.changePriority('fastest');
        return;
      case 'whats-simpler':
        setActiveAction(null);
        advisor.changePriority('simplest');
        return;
      case 'whats-cheaper':
        setActiveAction(null);
        advisor.changePriority('lowest_cost');
        return;
      case 'personalise':
        markAdvisorIntroSeen();
        return;
    }
  };

  const persistPersonalise = () => {
    const { transactionType, origin, destination, currency, amount } = advisor.context;
    if (!transactionType || !origin || !destination || !currency || !amount) return;
    persistJourneyObjective(
      objectiveFromLandingSearch({
        originCountry: origin as never,
        destinationCountry: destination as never,
        amount,
        currency,
        transactionType,
        priority: advisor.context.priority ?? 'lowest_cost',
      })
    );
    persistJourneyBusiness({
      challenge: `${transactionType}:${origin}:${destination}:${currency}:${amount}`,
    });
  };

  const primaryActions = presentation.actions.filter((action) => PRIMARY_ACTIONS.has(action.id));
  const lowEmphasisActions = presentation.actions.filter((action) =>
    LOW_EMPHASIS_ACTIONS.has(action.id)
  );
  const routeActions = presentation.actions.filter(
    (action) => !PRIMARY_ACTIONS.has(action.id) && !LOW_EMPHASIS_ACTIONS.has(action.id)
  );

  const renderAction = (action: AdvisorAction, kind: 'primary' | 'quiet' | 'route') => {
    if (action.id === 'personalise') {
      return (
        <Link
          key={action.id}
          href={COMMERCIAL_OS_ROUTES.assessment}
          onClick={() => {
            persistPersonalise();
            handleAction(action);
          }}
          className="inline-flex rounded-lg bg-foreground px-3 py-1.5 text-[12px] font-medium text-background"
        >
          {action.label} →
        </Link>
      );
    }
    return (
      <button
        key={action.id}
        type="button"
        onClick={() => handleAction(action)}
        className={
          kind === 'quiet'
            ? 'text-[12px] font-medium text-ink-soft underline-offset-2 hover:text-foreground hover:underline'
            : `rounded-lg border px-2.5 py-1.5 text-[12px] font-medium hover:bg-accent ${
                activeAction === action.id
                  ? 'border-primary/40 bg-accent text-foreground'
                  : 'border-border bg-background'
              }`
        }
      >
        {action.label}
      </button>
    );
  };

  const panel = (
    <aside
      aria-label="Provvy Advisor"
      data-advisor-placement="alongside"
      className="pointer-events-auto flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-primary/20 bg-card/95 shadow-soft backdrop-blur-md max-md:rounded-b-none md:max-h-[calc(100vh-7rem)]"
    >
      <div className="flex items-start justify-between gap-2 border-b border-border/60 px-3.5 py-3">
        <div className="flex items-start gap-2">
          <AdvisorMark />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              {presentation.eyebrow}
            </p>
            <p className="text-[11px] text-ink-soft">{presentation.status}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => collapse(true)}
          className="grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:bg-accent hover:text-foreground"
          aria-label="Dismiss Advisor"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        key={stage}
        className="min-h-0 overflow-y-auto px-3.5 py-3 transition-opacity duration-300"
      >
        {presentation.criteria.length ? (
          <ul className="mb-2 flex flex-wrap gap-1" aria-label="Current payment criteria">
            {presentation.criteria.map((item) => (
              <li
                key={item}
                className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        ) : null}
        {presentation.conclusion ? (
          <p className="text-[14px] font-medium leading-snug text-foreground">
            {presentation.conclusion}
          </p>
        ) : null}
        {presentation.lines.length ? (
          <div
            className={`space-y-2 text-[12px] leading-snug text-ink-soft ${presentation.conclusion ? 'mt-2' : ''}`}
          >
            {presentation.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
        {presentation.explainer ? (
          <div className="mt-2 rounded-xl bg-background px-2.5 py-2">
            <p className="text-[12px] leading-relaxed text-ink-soft">{presentation.explainer.body}</p>
            {presentation.explainer.action ? (
              <button
                type="button"
                onClick={() => handleAction(presentation.explainer!.action!)}
                className="mt-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium hover:bg-accent"
              >
                {presentation.explainer.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
        {primaryActions.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {primaryActions.map((action) => renderAction(action, 'primary'))}
          </div>
        ) : null}
        {lowEmphasisActions.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {lowEmphasisActions.map((action) => renderAction(action, 'quiet'))}
          </div>
        ) : null}
        {routeActions.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/50 pt-3">
            {routeActions.map((action) => renderAction(action, 'route'))}
          </div>
        ) : null}
      </div>
    </aside>
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      {open ? (
        <button
          type="button"
          aria-label="Close Advisor overlay"
          onClick={() => collapse(true)}
          className="pointer-events-auto absolute inset-0 bg-background/40 md:hidden"
        />
      ) : null}
      {open ? (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 md:inset-auto md:right-4 md:top-24 md:w-[20.5rem]">
          {panel}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pointer-events-auto absolute bottom-24 right-3 flex items-center gap-2 rounded-full border border-primary/20 bg-card/95 py-1.5 pl-1.5 pr-3 shadow-soft backdrop-blur-md md:bottom-auto md:right-4 md:top-24"
          aria-label="Open Provvy Advisor"
        >
          <AdvisorMark />
          <span className="text-[12px] font-medium">Provvy Advisor</span>
        </button>
      )}
    </div>
  );
}
