'use client';

import './lovable-journey.css';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Moon, Sun, ArrowLeft } from 'lucide-react';
import { ProvvyBrandMark } from '@/components/journey/lovable/provvy-brand-mark';
import {
  JOURNEY_ROUTES,
  JOURNEY_STEPS,
  journeyProgressPercent,
  journeyStepIndex,
} from '@/lib/journey/hackathon-journey';

export function AssessmentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? '';
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefers;
    setDark(isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const currentIndex = Math.max(0, journeyStepIndex(pathname, search));
  const progress = journeyProgressPercent(pathname, search);

  return (
    <div className={`lovable-journey min-h-screen ${dark ? 'dark' : ''}`}>
      <div className="min-h-screen bg-background text-foreground antialiased">
        <div
          className="pointer-events-none fixed inset-x-0 top-0 h-[500px]"
          style={{ background: 'var(--gradient-hero)' }}
        />
        <header className="sticky top-4 z-50 mx-auto w-[min(1200px,calc(100%-2rem))] rounded-2xl glass px-5 py-3 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <ProvvyBrandMark href={JOURNEY_ROUTES.landing} />
            <div className="hidden flex-1 items-center gap-3 md:flex">
              <div className="text-[12px] text-ink-soft">
                Step {currentIndex + 1} of {JOURNEY_STEPS.length} · {JOURNEY_STEPS[currentIndex]?.label}
              </div>
              <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggle}
                aria-label="Toggle dark mode"
                className="grid h-9 w-9 place-items-center rounded-xl border border-border text-ink-soft transition-colors hover:bg-accent hover:text-foreground"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link
                href={JOURNEY_ROUTES.landing}
                className="hidden items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Exit
              </Link>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 md:hidden">
            <div className="text-[11px] text-ink-soft whitespace-nowrap">
              {currentIndex + 1}/{JOURNEY_STEPS.length}
            </div>
            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </header>
        <main className="relative">{children}</main>
      </div>
    </div>
  );
}
