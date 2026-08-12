import { Check, CheckCircle2, FileText } from 'lucide-react';
import { LABS_REPORT_SECTIONS } from '@/lib/labs/labs-constants';

export function LabsCampaignReport() {
  return (
    <section id="campaign-report" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-accent-foreground">
              <FileText className="h-3.5 w-3.5" /> Deliverable
            </div>
            <h2 className="mt-6 text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-[42px]">
              The <span className="text-gradient">Campaign Report</span>
            </h2>
            <p className="mt-5 max-w-md text-[15.5px] text-ink-soft">
              Every completed campaign produces a structured report delivered to your Provvy Labs
              workspace and email.
            </p>
            <ul className="mt-8 grid gap-2 sm:grid-cols-2">
              {LABS_REPORT_SECTIONS.map((s) => (
                <li key={s.label} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <div>
                    <div className="text-[13.5px] font-medium">{s.label}</div>
                    <div className="text-[12px] text-ink-soft">{s.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card p-2 shadow-card">
            <div className="rounded-[1.25rem] bg-background p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-ink-soft">
                    Campaign Report
                  </div>
                  <div className="mt-1 text-[16px] font-semibold tracking-tight">
                    Q3 Demand Generation
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Completed
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { k: 'Credits used', v: '1' },
                  { k: 'Assets', v: '14' },
                  { k: 'Channels', v: '4' },
                ].map((m) => (
                  <div key={m.k} className="rounded-xl border border-border/60 bg-card p-3">
                    <div className="text-[10.5px] uppercase tracking-wider text-ink-soft">
                      {m.k}
                    </div>
                    <div className="mt-1 text-[18px] font-semibold tabular-nums">{m.v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {LABS_REPORT_SECTIONS.map((s, i) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] tabular-nums text-ink-soft">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[13px] font-medium">{s.label}</span>
                    </div>
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-primary/25 bg-accent/30 p-3.5 text-[12.5px] text-foreground/90">
                <span className="font-medium">Reviewed by a human</span> before delivery. Nothing is
                published without your approval.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
