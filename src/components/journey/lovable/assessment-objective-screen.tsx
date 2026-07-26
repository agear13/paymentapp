'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Coins,
  Receipt,
  Layers,
  TrendingUp,
  Split,
  BarChart3,
  Sparkles,
  Check,
} from "lucide-react";


const OBJECTIVES = [
  { id: "paid-faster", icon: Coins, title: "Get paid faster", desc: "Shorten your invoice-to-cash cycle." },
  { id: "reconcile", icon: Receipt, title: "Reconcile invoices automatically", desc: "Match payments to invoices without spreadsheets." },
  { id: "reduce-admin", icon: Layers, title: "Reduce admin", desc: "Automate the manual work of running a business." },
  { id: "forecast", icon: TrendingUp, title: "Forecast cashflow", desc: "See what's coming in and out with clarity." },
  { id: "revenue-share", icon: Split, title: "Revenue sharing", desc: "Split, distribute and settle earnings automatically." },
  { id: "reporting", icon: BarChart3, title: "Improve reporting", desc: "Understand how your business really operates." },
  { id: "other", icon: Sparkles, title: "Something else", desc: "Let Provvy AI figure out where to start." },
];

export function AssessmentObjectiveScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const select = (id: string) => {
    setSelected(id);
    try {
      sessionStorage.setItem('provvy.objective', id);
    } catch {}
    setTimeout(() => router.push('/journey/assessment/business'), 500);
  };

  return (
    <section className="relative px-6 pt-16 pb-24 animate-fade-up">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-[12px] text-ink-soft shadow-soft">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          Commercial Assessment
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl md:text-6xl">
          What would you like to improve?
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-soft">
          Pick the outcome that matters most. Provvy will design the right commercial workflow around it.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OBJECTIVES.map((o, i) => {
            const Icon = o.icon;
            const isSelected = selected === o.id;
            return (
              <button
                key={o.id}
                onClick={() => select(o.id)}
                style={{ animationDelay: `${i * 40}ms` }}
                className={`group relative text-left rounded-2xl border bg-card p-5 shadow-card transition-all animate-fade-up hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow ${
                  isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  {isSelected && (
                    <div className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground animate-fade-up">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
                <div className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">
                  {o.title}
                </div>
                <div className="mt-1 text-[13px] text-ink-soft">{o.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
