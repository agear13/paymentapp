import 'server-only';

import { Account, AccountType } from 'xero-node';
import { loggers } from '@/lib/logger';
import {
  RECOMMENDED_CLEARING_ACCOUNTS,
  type RecommendedClearingAccountConfig,
} from '@/lib/accounting/recommended-accounting-config';
import {
  findClearingAccount,
  getMissingRecommendedClearingAccounts,
  resolveAvailableAccountCode,
  type AccountingChartAccount,
} from '@/lib/accounting/recommended-clearing-accounts-service';
import { getXeroClient } from './client';
import { getActiveConnection } from './connection-service';
import { applyConnectionToXeroClient } from './apply-connection-token-set';
import { fetchXeroAccounts, type XeroAccount } from './accounts-service';

export type CreatedClearingAccountResult = {
  config: RecommendedClearingAccountConfig;
  account: XeroAccount;
  created: boolean;
};

export type CreateRecommendedClearingAccountsResult = {
  created: CreatedClearingAccountResult[];
  existing: CreatedClearingAccountResult[];
  failed: Array<{ config: RecommendedClearingAccountConfig; error: string }>;
};

function toChartAccounts(accounts: XeroAccount[]): AccountingChartAccount[] {
  return accounts.map((account) => ({
    code: account.code,
    name: account.name,
    type: account.type,
    status: account.status,
  }));
}

async function createXeroClearingAccount(
  organizationId: string,
  config: RecommendedClearingAccountConfig,
  accountCode: string
): Promise<XeroAccount> {
  const connection = await getActiveConnection(organizationId);
  if (!connection) {
    throw new Error('No active Xero connection found');
  }

  const xeroClient = getXeroClient();
  await applyConnectionToXeroClient(xeroClient, connection, 'create_clearing_account');
  await xeroClient.updateTenants();

  const account = new Account();
  account.name = config.accountName;
  account.code = accountCode;
  account.type = AccountType.CURRENT;
  account._class = Account.ClassEnum.ASSET;
  account.description = config.description;
  account.enablePaymentsToAccount = true;
  account.status = Account.StatusEnum.ACTIVE;

  const response = await xeroClient.accountingApi.createAccount(
    connection.tenantId,
    account,
    `provvypay-clearing-${config.rail.toLowerCase()}-${accountCode}`
  );

  const created = response.body.accounts?.[0];
  if (!created?.accountID || !created.code || !created.name) {
    throw new Error(`Xero did not return a created account for ${config.accountName}`);
  }

  return {
    accountID: created.accountID,
    code: created.code,
    name: created.name,
    type: created.type != null ? String(created.type) : AccountType.CURRENT,
    taxType: created.taxType,
    status: created.status != null ? String(created.status) : 'ACTIVE',
    class: created._class != null ? String(created._class) : 'ASSET',
  };
}

export async function createRecommendedClearingAccounts(
  organizationId: string,
  configs: readonly RecommendedClearingAccountConfig[] = RECOMMENDED_CLEARING_ACCOUNTS
): Promise<CreateRecommendedClearingAccountsResult> {
  const { accounts } = await fetchXeroAccounts(organizationId);
  const chartAccounts = toChartAccounts(accounts);
  const missing = getMissingRecommendedClearingAccounts(chartAccounts, configs);

  const created: CreatedClearingAccountResult[] = [];
  const existing: CreatedClearingAccountResult[] = [];
  const failed: CreateRecommendedClearingAccountsResult['failed'] = [];

  for (const config of configs) {
    const match = findClearingAccount(chartAccounts, config);
    if (match) {
      const account = accounts.find((item) => item.code === match.code);
      if (account) {
        existing.push({ config, account, created: false });
      }
      continue;
    }

    if (!missing.some((item) => item.mappingField === config.mappingField)) {
      continue;
    }

    try {
      const accountCode = resolveAvailableAccountCode(chartAccounts, config.suggestedCode);
      const account = await createXeroClearingAccount(organizationId, config, accountCode);
      chartAccounts.push({
        code: account.code,
        name: account.name,
        type: account.type,
        status: account.status,
      });
      created.push({ config, account, created: true });

      loggers.xero.info('xero_clearing_account_created', {
        organizationId,
        rail: config.rail,
        accountCode: account.code,
        accountName: account.name,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ config, error: message });
      loggers.xero.error('xero_clearing_account_create_failed', error, {
        organizationId,
        rail: config.rail,
        accountName: config.accountName,
      });
    }
  }

  return { created, existing, failed };
}
