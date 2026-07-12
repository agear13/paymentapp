'use client';

import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type Props = {
  explanation: string | null;
};

export function CommercialIntelligence({ explanation }: Props) {
  if (!explanation?.trim()) return null;

  return (
    <Card className="border-violet-200/80 bg-violet-50/40">
      <CardContent className="pt-4">
        <div className="flex gap-3">
          <Sparkles className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-violet-700 mb-1">
              Commercial Intelligence
            </p>
            <p className="text-sm text-violet-950 leading-relaxed">{explanation}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
