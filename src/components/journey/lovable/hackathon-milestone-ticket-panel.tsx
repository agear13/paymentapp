'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Check, Loader2, Sparkles, Ticket } from 'lucide-react';
import {
  HACKATHON_MILESTONE_TICKET_START,
  HACKATHON_MILESTONE_TICKET_THRESHOLD,
} from '@/lib/journey/hackathon-milestone-collection.client';

type PanelPhase = 'intro' | 'counting' | 'achieved' | 'ready';

type Props = {
  milestoneLabel: string;
  autoPlay?: boolean;
  fastMode?: boolean;
  onMilestoneAchieved: () => void;
};

const TICKET_STEPS = [
  HACKATHON_MILESTONE_TICKET_START,
  HACKATHON_MILESTONE_TICKET_START + 1,
  HACKATHON_MILESTONE_TICKET_THRESHOLD,
] as const;

function stepDelayMs(fastMode: boolean, index: number): number {
  if (fastMode) return index === 0 ? 600 : 700;
  return index === 0 ? 900 : 1100;
}

export function HackathonMilestoneTicketPanel({
  milestoneLabel,
  autoPlay = true,
  fastMode = false,
  onMilestoneAchieved,
}: Props) {
  const [phase, setPhase] = useState<PanelPhase>('intro');
  const [ticketIndex, setTicketIndex] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);
  const achievedRef = useRef(false);

  useEffect(() => {
    if (!autoPlay) return;

    let cancelled = false;
    const timeouts: number[] = [];

    const schedule = (fn: () => void, ms: number) => {
      timeouts.push(window.setTimeout(fn, ms));
    };

    setPhase('intro');
    setTicketIndex(0);

    schedule(() => {
      if (cancelled) return;
      setPhase('counting');
    }, fastMode ? 400 : 650);

    let elapsed = fastMode ? 400 : 650;
    TICKET_STEPS.forEach((_, index) => {
      elapsed += stepDelayMs(fastMode, index);
      schedule(() => {
        if (cancelled) return;
        setTicketIndex(index);
        setPulseKey((value) => value + 1);
      }, elapsed);
    });

    elapsed += fastMode ? 700 : 900;
    schedule(() => {
      if (cancelled) return;
      setPhase('achieved');
      if (!achievedRef.current) {
        achievedRef.current = true;
        onMilestoneAchieved();
      }
    }, elapsed);

    elapsed += fastMode ? 550 : 750;
    schedule(() => {
      if (cancelled) return;
      setPhase('ready');
    }, elapsed);

    return () => {
      cancelled = true;
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [autoPlay, fastMode, onMilestoneAchieved]);

  const ticketCount = TICKET_STEPS[ticketIndex] ?? TICKET_STEPS[0];
  const counting = phase === 'counting';
  const achieved = phase === 'achieved' || phase === 'ready';

  return (
    <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-accent/70 via-background to-transparent p-5 shadow-glow">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
        <Ticket className="h-3.5 w-3.5 text-primary" />
        Milestone monitor
      </div>

      <div className="mt-4 space-y-3">
        <div
          className={`rounded-xl border px-4 py-4 transition-all duration-500 ${
            counting
              ? 'border-primary/30 bg-accent/50'
              : achieved
                ? 'border-emerald-500/35 bg-emerald-500/5'
                : 'border-border bg-card'
          }`}
        >
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Validated ticket sales
          </div>
          <div
            key={pulseKey}
            className={`mt-1 tabular-nums text-4xl font-semibold tracking-[-0.03em] transition-transform duration-300 ${
              counting ? 'animate-fade-up scale-105 text-gradient' : achieved ? 'text-emerald-600 dark:text-emerald-400' : ''
            }`}
          >
            {ticketCount.toLocaleString()}
          </div>
          {counting && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Live ticket validation in progress…
            </div>
          )}
        </div>

        <div className="flex justify-center text-ink-soft/50">
          <ArrowDown className="h-4 w-4 animate-pulse" />
        </div>

        <div
          className={`rounded-xl border px-4 py-3 transition-all duration-500 ${
            achieved ? 'border-emerald-500/35 bg-emerald-500/5 opacity-100' : 'border-border bg-background opacity-40'
          }`}
        >
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            {achieved ? (
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Sparkles className="h-4 w-4 text-ink-soft" />
            )}
            {achieved ? 'Milestone achieved' : 'Awaiting milestone'}
          </div>
          <p className="mt-1 text-[12px] text-ink-soft">{milestoneLabel}</p>
        </div>
      </div>
    </div>
  );
}
