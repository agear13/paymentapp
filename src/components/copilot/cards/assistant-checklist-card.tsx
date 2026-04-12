'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import type { ChecklistItem } from '@/lib/copilot/copilot-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AssistantChecklistCard({
  title,
  items,
}: {
  title: string;
  items: ChecklistItem[];
}) {
  return (
    <Card className="gap-3 border-border/80 bg-muted/40 py-4 shadow-none">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pt-0">
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex gap-2 rounded-md border border-border/60 bg-background/80 px-2.5 py-2 text-sm"
            >
              {item.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-500" aria-hidden />
              ) : (
                <Circle className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className={item.done ? 'text-muted-foreground line-through' : 'font-medium'}>
                  {item.label}
                </span>
                {item.hint ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.hint}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
