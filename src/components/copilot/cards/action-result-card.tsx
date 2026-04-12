'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function ActionResultCard({
  title,
  message,
  success,
}: {
  title: string;
  message: string;
  success: boolean;
}) {
  return (
    <Card
      className={
        success
          ? 'gap-3 border-emerald-500/30 bg-emerald-500/5 py-4 shadow-none'
          : 'gap-3 border-destructive/30 bg-destructive/5 py-4 shadow-none'
      }
    >
      <CardContent className="flex gap-3 px-4">
        {success ? (
          <CheckCircle2 className="text-emerald-600 dark:text-emerald-500 mt-0.5 size-5 shrink-0" aria-hidden />
        ) : (
          <XCircle className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug">{title}</p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}
