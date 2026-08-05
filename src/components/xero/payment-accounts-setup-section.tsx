'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, ChevronRight } from 'lucide-react';
import {
  PaymentAccountRecommendationCard,
  PaymentAccountStepHeader,
  PaymentAccountStepSummary,
} from '@/components/xero/payment-account-recommendation-card';
import {
  buildPaymentAccountUiGroups,
  resolvePaymentAccountRecommendation,
  type PaymentAccountChartAccount,
} from '@/lib/accounting/payment-account-recommendations';
import type { SettlementUiAccountDefinition } from '@/lib/accounting/settlement-account-ui';
import type { MappingDisplayState } from '@/lib/commercial-os/xero-invoice-readiness';
import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import { XERO_ACCOUNTANT_MODE_SECTION } from '@/lib/xero/xero-setup-guidance';
import { readSettlementMappingCode } from '@/lib/accounting/settlement-account-types';
import type { MerchantSettlementSettings } from '@/lib/accounting/settlement-account-types';

type PaymentAccountsSetupSectionProps = {
  accounts: PaymentAccountChartAccount[];
  mappings: Partial<Record<XeroMappingField, string>>;
  onMappingChange: (field: XeroMappingField, value: string) => void;
  fieldState: (field: XeroMappingField) => MappingDisplayState;
  merchantRails: MerchantPaymentRails;
  applyingRecommended?: boolean;
  onApplyAllRecommendations?: () => void;
};

function isStepComplete(state: MappingDisplayState): boolean {
  return state === 'configured';
}

export function PaymentAccountsSetupSection({
  accounts,
  mappings,
  onMappingChange,
  fieldState,
  merchantRails,
  applyingRecommended = false,
  onApplyAllRecommendations,
}: PaymentAccountsSetupSectionProps) {
  const settings = mappings as MerchantSettlementSettings;
  const groups = React.useMemo(
    () => buildPaymentAccountUiGroups(settings, merchantRails),
    [settings, merchantRails]
  );

  const steps = groups.primary;

  const stepComplete = React.useCallback(
    (definition: SettlementUiAccountDefinition) =>
      isStepComplete(fieldState(definition.mappingField)),
    [fieldState]
  );

  const firstIncompleteIndex = React.useMemo(
    () => steps.findIndex((definition) => !stepComplete(definition)),
    [steps, stepComplete]
  );

  const [activeStep, setActiveStep] = React.useState(() =>
    Math.max(0, steps.findIndex((definition) => !stepComplete(definition)))
  );
  const [reviewStep, setReviewStep] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (reviewStep !== null) return;
    const index = steps.findIndex((definition) => !stepComplete(definition));
    if (index >= 0) {
      setActiveStep(index);
    }
  }, [steps, stepComplete, reviewStep]);

  const expandedStep =
    reviewStep ?? (firstIncompleteIndex >= 0 ? activeStep : null);

  const primaryRecommendations = React.useMemo(
    () =>
      steps.map((definition) =>
        resolvePaymentAccountRecommendation(
          accounts,
          definition,
          mappings[definition.mappingField]
        )
      ),
    [accounts, steps, mappings]
  );

  const linkableCount = primaryRecommendations.filter(
    (item) =>
      item.recommendedAccount &&
      mappings[item.definition.mappingField]?.trim() !== item.recommendedAccount.code
  ).length;

  const showAdvanced =
    groups.advancedPerAsset.length > 0 &&
    (groups.cryptoStrategy === 'per_asset' ||
      groups.advancedPerAsset.some((definition) =>
        Boolean(readSettlementMappingCode(settings, definition.mappingField))
      ));

  const goToNextStep = (fromIndex: number) => {
    setReviewStep(null);
    const next = steps.findIndex((definition, index) => index > fromIndex && !stepComplete(definition));
    if (next >= 0) {
      setActiveStep(next);
    } else {
      setActiveStep(Math.min(fromIndex + 1, steps.length - 1));
    }
  };

  const renderStepContent = (definition: SettlementUiAccountDefinition, index: number) => {
    const recommendation = resolvePaymentAccountRecommendation(
      accounts,
      definition,
      mappings[definition.mappingField]
    );
    const state = fieldState(definition.mappingField);
    const complete = stepComplete(definition);
    const showChooseDifferent =
      state === 'needs_review' ||
      recommendation.status === 'choose_account' ||
      recommendation.status === 'update_mapping' ||
      Boolean(mappings[definition.mappingField]);

    return (
      <div className="space-y-4">
        <PaymentAccountStepHeader
          stepNumber={index + 1}
          title={definition.title}
          status={recommendation.status}
          displayState={state}
        />
        <PaymentAccountRecommendationCard
          recommendation={recommendation}
          accounts={accounts}
          value={mappings[definition.mappingField] || ''}
          onChange={(value) => onMappingChange(definition.mappingField, value)}
          onUseRecommended={() => {
            if (recommendation.recommendedAccount) {
              onMappingChange(definition.mappingField, recommendation.recommendedAccount.code);
            }
          }}
          displayState={state}
          showChooseDifferent={showChooseDifferent}
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
          const complete = stepComplete(definition);
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

      {groups.advancedPerAsset.length > 0 ? (
        <details className="rounded-lg border border-border bg-card/40">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            {XERO_ACCOUNTANT_MODE_SECTION.summary}
            {showAdvanced ? ' — in use' : ''}
          </summary>
          <div className="space-y-4 border-t px-4 pb-4 pt-4">
            <p className="text-sm text-muted-foreground">{XERO_ACCOUNTANT_MODE_SECTION.intro}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {XERO_ACCOUNTANT_MODE_SECTION.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Per-asset accounts (HBAR, USDC, USDT, AUDD) appear here — most businesses use a single
              Digital Asset Holding account above.
            </p>
            <div className="space-y-4">
              {groups.advancedPerAsset.map((definition, index) => {
                const recommendation = resolvePaymentAccountRecommendation(
                  accounts,
                  definition,
                  mappings[definition.mappingField]
                );
                const state = fieldState(definition.mappingField);
                return (
                  <div key={definition.id} className="rounded-lg border border-border/60 p-4">
                    <PaymentAccountStepHeader
                      stepNumber={index + 1}
                      title={definition.title}
                      status={recommendation.status}
                      displayState={state}
                    />
                    <div className="mt-3">
                      <PaymentAccountRecommendationCard
                        recommendation={recommendation}
                        accounts={accounts}
                        value={mappings[definition.mappingField] || ''}
                        onChange={(value) => onMappingChange(definition.mappingField, value)}
                        onUseRecommended={() => {
                          if (recommendation.recommendedAccount) {
                            onMappingChange(definition.mappingField, recommendation.recommendedAccount.code);
                          }
                        }}
                        displayState={state}
                        showChooseDifferent
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
