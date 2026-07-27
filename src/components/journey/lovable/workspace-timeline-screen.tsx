'use client';

import Link from 'next/link';
import { Activity, Check, CreditCard, Plug, RefreshCw, Sparkles, FileText } from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

const GROUPS = [
  {
    label: 'Today',
    events: [
      { icon: Check, title: 'Commercial OS provisioned', detail: 'All systems configured and ready.', time: 'Just now', tone: 'primary' as const },
      { icon: Sparkles, title: 'Autonomous Reconciliation recommended', detail: 'Highest-impact workflow identified for your business.', time: '2m ago', tone: 'primary' as const },
      { icon: Plug, title: 'Xero connected', detail: 'Live sync established with your accounting ledger.', time: '5m ago', tone: 'muted' as const },
      { icon: Check, title: 'Commercial assessment completed', detail: 'Business profile and objectives captured.', time: '8m ago', tone: 'muted' as const },
    ],
  },
  {
    label: 'Yesterday',
    events: [
      { icon: CreditCard, title: 'Payment received', detail: 'A$4,820 · Invoice #INV-1042 · Pinch Payments', time: '3:14pm', tone: 'muted' as const },
      { icon: FileText, title: 'Agreement extracted', detail: 'Master Services Agreement — Northline Group.', time: '11:02am', tone: 'muted' as const },
    ],
  },
  {
    label: 'Earlier this week',
    events: [
      { icon: RefreshCw, title: 'Settlement completed', detail: 'A$12,480 reconciled across 8 invoices.', time: '2 days ago', tone: 'muted' as const },
      { icon: CreditCard, title: 'Payment received', detail: 'A$1,290 · Invoice #INV-1039.', time: '3 days ago', tone: 'muted' as const },
    ],
  },
];

export function WorkspaceTimelineScreen() {
  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          <Activity className="h-3 w-3" />
          Commercial Timeline
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Every commercial event, one continuous story.
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">
          Provvy unifies activity across your systems into a single, chronological view of how your business actually operates.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="space-y-8">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                {group.label}
              </div>
              <div className="relative mt-3 space-y-1 pl-3">
                <div className="absolute bottom-2 left-[13px] top-2 w-px bg-border" />
                {group.events.map((event, index) => {
                  const Icon = event.icon;
                  return (
                    <div
                      key={`${group.label}-${index}`}
                      className="relative flex items-start gap-3 rounded-lg py-2.5 pl-4 pr-2 transition-colors hover:bg-secondary/60"
                    >
                      <div
                        className={`relative z-10 mt-0.5 grid h-7 w-7 place-items-center rounded-lg ${
                          event.tone === 'primary'
                            ? 'bg-accent text-accent-foreground'
                            : 'bg-secondary text-ink-soft'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[13.5px] font-medium">{event.title}</div>
                        <div className="text-[12px] text-ink-soft">{event.detail}</div>
                      </div>
                      <div className="whitespace-nowrap text-[11.5px] text-ink-soft">{event.time}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-5 py-4 text-[13px] text-ink-soft">
        Live timeline events sync from{' '}
        <Link href={COMMERCIAL_OS_ROUTES.connected} className="font-medium text-primary hover:underline">
          connected systems
        </Link>{' '}
        and deployed workflows.
      </div>
    </div>
  );
}
