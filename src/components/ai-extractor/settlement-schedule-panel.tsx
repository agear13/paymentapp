'use client';

import { PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT } from '@/lib/ai-extractor/party-linked-settlement';
import type { ExtractionReviewSettlementGroup } from '@/lib/journey/workflow-extraction-display.client';

interface SettlementSchedulePanelProps {
  groups: ExtractionReviewSettlementGroup[];
}

function ScheduleRows({ group }: { group: ExtractionReviewSettlementGroup }) {
  if (!group.rows || group.rows.length === 0) return null;
  return (
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
  );
}

function ParticipantGroupBody({ group }: { group: ExtractionReviewSettlementGroup }) {
  if (group.kind === 'revenue_share' && group.revenueShare) {
    return (
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
        ) : (
          <p className="text-xs italic text-muted-foreground">
            {group.timingNote ?? PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT}
          </p>
        )}
        {group.revenueShare.settlement ? (
          <div>
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">
              Settlement
            </span>
            <p className="mt-0.5">{group.revenueShare.settlement}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {group.entitlementLabel ? (
        <p className="text-sm font-medium text-foreground">{group.entitlementLabel}</p>
      ) : null}
      {group.kind === 'payment_schedule' ? <ScheduleRows group={group} /> : null}
      {group.kind === 'unresolved_timing' || group.timingNote ? (
        <p className="text-xs italic text-muted-foreground">
          {group.timingNote ?? PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT}
        </p>
      ) : null}
    </div>
  );
}

export function SettlementSchedulePanel({ groups }: SettlementSchedulePanelProps) {
  if (groups.length === 0) return null;

  const projectGroups = groups.filter((group) => group.kind === 'project_cashflow');
  const participantGroups = groups.filter((group) => group.kind !== 'project_cashflow');

  return (
    <div className="space-y-5">
      {projectGroups.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Project Cashflow / Client Payment Schedule
          </p>
          <div className="space-y-3">
            {projectGroups.map((group) => (
              <div key={group.key} className="rounded-md border bg-background px-3 py-3 space-y-2.5">
                <p className="text-sm font-medium">{group.partyName}</p>
                <ScheduleRows group={group} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {participantGroups.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Participant Settlement
          </p>
          <div className="space-y-3">
            {participantGroups.map((group) => (
              <div key={group.key} className="rounded-md border bg-background px-3 py-3 space-y-2.5">
                <p className="text-sm font-medium">{group.partyName}</p>
                <ParticipantGroupBody group={group} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
