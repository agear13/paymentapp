'use client';

import type { ExtractionReviewSettlementGroup } from '@/lib/journey/workflow-extraction-display.client';

interface SettlementSchedulePanelProps {
  groups: ExtractionReviewSettlementGroup[];
}

export function SettlementSchedulePanel({ groups }: SettlementSchedulePanelProps) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Settlement Schedule
      </p>
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.key} className="rounded-md border bg-background px-3 py-3 space-y-2.5">
            <p className="text-sm font-medium">{group.partyName}</p>

            {group.kind === 'revenue_share' && group.revenueShare ? (
              <div className="space-y-2 text-xs text-foreground/85">
                <div>
                  <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                    Revenue Share
                  </span>
                  <p className="mt-0.5 text-sm font-medium text-foreground">
                    {group.revenueShare.headline}
                  </p>
                </div>
                {group.revenueShare.trigger ? (
                  <div>
                    <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                      Trigger
                    </span>
                    <p className="mt-0.5">{group.revenueShare.trigger}</p>
                  </div>
                ) : null}
                {group.revenueShare.settlement ? (
                  <div>
                    <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                      Settlement
                    </span>
                    <p className="mt-0.5">{group.revenueShare.settlement}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {group.kind === 'payment_schedule' && group.rows && group.rows.length > 0 ? (
              <ul className="space-y-2">
                {group.rows.map((row) => (
                  <li
                    key={row.key}
                    className="rounded-md border border-border/60 bg-muted/20 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{row.title}</span>
                      {row.amountLabel ? (
                        <span className="text-sm font-semibold text-foreground">{row.amountLabel}</span>
                      ) : null}
                    </div>
                    {row.trigger ? (
                      <p className="mt-1 text-xs text-muted-foreground">{row.trigger}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
