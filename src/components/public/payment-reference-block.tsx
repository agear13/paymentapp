'use client';

import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type PaymentReferenceBlockProps = {
  reference: string;
  label?: string;
  description?: string;
};

export function PaymentReferenceBlock({
  reference,
  label = 'Payment reference / memo to include',
  description = 'Include this reference with your transfer so we can reconcile your payment.',
}: PaymentReferenceBlockProps) {
  const { toast } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      toast({ title: 'Copied', description: 'Payment reference copied to clipboard.' });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Select and copy the reference manually.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4 space-y-2">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-sm bg-white border rounded-md px-3 py-2 break-all flex-1 min-w-0">
          {reference}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={copy} className="shrink-0">
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          Copy reference
        </Button>
      </div>
    </div>
  );
}
