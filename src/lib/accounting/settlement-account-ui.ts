/**
 * UI/runtime settlement account definitions — driven by strategy, not hardcoded assets.
 */

import { LEGACY_CRYPTO_ASSET_SLOTS, SHARED_DIGITAL_HOLDING, STRIPE_HOLDING, WISE_HOLDING } from '@/lib/accounting/settlement-account-config';
import { resolveCryptoSettlementStrategy } from '@/lib/accounting/crypto-settlement-strategy';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import type { MerchantSettlementSettings, SettlementClearingMappingField } from '@/lib/accounting/settlement-account-types';
import { readSettlementMappingCode } from '@/lib/accounting/settlement-account-types';
import { resolveSettlementAccount } from '@/lib/accounting/settlement-account-resolver';

export type SettlementUiAccountKind = 'rail' | 'shared_digital' | 'per_asset';

export type SettlementUiAccountDefinition = {
  id: string;
  kind: SettlementUiAccountKind;
  title: string;
  accountName: string;
  mappingField: SettlementClearingMappingField;
  suggestedCode: string;
  paymentAsset?: string | null;
  paymentRail?: string;
  helperText?: string;
};

const CLEARING_HELPER =
  'Provvy records the payment against this holding account when the customer pays. Clearing to your bank is handled in your normal Xero workflow — not posted automatically by Provvy.';

function perAssetDefinitions(): SettlementUiAccountDefinition[] {
  return LEGACY_CRYPTO_ASSET_SLOTS.map((slot) => ({
    id: `per-asset-${slot.asset.toLowerCase()}`,
    kind: 'per_asset' as const,
    title: `Where ${slot.asset} payments land`,
    accountName: `${slot.asset} Holding`,
    mappingField: slot.mappingField,
    suggestedCode: slot.suggestedCode,
    paymentAsset: slot.asset,
    paymentRail: 'crypto',
    helperText: CLEARING_HELPER,
  }));
}

/**
 * Optional settlement mappings to show in Xero setup.
 */
export function getSettlementAccountsForUi(
  settings: MerchantSettlementSettings,
  rails: MerchantPaymentRails
): SettlementUiAccountDefinition[] {
  const definitions: SettlementUiAccountDefinition[] = [];

  if (rails.stripeEnabled) {
    definitions.push({
      id: 'stripe-holding',
      kind: 'rail',
      title: 'Where card payments land (Stripe)',
      accountName: STRIPE_HOLDING.accountName,
      mappingField: STRIPE_HOLDING.mappingField,
      suggestedCode: STRIPE_HOLDING.suggestedCode,
      paymentRail: 'stripe',
      helperText: CLEARING_HELPER,
    });
  }

  if (rails.wiseEnabled || rails.manualBankEnabled) {
    definitions.push({
      id: 'wise-holding',
      kind: 'rail',
      title: 'Where bank transfers land',
      accountName: WISE_HOLDING.accountName,
      mappingField: WISE_HOLDING.mappingField,
      suggestedCode: WISE_HOLDING.suggestedCode,
      paymentRail: 'wise',
      helperText:
        'Provvy records bank transfer and Wise payments here when customers pay that way.',
    });
  }

  const showDigital = rails.stablecoinSettlementsEnabled || LEGACY_CRYPTO_ASSET_SLOTS.some(
    (slot) => Boolean(readSettlementMappingCode(settings, slot.mappingField))
  );

  if (!showDigital) {
    return definitions;
  }

  if (resolveCryptoSettlementStrategy(settings) === 'shared') {
    definitions.push({
      id: 'shared-digital-holding',
      kind: 'shared_digital',
      title: 'Where crypto payments land',
      accountName: SHARED_DIGITAL_HOLDING.accountName,
      mappingField: SHARED_DIGITAL_HOLDING.mappingField,
      suggestedCode: SHARED_DIGITAL_HOLDING.suggestedCode,
      paymentRail: 'crypto',
      helperText: CLEARING_HELPER,
    });
    return definitions;
  }

  definitions.push(...perAssetDefinitions());
  return definitions;
}

export function settlementUiDefinitionStatus(
  definition: SettlementUiAccountDefinition,
  settings: MerchantSettlementSettings
): 'configured' | 'recommended' {
  const code = readSettlementMappingCode(settings, definition.mappingField);
  return code ? 'configured' : 'recommended';
}

export function canResolveSettlementAccount(
  settings: MerchantSettlementSettings,
  paymentRail: string,
  paymentAsset?: string | null,
  collectionMethod?: string | null
): boolean {
  return (
    resolveSettlementAccount({
      paymentRail,
      collectionMethod,
      paymentAsset,
      settings,
    }).status === 'resolved'
  );
}
