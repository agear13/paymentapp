'use client';

import { AlertCircle, Info } from 'lucide-react';
import type { DiagnosticItem } from '@/lib/copilot/copilot-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function SeverityIcon({ severity }: { severity: NonNullable<DiagnosticItem['severity']> }) {
  switch (severity) {
    case 'critical':
      return <AlertCircle className="size-4 text-destructive" aria-hidden />;
    case 'warning':
      return <AlertCircle className="size-4 text-amber-600 dark:text-amber-500" aria-hidden />;
    case 'info':
    default:
      return <Info className="size-4 text-muted-foreground" aria-hidden />;
  }
}

export function AssistantDiagnosticCard({
  title,
  summary,
  items,
}: {
  title: string;
  summary?: string;
  items: DiagnosticItem[];
}) {
  return (
    <Card className="gap-3 border-border/80 bg-muted/40 py-4 shadow-none">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
        {summary ? (
          <p className="text-muted-foreground text-xs leading-relaxed">{summary}</p>
        ) : null}
      </CardHeader>
      <CardContent className="px-4 pt-0">
        <ul className="space-y-2">
          {items.map((item) => {
            const severity = item.severity ?? 'info';
            return (
              <li
                key={item.id}
                className="flex gap-2 rounded-md border border-border/60 bg-background/80 px-2.5 py-2 text-sm"
              >
                <span className="mt-0.5 shrink-0">
                  <SeverityIcon severity={severity} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium leading-snug">{item.label}</span>
                  {item.detail ? (
                    <span className={cn('mt-0.5 block text-xs text-muted-foreground')}>{item.detail}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
