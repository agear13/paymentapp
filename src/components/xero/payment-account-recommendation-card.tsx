'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Check, ChevronRight } from 'lucide-react';
import type { PaymentAccountRecommendation } from '@/lib/accounting/payment-account-recommendations';
import { recommendationBadgeLabel } from '@/lib/accounting/payment-account-recommendations';
import { PaymentFlowDiagram } from '@/components/xero/payment-flow-diagram';
import {
  friendlyMatchSubtitle,
  heroRecommendationAccount,
  isGenericFallbackAccountName,
} from '@/components/xero/payment-account-recommendation-display';
import {
  XERO_ACCOUNT_SECTION_COPY,
  XERO_CREATE_ACCOUNT_IN_XERO_GUIDE,
} from '@/lib/xero/xero-setup-guidance';
import type { MappingDisplayState } from '@/lib/commercial-os/xero-invoice-readiness';
import { mappingStateBadgeLabel } from '@/lib/commercial-os/xero-invoice-readiness';

type ChartAccount = {
  accountID?: string;
  code: string;
  name: string;
  type: string;
};

type PaymentAccountRecommendationCardProps = {
  recommendation: PaymentAccountRecommendation;
  accounts: ChartAccount[];
  value: string;
  onChange: (value: string) => void;
  onUseRecommended: () => void;
  displayState: MappingDisplayState;
  showChooseDifferent?: boolean;
};

function badgeTone(status: PaymentAccountRecommendation['status']) {
  switch (status) {
    case 'found':
      return 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400';
    case 'create_in_xero':
    case 'update_mapping':
      return 'border-amber-500/50 text-amber-800 dark:text-amber-300';
    default:
      return 'border-primary/40 text-primary';
  }
}

export function PaymentAccountRecommendationCard({
  recommendation,
  accounts,
  value,
  onChange,
  onUseRecommended,
  displayState,
  showChooseDifferent = false,
}: PaymentAccountRecommendationCardProps) {
  const { definition, status, suggestedCode, reconciliationExplanation, flowSteps } =
    recommendation;
  const heroAccount = heroRecommendationAccount(recommendation);
  const genericFallback = recommendation.recommendedAccount
    ? isGenericFallbackAccountName(recommendation.recommendedAccount.name)
    : false;
  const selectedCode = value?.trim() || heroAccount?.code || '';
  const isUsingRecommended = Boolean(heroAccount) && selectedCode === heroAccount.code;
  const [showAccountPicker, setShowAccountPicker] = React.useState(
    showChooseDifferent || status === 'choose_account' || !heroAccount
  );

  React.useEffect(() => {
    if (showChooseDifferent || status === 'choose_account' || !heroAccount) {
      setShowAccountPicker(true);
    }
  }, [showChooseDifferent, status, heroAccount]);

  const currentAssetAccounts = accounts.filter(
    (account) => account.type.trim().toUpperCase() === 'CURRENT'
  );
  const pickerAccounts = currentAssetAccounts.length > 0 ? currentAssetAccounts : accounts;

  return (
    <div className="space-y-4">
      {definition.kind === 'shared_digital' ? (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4 shrink-0" aria-hidden />
          Recommended for most businesses
        </p>
      ) : null}

      {heroAccount ? (
        <div
          className={`rounded-xl border-2 p-5 ${
            isUsingRecommended
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-primary/40 bg-primary/5'
          }`}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              className={`mt-0.5 h-6 w-6 shrink-0 ${
                isUsingRecommended ? 'text-emerald-600' : 'text-primary'
              }`}
            />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-base font-semibold text-foreground">
                  Provvy found a suitable account
                </p>
                <p className="mt-1 text-lg font-medium text-foreground">
                  {heroAccount.code} · {heroAccount.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {friendlyMatchSubtitle(recommendation)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!isUsingRecommended ? (
                  <Button size="sm" onClick={onUseRecommended}>
                    Use this account
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <Check className="h-4 w-4" aria-hidden />
                    Linked
                  </span>
                )}
                {!showAccountPicker ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAccountPicker(true)}
                  >
                    Choose another
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <p className="text-base font-semibold text-foreground">
              {genericFallback
                ? "We couldn't find the recommended account"
                : `Create ${definition.accountName} in Xero`}
            </p>
            {genericFallback ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Provvy did not find a close match in your chart. Create the recommended account or
                link an existing Current Asset account below.
              </p>
            ) : null}
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{definition.accountName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Account type</dt>
              <dd className="font-medium">{recommendation.displayAccountType}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Suggested code</dt>
              <dd className="font-medium">
                {suggestedCode} <span className="text-muted-foreground">(optional)</span>
              </dd>
            </div>
          </dl>

          <details className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-foreground">
              Why this account?
            </summary>
            <p className="mt-2 text-muted-foreground">{reconciliationExplanation}</p>
          </details>

          <details className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-foreground">
              {XERO_CREATE_ACCOUNT_IN_XERO_GUIDE.title}
            </summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
              {XERO_CREATE_ACCOUNT_IN_XERO_GUIDE.steps.map((step) => (
                <li key={step}>{step.replace('{code}', suggestedCode)}</li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              {XERO_CREATE_ACCOUNT_IN_XERO_GUIDE.afterCreate}
            </p>
          </details>

          {genericFallback ? (
            <details className="rounded-lg border border-dashed border-border/70 px-4 py-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Advanced accountant note
              </summary>
              <p className="mt-2 text-muted-foreground">
                Some charts use a generic Suspense or Clearing account for multiple payment types.
                Provvy does not recommend that for new setups — dedicated holding accounts make
                automatic reconciliation reliable.
              </p>
            </details>
          ) : null}
        </div>
      )}

      {showAccountPicker || !heroAccount ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            {heroAccount ? 'Choose another account' : 'Choose an existing Current Asset account'}
          </p>
          <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder={XERO_ACCOUNT_SECTION_COPY.selectPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {pickerAccounts.map((account) => {
                const isRecommended = account.code === heroAccount?.code;
                return (
                  <SelectItem key={account.code} value={account.code}>
                    {account.code} · {account.name}
                    {isRecommended ? ' (Recommended)' : ''}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Show how reconciliation works
        </summary>
        <PaymentFlowDiagram steps={flowSteps} className="mt-3" />
      </details>

      {displayState === 'needs_review' ? (
        <p className="text-sm text-amber-800 dark:text-amber-300">
          {recommendation.actionableGuidance}
        </p>
      ) : null}
    </div>
  );
}

export function PaymentAccountStepSummary({
  stepNumber,
  title,
  complete,
  badge,
}: {
  stepNumber: number;
  title: string;
  complete: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
          complete
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {complete ? <Check className="h-4 w-4" aria-hidden /> : stepNumber}
      </span>
      <span className={`text-sm font-medium ${complete ? 'text-muted-foreground' : 'text-foreground'}`}>
        {title}
      </span>
      {complete ? (
        <span className="text-xs text-emerald-700 dark:text-emerald-400">Done</span>
      ) : null}
      {badge}
    </div>
  );
}

export function PaymentAccountStepHeader({
  stepNumber,
  title,
  status,
  displayState,
}: {
  stepNumber: number;
  title: string;
  status: PaymentAccountRecommendation['status'];
  displayState: MappingDisplayState;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Step {stepNumber}
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <Badge variant="outline" className={badgeTone(status)}>
        {recommendationBadgeLabel(status)}
      </Badge>
      {displayState === 'required' ? (
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          {mappingStateBadgeLabel(displayState)}
        </Badge>
      ) : null}
    </div>
  );
}
