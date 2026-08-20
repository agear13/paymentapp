/**
 * UI-only payment account recommendations for Commercial OS Xero setup.
 * Does not change settlement resolver behaviour.
 */

import {
  LEGACY_CRYPTO_ASSET_SLOTS,
  SHARED_DIGITAL_HOLDING,
  STRIPE_HOLDING,
  WISE_HOLDING,
} from '@/lib/accounting/settlement-account-config';
import { resolveCryptoSettlementStrategy } from '@/lib/accounting/crypto-settlement-strategy';
import type { SettlementUiAccountDefinition } from '@/lib/accounting/settlement-account-ui';
import type { MerchantSettlementSettings } from '@/lib/accounting/settlement-account-types';
import { readSettlementMappingCode } from '@/lib/accounting/settlement-account-types';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import { normalizeMerchantPaymentRails } from '@/lib/commercial-os/merchant-payment-rails';
import {
  resolveAvailableAccountCode,
  type AccountingChartAccount,
} from '@/lib/accounting/recommended-clearing-accounts-service';

export type PaymentAccountChartAccount = AccountingChartAccount & {
  accountID?: string;
};

export type PaymentAccountRecommendationStatus =
  | 'linked'
  | 'found'
  | 'create_in_xero'
  | 'choose_account'
  | 'update_mapping';

export type PaymentAccountCandidate = {
  account: PaymentAccountChartAccount;
  reason: string;
};

export type PaymentFlowStep = {
  label: string;
  optional?: boolean;
};

export type ConfidenceIndicator = {
  id: 'provvy' | 'found' | 'common' | 'reconcile';
  label: string;
  active: boolean;
};

export type PaymentAccountRecommendation = {
  definition: SettlementUiAccountDefinition;
  status: PaymentAccountRecommendationStatus;
  recommendedAccount: PaymentAccountChartAccount | null;
  alternativeCandidates: PaymentAccountCandidate[];
  matchReason: string | null;
  whyProvvyRecommends: string;
  reconciliationExplanation: string;
  flowSteps: PaymentFlowStep[];
  confidenceIndicators: ConfidenceIndicator[];
  displayAccountType: string;
  suggestedCode: string;
  actionableGuidance: string;
  mappedCode: string | null;
};

const PREFERRED_HOLDING_TYPES = ['BANK', 'CURRENT', 'CURRLIAB'] as const;

const HOLDING_NAME_PATTERNS = [
  'holding',
  'clearing',
  'clearing account',
  'suspense',
  'payments in transit',
  'undeposited',
  'receivable clearing',
  'payment clearing',
] as const;

const GLOBAL_CLEARING_NAMES = [
  'clearing account',
  'suspense account',
  'suspense',
  'payments clearing',
] as const;

const NAME_ALIASES: Record<string, readonly string[]> = {
  [STRIPE_HOLDING.accountName]: [
    'Stripe Clearing',
    'Stripe Payments Holding',
    'Stripe Receivable Clearing',
  ],
  [WISE_HOLDING.accountName]: [
    'Wise Clearing',
    'Bank Transfer Holding',
    'Manual Bank Holding',
  ],
  [SHARED_DIGITAL_HOLDING.accountName]: [
    'Digital Asset Holding',
    'Crypto Holding',
    'Digital Assets Holding',
    'Cryptocurrency Holding',
  ],
};

const RAIL_KEYWORDS: Record<string, readonly string[]> = {
  stripe: ['stripe', 'card', 'credit card'],
  wise: ['wise', 'bank transfer', 'manual bank', 'transfer'],
  crypto: ['crypto', 'digital asset', 'digital', 'token', 'stablecoin'],
};

const PER_ASSET_ALIASES: Record<string, readonly string[]> = {
  HBAR: ['HBAR Clearing', 'Hedera Holding', 'HBAR Holding'],
  USDC: ['USDC Clearing', 'USD Coin Holding', 'USDC Holding'],
  USDT: ['USDT Clearing', 'Tether Holding', 'USDT Holding'],
  AUDD: ['AUDD Clearing', 'AUDD Holding'],
};

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function isActive(account: PaymentAccountChartAccount): boolean {
  const status = normalize(account.status);
  return !status || status === 'active';
}

function displayXeroAccountType(type: string): string {
  switch (type.trim().toUpperCase()) {
    case 'CURRENT':
      return 'Current Asset';
    case 'BANK':
      return 'Bank';
    case 'CURRLIAB':
      return 'Current Liability';
    case 'EXPENSE':
      return 'Expense';
    default:
      return type;
  }
}

function railKeywords(definition: SettlementUiAccountDefinition): readonly string[] {
  if (definition.paymentAsset) {
    return [definition.paymentAsset.toLowerCase(), ...(RAIL_KEYWORDS.crypto ?? [])];
  }
  if (definition.paymentRail === 'stripe') return RAIL_KEYWORDS.stripe;
  if (definition.paymentRail === 'wise') return RAIL_KEYWORDS.wise;
  if (definition.kind === 'shared_digital') return RAIL_KEYWORDS.crypto;
  return [];
}

function containsAny(text: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

function scoreCandidate(
  account: PaymentAccountChartAccount,
  definition: SettlementUiAccountDefinition
): { score: number; reason: string } | null {
  if (!isActive(account)) return null;

  const name = normalize(account.name);
  const target = normalize(definition.accountName);
  const keywords = railKeywords(definition);

  if (name === target) {
    return {
      score: 100,
      reason: `Exact name match — "${account.name}" already follows Provvy's recommended naming.`,
    };
  }

  for (const alias of NAME_ALIASES[definition.accountName] ?? []) {
    if (name === normalize(alias)) {
      return {
        score: 96,
        reason: `Similar name found — your chart uses "${account.name}", which works the same as ${definition.accountName}.`,
      };
    }
  }

  if (definition.paymentAsset) {
    for (const alias of PER_ASSET_ALIASES[definition.paymentAsset] ?? []) {
      if (name === normalize(alias)) {
        return {
          score: 96,
          reason: `Similar ${definition.paymentAsset} account found — "${account.name}" is suitable for this asset.`,
        };
      }
    }
  }

  const hasRailKeyword = containsAny(name, keywords);
  const hasHoldingPattern = containsAny(name, HOLDING_NAME_PATTERNS);

  if (hasRailKeyword && hasHoldingPattern) {
    return {
      score: 92,
      reason: `Name matches common convention — "${account.name}" combines the payment method with a holding/clearing pattern.`,
    };
  }

  if (account.code.trim() === definition.suggestedCode) {
    return {
      score: 90,
      reason: `Account code ${definition.suggestedCode} matches Provvy's suggested code for ${definition.accountName}.`,
    };
  }

  if (hasRailKeyword && containsAny(name, ['clearing', 'holding', 'suspense'])) {
    const railLabel = definition.paymentAsset ?? definition.paymentRail ?? 'payment';
    return {
      score: 86,
      reason: `Closest ${railLabel} match — "${account.name}" is the nearest holding-style account in your chart.`,
    };
  }

  for (const alias of NAME_ALIASES[definition.accountName] ?? []) {
    if (name.includes(normalize(alias))) {
      return {
        score: 84,
        reason: `Partial name match — "${account.name}" includes "${alias}".`,
      };
    }
  }

  if (definition.paymentAsset && name.includes(definition.paymentAsset.toLowerCase())) {
    return {
      score: 80,
      reason: `Asset name match — "${account.name}" references ${definition.paymentAsset}.`,
    };
  }

  if (hasRailKeyword) {
    return {
      score: 72,
      reason: `Related account — "${account.name}" references this payment method but may need review.`,
    };
  }

  if (containsAny(name, GLOBAL_CLEARING_NAMES) && hasHoldingPattern) {
    return {
      score: 68,
      reason: `Generic clearing account — "${account.name}" may work if dedicated to this payment method.`,
    };
  }

  if (
    PREFERRED_HOLDING_TYPES.includes(
      account.type.trim().toUpperCase() as (typeof PREFERRED_HOLDING_TYPES)[number]
    )
  ) {
    return { score: 15, reason: 'Suitable account type (Current Asset or Bank).' };
  }

  return null;
}

function reconciliationExplanation(definition: SettlementUiAccountDefinition): string {
  if (definition.kind === 'shared_digital') {
    return (
      'Provvy records each crypto payment against this holding account in Xero when the customer pays. ' +
      'Wallet or exchange settlement and clearing this balance are not posted automatically by Provvy.'
    );
  }
  if (definition.kind === 'per_asset') {
    return (
      `Provvy records ${definition.paymentAsset} payments against this holding account in Xero when the customer pays. ` +
      'Your accountant reconciles each asset separately; bank or wallet settlement is not posted automatically by Provvy.'
    );
  }
  if (definition.paymentRail === 'stripe') {
    return (
      'Provvy records card payments against Stripe Holding in Xero when customers pay. ' +
      'When Stripe settles to your bank, that holding balance is not cleared automatically by Provvy — use your normal Xero reconciliation workflow.'
    );
  }
  if (definition.paymentRail === 'wise') {
    return (
      'Provvy records bank transfer and Wise payments against Wise Holding in Xero when customers pay. ' +
      'When the deposit reaches your bank account, that holding balance is not cleared automatically by Provvy — use your normal Xero reconciliation workflow.'
    );
  }
  return (
    'Provvy records customer payments against this holding account in Xero. ' +
    'Bank settlement and clearing the holding balance are not posted automatically by Provvy.'
  );
}

function whyProvvyRecommends(definition: SettlementUiAccountDefinition): string {
  if (definition.kind === 'shared_digital') {
    return 'Most businesses use one Digital Asset Holding account — it keeps crypto setup simple while Provvy records payments in Xero.';
  }
  if (definition.kind === 'per_asset') {
    return `Accountants often prefer a dedicated ${definition.paymentAsset} holding account when each asset is reconciled separately.`;
  }
  if (definition.paymentRail === 'stripe') {
    return 'Stripe Holding is the standard pattern — Provvy records card payments here in Xero when customers pay, before funds settle to your bank.';
  }
  if (definition.paymentRail === 'wise') {
    return 'Wise Holding keeps bank transfers separate from your main bank balance in Xero while Provvy records each payment.';
  }
  return definition.helperText ?? 'Provvy uses this account when recording customer payments in Xero.';
}

export function getPaymentFlowSteps(definition: SettlementUiAccountDefinition): PaymentFlowStep[] {
  if (definition.kind === 'shared_digital' || definition.kind === 'per_asset') {
    return [
      { label: 'Customer pays' },
      { label: definition.accountName },
      { label: 'Wallet / Exchange' },
      { label: 'Optional conversion', optional: true },
      { label: 'Accountant reconciliation' },
    ];
  }

  if (definition.paymentRail === 'stripe') {
    return [
      { label: 'Customer pays' },
      { label: STRIPE_HOLDING.accountName },
      { label: 'Bank account' },
      { label: 'Bank settlement (in Xero)' },
    ];
  }

  return [
    { label: 'Customer pays' },
    { label: WISE_HOLDING.accountName },
    { label: 'Bank account' },
    { label: 'Bank settlement (in Xero)' },
  ];
}

function buildConfidenceIndicators(
  definition: SettlementUiAccountDefinition,
  status: PaymentAccountRecommendationStatus,
  recommendedAccount: PaymentAccountChartAccount | null
): ConfidenceIndicator[] {
  const foundInXero =
    Boolean(recommendedAccount) &&
    (status === 'linked' || status === 'found' || status === 'choose_account');

  return [
    { id: 'provvy', label: 'Recommended by Provvy', active: true },
    { id: 'found', label: 'Found in your Xero account', active: foundInXero },
    {
      id: 'common',
      label: 'Used by most businesses',
      active: definition.kind !== 'per_asset',
    },
    { id: 'reconcile', label: 'Dedicated holding account', active: true },
  ];
}

function actionableGuidance(
  definition: SettlementUiAccountDefinition,
  status: PaymentAccountRecommendationStatus,
  suggestedCode: string,
  recommendedAccount: PaymentAccountChartAccount | null
): string {
  if (status === 'linked' && recommendedAccount) {
    return `Linked to "${recommendedAccount.name}" (${recommendedAccount.code}).`;
  }
  if (status === 'found' && recommendedAccount) {
    return `Link "${recommendedAccount.name}" (${recommendedAccount.code}) — Provvy found it in your Xero chart.`;
  }
  if (status === 'update_mapping') {
    if (recommendedAccount) {
      return `Your saved account is missing from Xero — link "${recommendedAccount.name}" (${recommendedAccount.code}).`;
    }
    return `Your saved account is missing from Xero — choose an existing account or create "${definition.accountName}" with code ${suggestedCode}.`;
  }
  if (status === 'choose_account' && recommendedAccount) {
    return `Provvy recommends "${recommendedAccount.name}" — review similar accounts below or confirm this selection.`;
  }
  return `Create "${definition.accountName}" in Xero (type: Current Asset, code ${suggestedCode}), then link it here.`;
}

export function resolveSuggestedAccountCode(
  accounts: PaymentAccountChartAccount[],
  definition: SettlementUiAccountDefinition
): string {
  try {
    return resolveAvailableAccountCode(accounts, definition.suggestedCode);
  } catch {
    return definition.suggestedCode;
  }
}

export function resolvePaymentAccountRecommendation(
  accounts: PaymentAccountChartAccount[],
  definition: SettlementUiAccountDefinition,
  mappedCode?: string | null
): PaymentAccountRecommendation {
  const scored = accounts
    .map((account) => {
      const result = scoreCandidate(account, definition);
      if (!result) return null;
      return { account, reason: result.reason, score: result.score };
    })
    .filter((item): item is PaymentAccountCandidate & { score: number } => item !== null)
    .sort((a, b) => b.score - a.score || `${a.account.code}`.localeCompare(`${b.account.code}`));

  const best = scored[0]?.account ?? null;
  const bestScore = scored[0]?.score ?? 0;
  const suggestedCode = resolveSuggestedAccountCode(accounts, definition);
  const trimmedMapped = mappedCode?.trim() || null;
  const mappedAccount = trimmedMapped
    ? accounts.find((account) => account.code.trim() === trimmedMapped) ?? null
    : null;

  let status: PaymentAccountRecommendationStatus = 'create_in_xero';
  let recommendedAccount: PaymentAccountChartAccount | null = best;
  let matchReason: string | null = scored[0]?.reason ?? null;

  if (trimmedMapped && (!mappedAccount || !isActive(mappedAccount))) {
    status = 'update_mapping';
    recommendedAccount = best && bestScore >= 84 ? best : null;
    matchReason = recommendedAccount
      ? `Saved code ${trimmedMapped} is not in your chart — Provvy suggests "${recommendedAccount.name}" instead.`
      : `Saved code ${trimmedMapped} is not in your chart.`;
  } else if (mappedAccount && isActive(mappedAccount)) {
    status = 'linked';
    recommendedAccount = mappedAccount;
    matchReason = `Already linked — Provvy is using "${mappedAccount.name}" (${mappedAccount.code}).`;
  } else if (best && bestScore >= 96) {
    status = 'found';
    recommendedAccount = best;
  } else if (best && bestScore >= 84) {
    status = 'choose_account';
    recommendedAccount = best;
  } else {
    status = 'create_in_xero';
    recommendedAccount = null;
    matchReason = null;
  }

  const alternatives = scored
    .slice(1)
    .map(({ account, reason }) => ({ account, reason }))
    .slice(0, 3);

  return {
    definition,
    status,
    recommendedAccount,
    alternativeCandidates: alternatives,
    matchReason,
    whyProvvyRecommends: whyProvvyRecommends(definition),
    reconciliationExplanation: reconciliationExplanation(definition),
    flowSteps: getPaymentFlowSteps(definition),
    confidenceIndicators: buildConfidenceIndicators(definition, status, recommendedAccount),
    displayAccountType: displayXeroAccountType('CURRENT'),
    suggestedCode,
    actionableGuidance: actionableGuidance(
      definition,
      status,
      suggestedCode,
      recommendedAccount
    ),
    mappedCode: trimmedMapped,
  };
}

function railDefinition(
  partial: Omit<SettlementUiAccountDefinition, 'kind'>
): SettlementUiAccountDefinition {
  return { kind: 'rail', ...partial };
}

function sharedDigitalDefinition(): SettlementUiAccountDefinition {
  return {
    id: 'shared-digital-holding',
    kind: 'shared_digital',
    title: 'Digital Asset Holding',
    accountName: SHARED_DIGITAL_HOLDING.accountName,
    mappingField: SHARED_DIGITAL_HOLDING.mappingField,
    suggestedCode: SHARED_DIGITAL_HOLDING.suggestedCode,
    paymentRail: 'crypto',
    helperText:
      'Provvy records crypto payments against this holding account in Xero when customers pay.',
  };
}

function perAssetDefinitions(): SettlementUiAccountDefinition[] {
  return LEGACY_CRYPTO_ASSET_SLOTS.map((slot) => ({
    id: `per-asset-${slot.asset.toLowerCase()}`,
    kind: 'per_asset' as const,
    title: `${slot.asset} Holding`,
    accountName: `${slot.asset} Holding`,
    mappingField: slot.mappingField,
    suggestedCode: slot.suggestedCode,
    paymentAsset: slot.asset,
    paymentRail: 'crypto',
    helperText:
      'Provvy records the payment against this holding account in Xero when the customer pays.',
  }));
}

export type PaymentAccountUiGroups = {
  primary: SettlementUiAccountDefinition[];
  advancedPerAsset: SettlementUiAccountDefinition[];
  cryptoStrategy: 'shared' | 'per_asset';
};

/** Primary payment rows + accountant-mode per-asset rows (UI layout only). */
export function buildPaymentAccountUiGroups(
  settings: MerchantSettlementSettings,
  rails: MerchantPaymentRails
): PaymentAccountUiGroups {
  const primary: SettlementUiAccountDefinition[] = [];
  const normalizedRails = normalizeMerchantPaymentRails(rails);

  if (normalizedRails.stripeEnabled) {
    primary.push(
      railDefinition({
        id: 'stripe-holding',
        title: 'Stripe Holding',
        accountName: STRIPE_HOLDING.accountName,
        mappingField: STRIPE_HOLDING.mappingField,
        suggestedCode: STRIPE_HOLDING.suggestedCode,
        paymentRail: 'stripe',
        helperText:
          'Provvy records Stripe payments here before they reach your bank account.',
      })
    );
  }

  if (normalizedRails.wiseEnabled || normalizedRails.manualBankEnabled) {
    primary.push(
      railDefinition({
        id: 'wise-holding',
        title: 'Wise Holding',
        accountName: WISE_HOLDING.accountName,
        mappingField: WISE_HOLDING.mappingField,
        suggestedCode: WISE_HOLDING.suggestedCode,
        paymentRail: 'wise',
        helperText:
          'Provvy records bank transfer and Wise payments here when customers pay that way.',
      })
    );
  }

  const showDigital =
    normalizedRails.stablecoinSettlementsEnabled ||
    LEGACY_CRYPTO_ASSET_SLOTS.some((slot) =>
      Boolean(readSettlementMappingCode(settings, slot.mappingField))
    );

  const cryptoStrategy = resolveCryptoSettlementStrategy(settings);
  const advancedPerAsset = showDigital ? perAssetDefinitions() : [];

  if (showDigital) {
    primary.push(sharedDigitalDefinition());
  }

  return { primary, advancedPerAsset, cryptoStrategy };
}

export function recommendationBadgeLabel(status: PaymentAccountRecommendationStatus): string {
  switch (status) {
    case 'linked':
      return 'Linked';
    case 'found':
      return 'Found in Xero';
    case 'create_in_xero':
      return 'Not in Xero';
    case 'choose_account':
      return 'Choose account';
    case 'update_mapping':
      return 'Needs attention';
  }
}
