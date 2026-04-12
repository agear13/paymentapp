'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export function ActionConfirmCard({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Card className="gap-0 border-amber-500/35 bg-amber-500/5 py-0 shadow-none">
      <CardHeader className="flex flex-row items-start gap-2 space-y-0 px-4 pt-4">
        <AlertTriangle className="text-amber-600 dark:text-amber-500 mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-semibold">Proposed action</CardTitle>
          <p className="text-foreground mt-1 text-sm font-medium leading-snug">{title}</p>
          {description ? (
            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">{description}</p>
          ) : null}
        </div>
      </CardHeader>
      <CardFooter className="flex justify-end gap-2 border-t px-4 py-3">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="button" size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
