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
import { CheckCircle2, Check } from 'lucide-react';
import type { PaymentAccountMappingView } from '@/lib/accounting/payment-account-mapping-view';
import { paymentAccountLinkLabel } from '@/lib/accounting/payment-account-mapping-view';
import { friendlyMatchSubtitle } from '@/components/xero/payment-account-recommendation-display';
import { PaymentFlowDiagram } from '@/components/xero/payment-flow-diagram';
import {
  XERO_ACCOUNT_SECTION_COPY,
  resolveCreateAccountInXeroGuide,
} from '@/lib/xero/xero-setup-guidance';
import { CreateAccountInXeroGuidePanel } from '@/components/xero/create-account-in-xero-guide-panel';

type ChartAccount = {
  accountID?: string;
  code: string;
  name: string;
  type: string;
};

type PaymentAccountRecommendationCardProps = {
  view: PaymentAccountMappingView;
  draftView: PaymentAccountMappingView;
  accounts: ChartAccount[];
  value: string;
  onChange: (value: string) => void;
  onUseRecommended: () => void;
  onRefreshAccounts?: () => void | Promise<void>;
  refreshingAccounts?: boolean;
};

function badgeTone(state: PaymentAccountMappingView['state']) {
  switch (state) {
    case 'linked':
    case 'recommended_found':
      return 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400';
    case 'needs_create':
    case 'stale_mapping':
      return 'border-amber-500/50 text-amber-800 dark:text-amber-300';
    default:
      return 'border-primary/40 text-primary';
  }
}

function pickerLabel(account: ChartAccount, view: PaymentAccountMappingView, value: string): string {
  const code = account.code.trim();
  const persisted = (view.persistedAccount?.code ?? view.persistedCode ?? '').trim();
  const candidate = (view.candidateAccount?.code ?? '').trim();
  const selected = value.trim();

  if (view.state === 'linked' && code === persisted) {
    return `${account.code} · ${account.name} (Currently linked)`;
  }
  if (code === selected && selected && code !== persisted) {
    return `${account.code} · ${account.name} (Selected)`;
  }
  if (candidate && code === candidate && view.state !== 'linked') {
    return `${account.code} · ${account.name} (Recommended)`;
  }
  return `${account.code} · ${account.name}`;
}

export function PaymentAccountRecommendationCard({
  view,
  value,
  onChange,
  onUseRecommended,
  onRefreshAccounts,
  refreshingAccounts = false,
}: PaymentAccountRecommendationCardProps) {
  const { recommendation } = view;
  const definition = recommendation.definition;
  const { suggestedCode, reconciliationExplanation, flowSteps } = recommendation;
  const createAccountGuide = resolveCreateAccountInXeroGuide({
    paymentRail: definition.paymentRail,
    accountName: definition.accountName,
  });
  const heroAccount = view.heroAccount;
  const linkLabel = paymentAccountLinkLabel({
    persistedState: view.state,
    persistedCode: view.persistedCode,
    draftCode: value,
  });
  const [showAccountPicker, setShowAccountPicker] = React.useState(view.pickerDefaultOpen);

  React.useEffect(() => {
    setShowAccountPicker(view.pickerDefaultOpen);
  }, [view.pickerDefaultOpen, view.state, view.persistedCode]);

  const pickerAccounts = view.preferredTypeAccounts;
  const canChooseAnother = view.otherPickerAccounts.length > 0;
  const showPicker =
    showAccountPicker &&
    (heroAccount ? canChooseAnother : view.hasSuitableExistingAccounts);

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
            view.showLinkedLabel
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-primary/40 bg-primary/5'
          }`}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              className={`mt-0.5 h-6 w-6 shrink-0 ${
                view.showLinkedLabel ? 'text-emerald-600' : 'text-primary'
              }`}
            />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-base font-semibold text-foreground">
                  {view.state === 'linked'
                    ? 'Linked Xero account'
                    : view.state === 'stale_mapping'
                      ? 'Recommended replacement in Xero'
                      : 'Provvy found a suitable account'}
                </p>
                <p className="mt-1 text-lg font-medium text-foreground">
                  {heroAccount.code} · {heroAccount.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {friendlyMatchSubtitle(recommendation)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {linkLabel === 'linked' ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <Check className="h-4 w-4" aria-hidden />
                    Linked
                  </span>
                ) : linkLabel === 'selected' ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    Selected — save your choices to link
                  </span>
                ) : (
                  <Button size="sm" onClick={onUseRecommended}>
                    {view.state === 'stale_mapping' ? 'Use this replacement' : 'Use this account'}
                  </Button>
                )}
                {canChooseAnother && !showAccountPicker ? (
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
              {view.state === 'stale_mapping'
                ? 'Your saved Xero account is missing'
                : 'Recommended account is not in Xero'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {view.createIsRequired
                ? `Provvy can create "${definition.accountName}" in Xero, then you can link it here.`
                : `Provvy did not find "${definition.accountName}" in your chart. You can create it in Xero, or link another Current Asset or Bank account.`}
            </p>
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

          <CreateAccountInXeroGuidePanel
            guide={createAccountGuide}
            suggestedCode={suggestedCode}
            onRefreshAccounts={onRefreshAccounts}
            refreshingAccounts={refreshingAccounts}
          />
        </div>
      )}

      {showPicker ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            {heroAccount
              ? 'Choose another account'
              : view.createIsRequired
                ? 'If an account already exists, choose it here'
                : 'Or link an existing Current Asset or Bank account'}
          </p>
          <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder={XERO_ACCOUNT_SECTION_COPY.selectPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {pickerAccounts.map((account) => (
                <SelectItem key={account.code} value={account.code}>
                  {pickerLabel(account, view, value)}
                </SelectItem>
              ))}
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

      {view.showStaleWarning ? (
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
    </div>
  );
}

export function PaymentAccountStepHeader({
  stepNumber,
  title,
  view,
}: {
  stepNumber: number;
  title: string;
  view: PaymentAccountMappingView;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Step {stepNumber}
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <Badge variant="outline" className={badgeTone(view.state)}>
        {view.badgeLabel}
      </Badge>
    </div>
  );
}
