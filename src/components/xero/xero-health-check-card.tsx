'use client';

import { Loader2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { XeroHealthCheckItem } from '@/hooks/use-xero-guided-setup-state';

type XeroHealthCheckCardProps = {
  checks: XeroHealthCheckItem[];
  loading: boolean;
  onRefresh: () => void;
  variant?: 'default' | 'commercial';
};

export function XeroHealthCheckCard({
  checks,
  loading,
  onRefresh,
  variant = 'default',
}: XeroHealthCheckCardProps) {
  const isCommercial = variant === 'commercial';
  const allOk = checks.length > 0 && checks.every((c) => c.ok);

  return (
    <div
      className={
        isCommercial
          ? 'rounded-2xl border border-border bg-card p-5 shadow-card'
          : 'rounded-lg border bg-card p-5'
      }
      id="guided-xero-health-check"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Test My Xero Connection</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {allOk
              ? 'Your Xero connection looks healthy.'
              : 'Run a quick check to see what needs attention.'}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={loading}
          className={isCommercial ? 'rounded-xl' : undefined}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {loading ? 'Checking…' : 'Run check'}
        </Button>
      </div>

      {loading && checks.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Running connection checks…</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {checks.map((check) => (
            <li
              key={check.id}
              className="flex items-start gap-2.5 rounded-lg border border-border/60 px-3 py-2.5 text-sm"
            >
              {check.ok ? (
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              )}
              <div>
                <span className={check.ok ? 'font-medium' : 'font-medium text-amber-900'}>
                  {check.label}
                </span>
                {!check.ok && check.detail ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{check.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
