'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { PaymentAccountRecommendationCard } from '@/components/xero/payment-account-recommendation-card';
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

  const primaryRecommendations = React.useMemo(
    () =>
      groups.primary.map((definition) =>
        resolvePaymentAccountRecommendation(
          accounts,
          definition,
          mappings[definition.mappingField]
        )
      ),
    [accounts, groups.primary, mappings]
  );

  const advancedRecommendations = React.useMemo(
    () =>
      groups.advancedPerAsset.map((definition) =>
        resolvePaymentAccountRecommendation(
          accounts,
          definition,
          mappings[definition.mappingField]
        )
      ),
    [accounts, groups.advancedPerAsset, mappings]
  );

  const linkableCount = [...primaryRecommendations, ...advancedRecommendations].filter(
    (item) =>
      item.recommendedAccount &&
      mappings[item.definition.mappingField]?.trim() !== item.recommendedAccount.code
  ).length;

  const renderCard = (definition: SettlementUiAccountDefinition) => {
    const recommendation = resolvePaymentAccountRecommendation(
      accounts,
      definition,
      mappings[definition.mappingField]
    );
    const state = fieldState(definition.mappingField);
    const showChooseDifferent =
      state === 'needs_review' ||
      recommendation.status === 'choose_account' ||
      recommendation.status === 'update_mapping' ||
      Boolean(mappings[definition.mappingField]);

    return (
      <PaymentAccountRecommendationCard
        key={definition.id}
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
    );
  };

  const showAdvanced =
    groups.advancedPerAsset.length > 0 &&
    (groups.cryptoStrategy === 'per_asset' ||
      groups.advancedPerAsset.some((definition) =>
        Boolean(readSettlementMappingCode(settings, definition.mappingField))
      ));

  return (
    <div className="space-y-4">
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

      <div className="space-y-4">{groups.primary.map((definition) => renderCard(definition))}</div>

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
            {groups.advancedPerAsset.map((definition) => renderCard(definition))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
