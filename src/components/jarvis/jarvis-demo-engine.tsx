'use client';

import { useEffect, useRef, useState } from 'react';
import { ProvvyOrb } from '@/components/jarvis/provvy-orb';
import {
  JARVIS_DEMO_HERO_SCENARIO_ID,
  JARVIS_DEMO_SCENARIOS,
  type JarvisDemoScenario,
} from '@/lib/jarvis/jarvis-demo-scenarios';
import { resolveJarvisDemoAudioSrc } from '@/lib/jarvis/jarvis-demo-audio';
import {
  advanceJarvisDemoSession,
  assistantLineForSession,
  beginJarvisDemoSession,
  createIdleJarvisDemoSession,
  selectSimulatedJarvisDemoInput,
  type JarvisDemoSession,
} from '@/lib/jarvis/jarvis-demo-session';
import { resolveJarvisOrbStepDurationMs } from '@/lib/jarvis/jarvis-orb-states';

export function JarvisDemoEngine({
  scenarios = JARVIS_DEMO_SCENARIOS,
  onSessionChange,
  compact = false,
}: {
  scenarios?: readonly JarvisDemoScenario[];
  onSessionChange?: (session: JarvisDemoSession) => void;
  compact?: boolean;
}) {
  const [session, setSession] = useState<JarvisDemoSession>(createIdleJarvisDemoSession);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  const scenario = scenarios.find((item) => item.id === session.scenarioId) ?? null;
  const heroScenario =
    scenarios.find((item) => item.id === JARVIS_DEMO_HERO_SCENARIO_ID) ?? scenarios[0] ?? null;
  const audioSrc = resolveJarvisDemoAudioSrc(scenario?.audioResponse);
  const assistantLine = assistantLineForSession(session);
  const canStart = session.status === 'idle' || session.status === 'complete';

  const updateSession = (next: JarvisDemoSession) => {
    setSession(next);
    onSessionChange?.(next);
  };

  const stopDemoAudio = () => {
    const audio = audioRef.current;
    if (!audio?.currentSrc && !audio?.src) return;
    try {
      audio.pause();
    } catch {
      // jsdom does not implement HTMLMediaElement.pause
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      stopDemoAudio();
    };
  }, []);

  useEffect(() => {
    if (session.status !== 'running' || !scenario) return;

    const step = scenario.orbSequence[session.stepIndex];
    if (!step) return;

    const finishStep = () => {
      updateSession(advanceJarvisDemoSession(session, scenarios));
    };

    if (step.state === 'speaking' && audioSrc && audioRef.current) {
      const audio = audioRef.current;
      const handleEnded = () => finishStep();
      const handleError = () => {
        timerRef.current = window.setTimeout(
          finishStep,
          resolveJarvisOrbStepDurationMs(step, scenario.spokenResponse)
        );
      };

      stopDemoAudio();
      audio.src = audioSrc;
      try {
        audio.currentTime = 0;
      } catch {
        // jsdom may not implement currentTime
      }
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      const playback = audio.play();
      if (playback && typeof playback.catch === 'function') {
        void playback.catch(handleError);
      } else {
        handleError();
      }

      return () => {
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      };
    }

    const duration = resolveJarvisOrbStepDurationMs(step, scenario.spokenResponse);
    if (duration <= 0) {
      finishStep();
      return;
    }

    timerRef.current = window.setTimeout(finishStep, duration);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [session, scenario, audioSrc, scenarios]);

  const handleSelectScenario = (nextScenario: JarvisDemoScenario) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    stopDemoAudio();
    startedRef.current = true;
    updateSession(beginJarvisDemoSession(selectSimulatedJarvisDemoInput(nextScenario), scenarios));
  };

  const handleStartHero = () => {
    if (!canStart || !heroScenario) return;
    handleSelectScenario(heroScenario);
  };

  const caption = session.userTranscript
    ? null
    : (session.caption ?? (session.orbState === 'idle' ? 'Ready when you are.' : null));
  const showScenarioPicker = !compact || canStart;

  return (
    <div
      className={`jarvis-demo-engine mx-auto w-full max-w-xl px-1 sm:max-w-2xl ${compact ? 'jarvis-demo-engine--compact' : ''}`}
      data-orb-state={session.orbState}
      data-session-status={session.status}
      data-completed={session.completed ? 'true' : 'false'}
      data-execution="simulated"
      data-hero-scenario={heroScenario?.id ?? ''}
      data-audio-started={startedRef.current ? 'true' : 'false'}
    >
      <p className="text-center text-[11px] font-medium uppercase tracking-[0.22em] text-ink-soft">
        Provvy
      </p>

      <div className={`flex justify-center ${compact ? 'mt-3' : 'mt-4 sm:mt-5'}`}>
        {canStart && heroScenario ? (
          <button
            type="button"
            onClick={handleStartHero}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label={`Start ${heroScenario.label} demo`}
          >
            <ProvvyOrb state={session.orbState} size="fluid" />
          </button>
        ) : (
          <ProvvyOrb state={session.orbState} size="fluid" />
        )}
      </div>

      <p
        className={`min-h-[1.35rem] text-center text-[14px] text-ink-soft sm:text-[15px] ${compact ? 'mt-3' : 'mt-4 sm:mt-5'}`}
        aria-live="polite"
      >
        {caption ? `“${caption}”` : '\u00a0'}
      </p>

      {session.orbState === 'executing' ? (
        <div
          className="mx-auto mt-2 h-0.5 w-24 overflow-hidden rounded-full bg-border"
          data-testid="jarvis-demo-executing"
          aria-hidden
        >
          <div className="h-full w-full origin-left animate-pulse bg-primary" />
        </div>
      ) : (
        <div className="mt-2 h-0.5 w-24 mx-auto" aria-hidden />
      )}

      <div className={`min-h-[4.25rem] text-center ${compact ? 'mt-3 px-2' : 'mt-4 sm:mt-5'}`}>
        {session.userTranscript ? (
          <p className="mx-auto max-w-lg text-balance text-[15px] font-medium leading-relaxed text-foreground sm:text-[16px]">
            “{session.userTranscript}”
          </p>
        ) : null}
        {assistantLine ? (
          <p
            className="mx-auto mt-3 max-w-lg text-balance text-[14.5px] leading-relaxed text-ink-soft sm:text-[15px]"
            data-testid="jarvis-demo-assistant-line"
          >
            {assistantLine}
          </p>
        ) : null}
      </div>

      {showScenarioPicker ? (
        <>
          <p className={`text-center text-[10px] font-medium uppercase tracking-[0.18em] text-ink-soft/80 ${compact ? 'mt-4' : 'mt-5 sm:mt-6'}`}>
            Try an instruction
          </p>
          <ul className="mt-2 flex flex-wrap justify-center gap-1.5 sm:gap-2">
            {scenarios.map((item) => {
              const selected = session.scenarioId === item.id;
              const featured = item.id === JARVIS_DEMO_HERO_SCENARIO_ID;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectScenario(item)}
                    disabled={session.status === 'running'}
                    data-scenario-id={item.id}
                    aria-label={item.userInstruction}
                    className={`rounded-full border px-3 py-1.5 text-[12px] leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:text-[12.5px] ${
                      selected
                        ? 'border-primary/50 bg-accent/50 text-foreground'
                        : featured
                          ? 'border-primary/40 bg-accent/30 text-foreground hover:border-primary/55'
                          : 'border-border/50 bg-transparent text-ink-soft hover:border-primary/25 hover:text-foreground'
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <audio ref={audioRef} preload="none" className="hidden" aria-hidden />
    </div>
  );
}
