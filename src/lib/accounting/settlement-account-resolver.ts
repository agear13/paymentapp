/**
 * Single resolver for Xero holding / settlement accounts.
 * Phase 1: maps rail + asset → existing merchant_settings columns via strategy.
 */

import { resolveCryptoSettlementStrategy } from '@/lib/accounting/crypto-settlement-strategy';
import {
  collectionMethodFromPaymentMethod,
  normalizeCollectionMethod,
} from '@/lib/accounting/collection-method';
import {
  cryptoSlotForAsset,
  firstEmptyCryptoSlot,
  LEGACY_CRYPTO_MAPPING_FIELDS,
  SHARED_DIGITAL_HOLDING,
  STRIPE_HOLDING,
  WISE_HOLDING,
} from '@/lib/accounting/settlement-account-config';
import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';
import type { PaymentMethod } from '@prisma/client';
import { getPaymentRailByMethod } from '@/lib/payments/payment-rail-registry';
import type {
  MerchantSettlementSettings,
  PaymentAsset,
  ResolveSettlementAccountInput,
  SettlementAccountResolution,
  SettlementAccountTarget,
  SettlementContext,
  SettlementPaymentRail,
  SettlementProvisioningGuide,
  SettlementClearingMappingField,
} from '@/lib/accounting/settlement-account-types';
import { readSettlementMappingCode } from '@/lib/accounting/settlement-account-types';

export {
  LEGACY_CRYPTO_MAPPING_FIELDS as DIGITAL_ASSET_MAPPING_FIELDS,
  SHARED_DIGITAL_HOLDING,
  STRIPE_HOLDING,
  WISE_HOLDING,
} from '@/lib/accounting/settlement-account-config';

export { resolveCryptoSettlementStrategy, inferCryptoSettlementStrategy, isSharedCryptoStrategy } from '@/lib/accounting/crypto-settlement-strategy';

const CRYPTO_SETTLEMENT_RAIL: SettlementPaymentRail = 'crypto';

const RAIL_LEVEL_TARGETS: Partial<
  Record<
    SettlementPaymentRail,
    Pick<SettlementAccountTarget, 'accountName' | 'mappingField' | 'suggestedCode'>
  >
> = {
  stripe: {
    accountName: STRIPE_HOLDING.accountName,
    mappingField: STRIPE_HOLDING.mappingField,
    suggestedCode: STRIPE_HOLDING.suggestedCode,
  },
  wise: {
    accountName: WISE_HOLDING.accountName,
    mappingField: WISE_HOLDING.mappingField,
    suggestedCode: WISE_HOLDING.suggestedCode,
  },
};

/** Settlement layer uses Crypto rail for all on-chain / wallet payments. */
export function normalizeSettlementPaymentRail(
  rail: SettlementPaymentRail | string
): SettlementPaymentRail {
  if (
    rail === 'hedera' ||
    rail === 'evm_wallet' ||
    rail === 'manual_wallet'
  ) {
    return CRYPTO_SETTLEMENT_RAIL;
  }
  return rail as SettlementPaymentRail;
}

export function normalizePaymentAsset(
  asset: PaymentAsset | string | null | undefined
): PaymentAsset | null {
  const value = asset?.trim().toUpperCase();
  return value ? value : null;
}

export function paymentAssetFromTokenType(
  token: string | null | undefined
): PaymentAsset | null {
  return normalizePaymentAsset(token);
}

export function paymentMethodToSettlementRail(
  method: PaymentMethod | string | null | undefined
): SettlementPaymentRail | null {
  if (!method) return null;
  const rail = getPaymentRailByMethod(method as PaymentMethod);
  if (!rail) return null;
  return normalizeSettlementPaymentRail(rail.id);
}

function readMappingCode(
  settings: MerchantSettlementSettings,
  field: SettlementClearingMappingField
): string | null {
  return readSettlementMappingCode(settings, field);
}

function sharedCryptoAccountCode(settings: MerchantSettlementSettings): string | null {
  const codes = LEGACY_CRYPTO_MAPPING_FIELDS.map((field) => readMappingCode(settings, field)).filter(
    (code): code is string => Boolean(code)
  );
  const unique = [...new Set(codes)];
  return unique.length === 1 ? unique[0]! : null;
}

function findConfiguredAssetBinding(
  asset: PaymentAsset,
  settings: MerchantSettlementSettings
): { code: string; mappingField: XeroMappingField } | null {
  const slot = cryptoSlotForAsset(asset);
  if (!slot) return null;
  const code = readMappingCode(settings, slot.mappingField);
  return code ? { code, mappingField: slot.mappingField } : null;
}

function holdingAccountName(asset: PaymentAsset | null, shared: boolean): string {
  if (shared || !asset) return SHARED_DIGITAL_HOLDING.accountName;
  return `${asset} Holding`;
}

function buildGuide(target: SettlementAccountTarget): SettlementProvisioningGuide {
  const mappingField =
    target.mappingField ??
    (target.scope === 'rail' ? STRIPE_HOLDING.mappingField : SHARED_DIGITAL_HOLDING.mappingField);

  return {
    accountName: target.accountName,
    accountTypeLabel: 'Current Asset',
    suggestedCode: target.suggestedCode,
    mappingField,
    intro: 'Add this account in Xero, then return here to link it.',
  };
}

function resolved(
  xeroAccountCode: string,
  target: SettlementAccountTarget
): SettlementAccountResolution {
  return {
    status: 'resolved',
    xeroAccountCode,
    target,
    mappingField: target.mappingField,
  };
}

function unmapped(target: SettlementAccountTarget): SettlementAccountResolution {
  return {
    status: 'unmapped',
    target,
    guide: buildGuide(target),
  };
}

function resolveRailLevelAccount(
  paymentRail: SettlementPaymentRail,
  collectionMethod: SettlementAccountTarget['collectionMethod'],
  settings: MerchantSettlementSettings
): SettlementAccountResolution {
  const meta = RAIL_LEVEL_TARGETS[paymentRail];
  if (!meta?.mappingField) {
    return unmapped({
      scope: 'rail',
      paymentRail,
      collectionMethod,
      paymentAsset: null,
      mappingField: null,
      accountName: `${paymentRail} Holding`,
      suggestedCode: '1050',
    });
  }

  const target: SettlementAccountTarget = {
    scope: 'rail',
    paymentRail,
    collectionMethod,
    paymentAsset: null,
    mappingField: meta.mappingField,
    accountName: meta.accountName,
    suggestedCode: meta.suggestedCode,
  };

  const code = readMappingCode(
    settings,
    meta.mappingField as SettlementClearingMappingField
  );
  return code ? resolved(code, target) : unmapped(target);
}

function resolveCryptoSettlement(
  paymentRail: SettlementPaymentRail,
  collectionMethod: SettlementAccountTarget['collectionMethod'],
  asset: PaymentAsset | null,
  settings: MerchantSettlementSettings
): SettlementAccountResolution {
  const strategy = resolveCryptoSettlementStrategy(settings);

  if (asset) {
    const binding = findConfiguredAssetBinding(asset, settings);
    if (binding) {
      const slot = cryptoSlotForAsset(asset)!;
      return resolved(binding.code, {
        scope: 'per_asset',
        paymentRail,
        collectionMethod,
        paymentAsset: asset,
        mappingField: binding.mappingField,
        accountName: holdingAccountName(asset, false),
        suggestedCode: slot.suggestedCode,
      });
    }
  }

  if (strategy === 'shared') {
    const sharedCode = sharedCryptoAccountCode(settings);
    const target: SettlementAccountTarget = {
      scope: 'shared_digital_asset',
      paymentRail,
      collectionMethod,
      paymentAsset: asset,
      mappingField: SHARED_DIGITAL_HOLDING.mappingField,
      accountName: SHARED_DIGITAL_HOLDING.accountName,
      suggestedCode: SHARED_DIGITAL_HOLDING.suggestedCode,
    };
    return sharedCode ? resolved(sharedCode, target) : unmapped(target);
  }

  const emptySlot = firstEmptyCryptoSlot((field) => readMappingCode(settings, field));
  const target: SettlementAccountTarget = {
    scope: 'per_asset',
    paymentRail,
    collectionMethod,
    paymentAsset: asset,
    mappingField: emptySlot?.mappingField ?? SHARED_DIGITAL_HOLDING.mappingField,
    accountName: holdingAccountName(asset, false),
    suggestedCode: emptySlot?.suggestedCode ?? SHARED_DIGITAL_HOLDING.suggestedCode,
  };

  return unmapped(target);
}

/**
 * Resolve which Xero holding account code to use for a payment.
 */
export function resolveSettlementAccount(
  input: ResolveSettlementAccountInput
): SettlementAccountResolution {
  const paymentRail = normalizeSettlementPaymentRail(input.paymentRail);
  const collectionMethod = normalizeCollectionMethod(input.collectionMethod);
  const paymentAsset = normalizePaymentAsset(input.paymentAsset);
  const settings = input.settings;

  if (paymentRail === 'stripe' || paymentRail === 'wise') {
    return resolveRailLevelAccount(paymentRail, collectionMethod, settings);
  }

  if (paymentRail === 'manual_bank') {
    return unmapped({
      scope: 'rail',
      paymentRail,
      collectionMethod,
      paymentAsset,
      mappingField: null,
      accountName: 'Bank Holding',
      suggestedCode: '1055',
    });
  }

  if (paymentRail === CRYPTO_SETTLEMENT_RAIL) {
    return resolveCryptoSettlement(paymentRail, collectionMethod, paymentAsset, settings);
  }

  return unmapped({
    scope: 'rail',
    paymentRail,
    collectionMethod,
    paymentAsset,
    mappingField: null,
    accountName: 'Settlement Holding',
    suggestedCode: '1050',
  });
}

/** Fields that receive the same code when provisioning a shared crypto holding account. */
export function sharedDigitalAssetPersistFields(
  settings: MerchantSettlementSettings
): XeroMappingField[] {
  const empty = LEGACY_CRYPTO_MAPPING_FIELDS.filter(
    (field) => !readMappingCode(settings, field)
  );
  return empty.length > 0 ? empty : [SHARED_DIGITAL_HOLDING.mappingField];
}

/** @deprecated Use resolveCryptoSettlementStrategy / isSharedCryptoStrategy. */
export function usesSharedDigitalAssetAccount(settings: MerchantSettlementSettings): boolean {
  return resolveCryptoSettlementStrategy(settings) === 'shared';
}

export function paymentMethodAndTokenToSettlementContext(
  paymentMethod: string,
  paymentToken?: string | null,
  settlementCurrency?: string | null
): SettlementContext {
  switch (paymentMethod) {
    case 'STRIPE':
      return {
        paymentRail: 'stripe',
        collectionMethod: null,
        paymentAsset: normalizePaymentAsset(settlementCurrency),
      };
    case 'WISE':
      return {
        paymentRail: 'wise',
        collectionMethod: null,
        paymentAsset: normalizePaymentAsset(settlementCurrency),
      };
    case 'HEDERA':
    case 'EVM_WALLET':
    case 'CRYPTO':
      return {
        paymentRail: CRYPTO_SETTLEMENT_RAIL,
        collectionMethod: collectionMethodFromPaymentMethod(paymentMethod),
        paymentAsset: paymentAssetFromTokenType(paymentToken),
      };
    default: {
      const rail = paymentMethodToSettlementRail(paymentMethod);
      return {
        paymentRail: rail ? normalizeSettlementPaymentRail(rail) : CRYPTO_SETTLEMENT_RAIL,
        collectionMethod: collectionMethodFromPaymentMethod(paymentMethod),
        paymentAsset: paymentAssetFromTokenType(paymentToken ?? settlementCurrency),
      };
    }
  }
}
