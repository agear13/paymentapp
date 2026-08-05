import 'server-only';

import { Account, AccountType } from 'xero-node';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import {
  findAccountByExactName,
  resolveAvailableAccountCode,
  type AccountingChartAccount,
} from '@/lib/accounting/recommended-clearing-accounts-service';
import {
  resolveSettlementAccount,
  sharedDigitalAssetPersistFields,
  STRIPE_HOLDING,
  SHARED_DIGITAL_HOLDING,
} from '@/lib/accounting/settlement-account-resolver';
import type {
  MerchantSettlementSettings,
  SettlementAccountResolution,
  SettlementAccountTarget,
} from '@/lib/accounting/settlement-account-types';
import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';
import { getXeroClient } from '@/lib/xero/client';
import { getActiveConnection } from '@/lib/xero/connection-service';
import { applyConnectionToXeroClient } from '@/lib/xero/apply-connection-token-set';
import { fetchXeroAccounts, type XeroAccount } from '@/lib/xero/accounts-service';
import { formatClearingAccountCreationError } from '@/lib/xero/xero-sync-errors';

export type SettlementProvisioningResult =
  | {
      status: 'linked';
      xeroAccountCode: string;
      created: boolean;
      resolution: SettlementAccountResolution;
    }
  | {
      status: 'manual_required';
      resolution: SettlementAccountResolution;
      customerMessage: string;
    };

function toChartAccounts(accounts: XeroAccount[]): AccountingChartAccount[] {
  return accounts.map((account) => ({
    code: account.code,
    name: account.name,
    type: account.type,
    status: account.status,
  }));
}

async function createXeroHoldingAccount(
  organizationId: string,
  target: SettlementAccountTarget,
  accountCode: string
): Promise<XeroAccount> {
  const connection = await getActiveConnection(organizationId);
  if (!connection) {
    throw new Error('No active Xero connection found');
  }

  const xeroClient = getXeroClient();
  await applyConnectionToXeroClient(xeroClient, connection, 'create_settlement_account');
  await xeroClient.updateTenants();

  const account = new Account();
  account.name = target.accountName;
  account.code = accountCode;
  account.type = AccountType.CURRENT;
  account._class = Account.ClassEnum.ASSET;
  account.description = `Temporary holding account for ${target.accountName}.`;
  account.enablePaymentsToAccount = true;
  account.status = Account.StatusEnum.ACTIVE;

  const response = await xeroClient.accountingApi.createAccount(
    connection.tenantId,
    account,
    `provvypay-settlement-${target.paymentRail}-${accountCode}`
  );

  const created = response.body.accounts?.[0];
  if (!created?.accountID || !created.code || !created.name) {
    throw new Error(`Xero did not return a created account for ${target.accountName}`);
  }

  return {
    accountID: created.accountID,
    code: created.code,
    name: created.name,
    type: created.type != null ? String(created.type) : String(AccountType.CURRENT),
    taxType: created.taxType,
    status: created.status != null ? String(created.status) : 'ACTIVE',
    class: created._class != null ? String(created._class) : 'ASSET',
  };
}

async function loadMerchantSettlementSettings(
  organizationId: string
): Promise<MerchantSettlementSettings | null> {
  return prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
    select: {
      xero_stripe_clearing_account_id: true,
      xero_wise_clearing_account_id: true,
      xero_hbar_clearing_account_id: true,
      xero_usdc_clearing_account_id: true,
      xero_usdt_clearing_account_id: true,
      xero_audd_clearing_account_id: true,
      xero_fee_expense_account_id: true,
    },
  });
}

async function persistMappingCodes(
  organizationId: string,
  updates: Partial<Record<XeroMappingField, string>>
): Promise<void> {
  if (Object.keys(updates).length === 0) return;

  await prisma.merchant_settings.updateMany({
    where: { organization_id: organizationId },
    data: updates,
  });
}

function buildManualRequiredMessage(resolution: SettlementAccountResolution): string {
  if (resolution.status !== 'unmapped') {
    return 'We could not link a holding account in Xero. Add the account manually and try again.';
  }

  const { guide } = resolution;
  return [
    'We could not add this account in Xero automatically.',
    'Add it manually with these details:',
    `Name: ${guide.accountName}`,
    `Type: ${guide.accountTypeLabel}`,
    `Code: ${guide.suggestedCode} (or the next available code in your chart)`,
  ].join(' ');
}

function mappingUpdatesForTarget(
  target: SettlementAccountTarget,
  accountCode: string,
  settings: MerchantSettlementSettings
): Partial<Record<XeroMappingField, string>> {
  if (target.scope === 'shared_digital_asset') {
    const updates: Partial<Record<XeroMappingField, string>> = {};
    for (const field of sharedDigitalAssetPersistFields(settings)) {
      updates[field] = accountCode;
    }
    return updates;
  }

  if (target.mappingField) {
    return { [target.mappingField]: accountCode };
  }

  return {};
}

/**
 * Ensure a settlement account exists in Xero and is linked in merchant_settings.
 * Uses friendly customer messaging when auto-create is not permitted.
 */
export async function provisionSettlementAccount(input: {
  organizationId: string;
  paymentRail: string;
  collectionMethod?: string | null;
  paymentAsset?: string | null;
}): Promise<SettlementProvisioningResult> {
  const settings = await loadMerchantSettlementSettings(input.organizationId);
  if (!settings) {
    throw new Error('Merchant settings not found');
  }

  const resolution = resolveSettlementAccount({
    organizationId: input.organizationId,
    paymentRail: input.paymentRail,
    collectionMethod: input.collectionMethod,
    paymentAsset: input.paymentAsset,
    settings,
  });

  if (resolution.status === 'resolved') {
    return {
      status: 'linked',
      xeroAccountCode: resolution.xeroAccountCode,
      created: false,
      resolution,
    };
  }

  const { target, guide } = resolution;
  const { accounts } = await fetchXeroAccounts(input.organizationId);
  const chartAccounts = toChartAccounts(accounts);
  const existing = findAccountByExactName(chartAccounts, target.accountName);

  if (existing?.code) {
    const updates = mappingUpdatesForTarget(target, existing.code, settings);
    await persistMappingCodes(input.organizationId, updates);
    const linked = resolveSettlementAccount({
      organizationId: input.organizationId,
      paymentRail: input.paymentRail,
      collectionMethod: input.collectionMethod,
      paymentAsset: input.paymentAsset,
      settings: { ...settings, ...updates },
    });
    return {
      status: 'linked',
      xeroAccountCode: existing.code,
      created: false,
      resolution: linked,
    };
  }

  try {
    const accountCode = resolveAvailableAccountCode(chartAccounts, target.suggestedCode);
    const createdAccount = await createXeroHoldingAccount(
      input.organizationId,
      target,
      accountCode
    );
    const updates = mappingUpdatesForTarget(target, createdAccount.code, settings);
    await persistMappingCodes(input.organizationId, updates);

    loggers.xero.info('settlement_account_provisioned', {
      organizationId: input.organizationId,
      paymentRail: target.paymentRail,
      paymentAsset: target.paymentAsset,
      accountCode: createdAccount.code,
      accountName: createdAccount.name,
    });

    const linked = resolveSettlementAccount({
      organizationId: input.organizationId,
      paymentRail: input.paymentRail,
      collectionMethod: input.collectionMethod,
      paymentAsset: input.paymentAsset,
      settings: { ...settings, ...updates },
    });

    return {
      status: 'linked',
      xeroAccountCode: createdAccount.code,
      created: true,
      resolution: linked,
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const friendly = formatClearingAccountCreationError(raw);
    loggers.xero.error('settlement_account_provision_failed', error, {
      organizationId: input.organizationId,
      paymentRail: target.paymentRail,
      paymentAsset: target.paymentAsset,
      accountName: target.accountName,
    });

    return {
      status: 'manual_required',
      resolution,
      customerMessage: buildManualRequiredMessage({
        status: 'unmapped',
        target,
        guide: {
          ...guide,
          intro: friendly,
        },
      }),
    };
  }
}

/** Provision default holding accounts used during Xero setup (Stripe + shared digital). */
export async function provisionDefaultSettlementAccounts(organizationId: string) {
  const stripe = await provisionSettlementAccount({
    organizationId,
    paymentRail: 'stripe',
    paymentAsset: null,
  });

  const digital = await provisionSettlementAccount({
    organizationId,
    paymentRail: 'crypto',
    paymentAsset: null,
  });

  return { stripe, digital };
}

export { STRIPE_HOLDING, SHARED_DIGITAL_HOLDING };
