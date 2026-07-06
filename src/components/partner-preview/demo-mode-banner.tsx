'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Info } from 'lucide-react';

const STORAGE_KEY = 'partner-workspace-demo-banner-dismissed';

export function DemoModeBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(localStorage.getItem(STORAGE_KEY) === 'true');
  }, []);

  if (!mounted || dismissed) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 transition-all animate-in fade-in slide-in-from-top-2 duration-300">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="flex-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Preview Mode</span>
        {' — '}
        This workspace uses realistic sample businesses to demonstrate the Partner
        experience.
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, 'true');
          setDismissed(true);
        }}
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
