'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, ChevronRight } from 'lucide-react';
import {
  PaymentAccountRecommendationCard,
  PaymentAccountStepHeader,
  PaymentAccountStepSummary,
} from '@/components/xero/payment-account-recommendation-card';
import type { PaymentAccountChartAccount } from '@/lib/accounting/payment-account-recommendations';
import {
  buildPaymentAccountMappingView,
  countLinkableRecommendedAccounts,
} from '@/lib/accounting/payment-account-mapping-view';
import { getSettlementAccountsForUi, shouldShowCryptoSettlementStrategyUi } from '@/lib/accounting/settlement-account-ui';
import type { SettlementUiAccountDefinition } from '@/lib/accounting/settlement-account-ui';
import type { MappingDisplayState } from '@/lib/commercial-os/xero-invoice-readiness';
import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import { CRYPTO_SETTLEMENT_STRATEGY_COPY } from '@/lib/xero/xero-setup-guidance';
import type { MerchantPaymentCapabilities } from '@/lib/accounting/merchant-payment-capabilities';
import { resolveCryptoSettlementStrategy } from '@/lib/accounting/crypto-settlement-strategy';
import type { CryptoSettlementStrategy } from '@/lib/accounting/settlement-account-types';
import { toMerchantSettlementSettings } from '@/lib/accounting/settlement-settings-mapper';
import {
  buildPaymentTokenAccountingSummary,
  recommendsPerAssetCryptoStrategy,
} from '@/lib/accounting/payment-account-setup-copy';
import type { SettlementSettingsPayload } from '@/lib/accounting/settlement-settings-mapper';

type PaymentAccountsSetupSectionProps = {
  accounts: PaymentAccountChartAccount[];
  mappings: SettlementSettingsPayload;
  persistedMappings?: SettlementSettingsPayload;
  onMappingChange: (field: XeroMappingField, value: string) => void;
  onStrategyChange: (strategy: CryptoSettlementStrategy) => void;
  fieldState: (field: XeroMappingField) => MappingDisplayState;
  merchantRails: MerchantPaymentRails;
  merchantCapabilities: MerchantPaymentCapabilities;
  applyingRecommended?: boolean;
  onApplyAllRecommendations?: () => void;
  onRefreshAccounts?: () => void | Promise<void>;
  refreshingAccounts?: boolean;
};

function CryptoSettlementStrategySelector({
  strategy,
  onStrategyChange,
  showRecommendation,
}: {
  strategy: CryptoSettlementStrategy;
  onStrategyChange: (strategy: CryptoSettlementStrategy) => void;
  showRecommendation: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{CRYPTO_SETTLEMENT_STRATEGY_COPY.title}</h4>
        {showRecommendation ? (
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            {CRYPTO_SETTLEMENT_STRATEGY_COPY.recommendation}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['shared', 'per_asset'] as const).map((option) => {
          const copy = option === 'shared'
            ? CRYPTO_SETTLEMENT_STRATEGY_COPY.shared
            : CRYPTO_SETTLEMENT_STRATEGY_COPY.perAsset;
          const selected = strategy === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onStrategyChange(option)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                selected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border hover:bg-muted/30'
              }`}
            >
              <p className="text-sm font-medium text-foreground">{copy.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{copy.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PaymentAccountsSetupSection({
  accounts,
  mappings,
  persistedMappings,
  onMappingChange,
  onStrategyChange,
  merchantRails,
  merchantCapabilities,
  applyingRecommended = false,
  onApplyAllRecommendations,
  onRefreshAccounts,
  refreshingAccounts = false,
}: PaymentAccountsSetupSectionProps) {
  const settings = toMerchantSettlementSettings(mappings);
  const strategy = resolveCryptoSettlementStrategy(settings);
  const steps = React.useMemo(
    () => getSettlementAccountsForUi(settings, merchantRails, merchantCapabilities),
    [settings, merchantRails, merchantCapabilities]
  );

  const summary = React.useMemo(
    () => buildPaymentTokenAccountingSummary(mappings, merchantCapabilities, strategy),
    [mappings, merchantCapabilities, strategy]
  );

  const showCryptoStrategy = shouldShowCryptoSettlementStrategyUi(
    merchantRails,
    merchantCapabilities
  );

  const savedMappings = persistedMappings ?? mappings;

  const persistedViews = React.useMemo(
    () =>
      steps.map((definition) =>
        buildPaymentAccountMappingView(
          accounts,
          definition,
          savedMappings[definition.mappingField]
        )
      ),
    [accounts, steps, savedMappings]
  );

  const draftViews = React.useMemo(
    () =>
      steps.map((definition) =>
        buildPaymentAccountMappingView(accounts, definition, mappings[definition.mappingField])
      ),
    [accounts, steps, mappings]
  );

  const stepComplete = React.useCallback(
    (index: number) => persistedViews[index]?.complete === true,
    [persistedViews]
  );

  const firstIncompleteIndex = React.useMemo(
    () => steps.findIndex((_, index) => !stepComplete(index)),
    [steps, stepComplete]
  );

  const [activeStep, setActiveStep] = React.useState(() => Math.max(0, firstIncompleteIndex));
  const [reviewStep, setReviewStep] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (reviewStep !== null) return;
    const index = steps.findIndex((_, stepIndex) => !stepComplete(stepIndex));
    if (index >= 0) {
      setActiveStep(index);
    }
  }, [steps, stepComplete, reviewStep]);

  const expandedStep =
    reviewStep ?? (firstIncompleteIndex >= 0 ? activeStep : null);

  const linkableCount = countLinkableRecommendedAccounts(persistedViews);

  const goToNextStep = (fromIndex: number) => {
    setReviewStep(null);
    const next = steps.findIndex((_, index) => index > fromIndex && !stepComplete(index));
    if (next >= 0) {
      setActiveStep(next);
    } else {
      setActiveStep(Math.min(fromIndex + 1, steps.length - 1));
    }
  };

  const renderStepContent = (definition: SettlementUiAccountDefinition, index: number) => {
    const persistedView = persistedViews[index];
    const draftView = draftViews[index];
    if (!persistedView || !draftView) return null;
    const complete = persistedView.complete;

    return (
      <div className="space-y-4">
        <PaymentAccountStepHeader
          stepNumber={index + 1}
          title={definition.title}
          view={persistedView}
        />
        <PaymentAccountRecommendationCard
          view={persistedView}
          draftView={draftView}
          accounts={accounts}
          value={mappings[definition.mappingField] || ''}
          onChange={(value) => onMappingChange(definition.mappingField, value)}
          onUseRecommended={() => {
            const candidate = persistedView.candidateAccount ?? draftView.candidateAccount;
            if (candidate) {
              onMappingChange(definition.mappingField, candidate.code);
            }
          }}
          onRefreshAccounts={onRefreshAccounts}
          refreshingAccounts={refreshingAccounts}
        />
        {complete && index < steps.length - 1 ? (
          <Button size="sm" onClick={() => goToNextStep(index)} className="gap-1">
            Continue
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {summary ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          {summary}
        </div>
      ) : null}

      {showCryptoStrategy ? (
        <CryptoSettlementStrategySelector
          strategy={strategy}
          onStrategyChange={onStrategyChange}
          showRecommendation={recommendsPerAssetCryptoStrategy(merchantCapabilities)}
        />
      ) : null}

      {linkableCount > 0 && onApplyAllRecommendations ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onApplyAllRecommendations}
          disabled={applyingRecommended}
        >
          {applyingRecommended ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Linking accounts...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Link {linkableCount} recommended account{linkableCount === 1 ? '' : 's'}
            </>
          )}
        </Button>
      ) : null}

      <div className="space-y-2">
        {steps.map((definition, index) => {
          const complete = stepComplete(index);
          const isExpanded = expandedStep === index;

          if (!isExpanded) {
            return (
              <button
                key={definition.id}
                type="button"
                onClick={() => setReviewStep(index)}
                className="w-full rounded-lg border border-border/70 bg-card/40 px-4 py-3 text-left transition-colors hover:bg-muted/30"
              >
                <PaymentAccountStepSummary
                  stepNumber={index + 1}
                  title={definition.title}
                  complete={complete}
                />
              </button>
            );
          }

          return (
            <section
              key={definition.id}
              className="rounded-xl border border-border bg-card/50 p-4 shadow-sm"
            >
              {renderStepContent(definition, index)}
            </section>
          );
        })}
      </div>
    </div>
  );
}
