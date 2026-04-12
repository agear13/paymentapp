'use client';

import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function WarningCard({ title, message }: { title: string; message: string }) {
  return (
    <Card className="gap-3 border-amber-500/40 bg-amber-500/5 py-4 shadow-none">
      <CardContent className="flex gap-3 px-4">
        <AlertTriangle className="text-amber-600 dark:text-amber-500 mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug">{title}</p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}
