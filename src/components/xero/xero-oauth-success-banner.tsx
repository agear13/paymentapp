'use client';

import Link from 'next/link';
import { ArrowRight, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { XERO_OAUTH_SUCCESS } from '@/lib/xero/xero-setup-guidance';

type XeroOAuthSuccessBannerProps = {
  continueHref?: string;
  onContinue?: () => void;
  onDismiss?: () => void;
  variant?: 'default' | 'commercial';
};

export function XeroOAuthSuccessBanner({
  continueHref,
  onContinue,
  onDismiss,
  variant = 'default',
}: XeroOAuthSuccessBannerProps) {
  const isCommercial = variant === 'commercial';

  return (
    <div
      className={
        isCommercial
          ? 'rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 shadow-card'
          : 'rounded-lg border border-emerald-200 bg-emerald-50/80 p-5'
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={
            isCommercial
              ? 'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-xl'
              : 'mt-0.5 text-emerald-600'
          }
        >
          {isCommercial ? '🎉' : <PartyPopper className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h2
            className={
              isCommercial
                ? 'text-lg font-semibold tracking-tight text-foreground'
                : 'text-base font-semibold text-emerald-900'
            }
          >
            {XERO_OAUTH_SUCCESS.title}
          </h2>
          <p className={isCommercial ? 'text-[14px] text-ink-soft' : 'text-sm text-emerald-900/90'}>
            {XERO_OAUTH_SUCCESS.body}
          </p>
          <p className={isCommercial ? 'text-[14px] text-foreground' : 'text-sm text-emerald-900/90'}>
            {XERO_OAUTH_SUCCESS.nextStep}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {onContinue ? (
              <Button
                size="sm"
                onClick={onContinue}
                className={isCommercial ? 'rounded-xl' : undefined}
              >
                {XERO_OAUTH_SUCCESS.continueLabel}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            ) : continueHref ? (
              <Button size="sm" asChild className={isCommercial ? 'rounded-xl' : undefined}>
                <Link href={continueHref}>
                  {XERO_OAUTH_SUCCESS.continueLabel}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
            {onDismiss ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className={isCommercial ? 'text-ink-soft' : 'text-emerald-800'}
              >
                Dismiss
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
