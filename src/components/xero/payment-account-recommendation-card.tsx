'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, AlertCircle, Sparkles, Check } from 'lucide-react';
import type { PaymentAccountRecommendation } from '@/lib/accounting/payment-account-recommendations';
import { recommendationBadgeLabel } from '@/lib/accounting/payment-account-recommendations';
import { PaymentFlowDiagram } from '@/components/xero/payment-flow-diagram';
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

function ConfidenceIndicators({
  indicators,
}: {
  indicators: PaymentAccountRecommendation['confidenceIndicators'];
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Recommendation confidence">
      {indicators.map((indicator) => (
        <li
          key={indicator.id}
          className={`flex items-center gap-1.5 text-xs ${
            indicator.active ? 'text-foreground' : 'text-muted-foreground/50'
          }`}
        >
          <Check
            className={`h-3.5 w-3.5 shrink-0 ${
              indicator.active ? 'text-emerald-600' : 'text-muted-foreground/40'
            }`}
            aria-hidden
          />
          <span>{indicator.label}</span>
        </li>
      ))}
    </ul>
  );
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
  const {
    definition,
    recommendedAccount,
    status,
    suggestedCode,
    actionableGuidance,
    reconciliationExplanation,
    flowSteps,
    confidenceIndicators,
  } = recommendation;
  const selectedCode = value?.trim() || recommendedAccount?.code || '';
  const isUsingRecommended =
    Boolean(recommendedAccount) && selectedCode === recommendedAccount?.code;

  return (
    <article className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_11rem]">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{definition.title}</h3>
            <Badge variant="outline" className={badgeTone(status)}>
              {recommendationBadgeLabel(status)}
            </Badge>
            {displayState === 'required' ? (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                {mappingStateBadgeLabel(displayState)}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{recommendation.whyProvvyRecommends}</p>
          <p className="text-sm text-foreground/90">{reconciliationExplanation}</p>
          <ConfidenceIndicators indicators={confidenceIndicators} />
        </header>

        <PaymentFlowDiagram steps={flowSteps} className="lg:mt-0" />
      </div>

      {recommendedAccount && status !== 'update_mapping' ? (
        <div
          className={`rounded-lg border p-4 ${
            isUsingRecommended
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-primary/30 bg-primary/5'
          }`}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              className={`mt-0.5 h-5 w-5 shrink-0 ${
                isUsingRecommended ? 'text-emerald-600' : 'text-primary'
              }`}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground">
                Provvy recommends: {recommendedAccount.code} · {recommendedAccount.name}
              </p>
              {recommendation.matchReason ? (
                <p className="text-xs text-muted-foreground">{recommendation.matchReason}</p>
              ) : null}
              {recommendation.alternativeCandidates.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li className="font-medium text-foreground/80">Other similar accounts:</li>
                  {recommendation.alternativeCandidates.map(({ account, reason }) => (
                    <li key={account.code}>
                      {account.code} · {account.name} — {reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          {!isUsingRecommended ? (
            <Button size="sm" className="mt-3" onClick={onUseRecommended}>
              <Sparkles className="mr-2 h-4 w-4" />
              Use recommended account
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">Create this account in Xero</p>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Name</dt>
                  <dd className="font-medium">{definition.accountName}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Type</dt>
                  <dd className="font-medium">{recommendation.displayAccountType}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Suggested code
                  </dt>
                  <dd className="font-medium">{suggestedCode}</dd>
                </div>
              </dl>
              <p className="text-muted-foreground">{actionableGuidance}</p>
            </div>
          </div>
        </div>
      )}

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

      {showChooseDifferent || !recommendedAccount || status === 'choose_account' ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Linked Xero account
          </p>
          <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder={XERO_ACCOUNT_SECTION_COPY.selectPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => {
                const isRecommended = account.code === recommendedAccount?.code;
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

      {displayState === 'needs_review' ? (
        <p className="text-sm text-amber-800 dark:text-amber-300">{actionableGuidance}</p>
      ) : null}
    </article>
  );
}
