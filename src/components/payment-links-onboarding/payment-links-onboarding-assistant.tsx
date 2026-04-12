'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CopilotOnboardingStatusResponse } from '@/lib/copilot/onboarding-status-types';
import type { MerchantSetupStep } from '@/lib/copilot/tools/get-merchant-setup-status';

function StepRow({ step }: { step: MerchantSetupStep }) {
  const icon =
    step.status === 'complete' ? (
      <CheckCircle2 className="text-emerald-600 dark:text-emerald-500 mt-0.5 size-4 shrink-0" aria-hidden />
    ) : step.status === 'attention' ? (
      <AlertTriangle className="text-amber-600 dark:text-amber-500 mt-0.5 size-4 shrink-0" aria-hidden />
    ) : (
      <Circle className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
    );

  return (
    <li className="flex gap-2 text-sm">
      {icon}
      <div className="min-w-0 flex-1">
        <p className={cn('leading-snug', step.status !== 'complete' && 'font-medium')}>{step.title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{step.description}</p>
        {step.actionLabel && step.actionIntent ? (
          <div className="mt-2">
            {step.actionIntent === 'open_merchant_settings' ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/dashboard/settings/merchant">{step.actionLabel}</Link>
              </Button>
            ) : step.actionIntent === 'scroll_create_invoice' ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/dashboard/payment-links#create-invoice">{step.actionLabel}</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function PaymentLinksOnboardingAssistant({ organizationId }: { organizationId: string }) {
  const [payload, setPayload] = React.useState<CopilotOnboardingStatusResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/copilot/onboarding-status?organizationId=${encodeURIComponent(organizationId)}`
        );
        const data = (await res.json()) as CopilotOnboardingStatusResponse;
        if (!cancelled && res.ok && data.ok) {
          setPayload(data);
        } else if (!cancelled) {
          setPayload(null);
        }
      } catch {
        if (!cancelled) setPayload(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (loading || !payload?.ok || !payload.result.showOnboardingAssistant) {
    return null;
  }

  const { result } = payload;
  const title =
    result.overallStatus === 'not_started'
      ? 'Get set up to get paid'
      : 'Almost there — finish setup';

  return (
    <Card className="border-sky-500/25 bg-gradient-to-r from-sky-500/5 to-transparent shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <span className="bg-sky-500/15 flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Sparkles className="text-sky-700 dark:text-sky-400 size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="text-foreground/90 mt-1 text-sm leading-relaxed">
              {result.summary}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {result.nextRecommendedAction ? (
          <div className="bg-muted/50 mb-4 rounded-lg border px-3 py-2.5">
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">Next step</p>
            <p className="mt-1 text-sm font-medium leading-snug">{result.nextRecommendedAction.title}</p>
            {result.nextRecommendedAction.description ? (
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {result.nextRecommendedAction.description}
              </p>
            ) : null}
            {result.nextRecommendedAction.actionLabel && result.nextRecommendedAction.actionIntent ? (
              <div className="mt-2">
                {result.nextRecommendedAction.actionIntent === 'open_merchant_settings' ? (
                  <Button type="button" size="sm" asChild>
                    <Link href="/dashboard/settings/merchant">{result.nextRecommendedAction.actionLabel}</Link>
                  </Button>
                ) : result.nextRecommendedAction.actionIntent === 'scroll_create_invoice' ? (
                  <Button type="button" size="sm" asChild>
                    <Link href="/dashboard/payment-links#create-invoice">{result.nextRecommendedAction.actionLabel}</Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">Checklist</p>
        <ul className="space-y-4">
          {result.steps.map((step) => (
            <StepRow key={step.code} step={step} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
