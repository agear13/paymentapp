'use client';

import type { SettlementScheduleGroup } from '@/lib/ai-extractor/settlement-schedule';

interface SettlementSchedulePanelProps {
  groups: SettlementScheduleGroup[];
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
          <div key={group.partyId} className="rounded-md border bg-background px-3 py-3 space-y-2">
            <p className="text-sm font-medium">{group.partyName}</p>
            <ul className="space-y-1.5">
              {group.lines.map((line, index) => (
                <li key={`${group.partyId}-${index}`} className="text-xs text-foreground/85">
                  <span className="font-medium">{line.label}:</span> {line.value}
                  {line.status ? (
                    <span className="ml-2 text-muted-foreground capitalize">({line.status})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
