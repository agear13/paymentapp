import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import {
  DefaultAccountingMappingService,
  type DefaultAccountingMappings,
} from '@/lib/accounting/default-accounting-mapping-service';
import { fetchXeroAccounts, type XeroAccount } from './accounts-service';

type XeroMappingFields = {
  xero_revenue_account_id: string | null;
  xero_receivable_account_id: string | null;
  xero_stripe_clearing_account_id: string | null;
  xero_hbar_clearing_account_id: string | null;
  xero_usdc_clearing_account_id: string | null;
  xero_usdt_clearing_account_id: string | null;
  xero_audd_clearing_account_id: string | null;
  xero_wise_clearing_account_id: string | null;
  xero_fee_expense_account_id: string | null;
};

export type XeroDefaultMappingBootstrapResult = {
  status: 'applied' | 'skipped_existing' | 'no_settings' | 'no_matches' | 'failed';
  appliedMappings: Partial<XeroMappingFields>;
  recommendations: string[];
};

const XERO_MAPPING_FIELDS = [
  'xero_revenue_account_id',
  'xero_receivable_account_id',
  'xero_stripe_clearing_account_id',
  'xero_hbar_clearing_account_id',
  'xero_usdc_clearing_account_id',
  'xero_usdt_clearing_account_id',
  'xero_audd_clearing_account_id',
  'xero_wise_clearing_account_id',
  'xero_fee_expense_account_id',
] as const satisfies readonly (keyof XeroMappingFields)[];

function hasAnyMapping(settings: XeroMappingFields): boolean {
  return XERO_MAPPING_FIELDS.some((field) => Boolean(settings[field]?.trim()));
}

function toProviderAccounts(accounts: XeroAccount[]) {
  return accounts.map((account) => ({
    code: account.code,
    name: account.name,
    type: account.type,
    status: account.status,
  }));
}

function toXeroMappingFields(
  mappings: DefaultAccountingMappings
): Partial<XeroMappingFields> {
  return {
    ...(mappings.revenueAccountCode
      ? { xero_revenue_account_id: mappings.revenueAccountCode }
      : {}),
    ...(mappings.receivableAccountCode
      ? { xero_receivable_account_id: mappings.receivableAccountCode }
      : {}),
    ...(mappings.stripeClearingAccountCode
      ? { xero_stripe_clearing_account_id: mappings.stripeClearingAccountCode }
      : {}),
    ...(mappings.processorFeeExpenseAccountCode
      ? { xero_fee_expense_account_id: mappings.processorFeeExpenseAccountCode }
      : {}),
  };
}

export async function applyXeroDefaultAccountingMappingsIfEmpty(
  organizationId: string
): Promise<XeroDefaultMappingBootstrapResult> {
  try {
    const settings = await prisma.merchant_settings.findFirst({
      where: { organization_id: organizationId },
      select: Object.fromEntries(XERO_MAPPING_FIELDS.map((field) => [field, true])) as Record<
        keyof XeroMappingFields,
        true
      >,
    });

    if (!settings) {
      loggers.xero.warn('xero_default_mappings_no_merchant_settings', { organizationId });
      return { status: 'no_settings', appliedMappings: {}, recommendations: [] };
    }

    if (hasAnyMapping(settings)) {
      loggers.xero.info('xero_default_mappings_skipped_existing', { organizationId });
      return { status: 'skipped_existing', appliedMappings: {}, recommendations: [] };
    }

    const { accounts } = await fetchXeroAccounts(organizationId);
    const resolver = new DefaultAccountingMappingService();
    const result = resolver.resolve(toProviderAccounts(accounts));
    const appliedMappings = toXeroMappingFields(result.mappings);
    const updateData = {
      ...appliedMappings,
      updated_at: new Date(),
    };

    if (Object.keys(appliedMappings).length === 0) {
      loggers.xero.warn('xero_default_mappings_no_matches', {
        organizationId,
        recommendations: result.recommendations.map((item) => item.message),
      });
      return {
        status: 'no_matches',
        appliedMappings,
        recommendations: result.recommendations.map((item) => item.message),
      };
    }

    await prisma.merchant_settings.updateMany({
      where: { organization_id: organizationId },
      data: updateData,
    });

    loggers.xero.info('xero_default_mappings_applied', {
      organizationId,
      appliedFields: Object.keys(appliedMappings),
      recommendations: result.recommendations.map((item) => item.message),
    });

    return {
      status: 'applied',
      appliedMappings,
      recommendations: result.recommendations.map((item) => item.message),
    };
  } catch (error) {
    loggers.xero.error('xero_default_mappings_failed', error, { organizationId });
    return { status: 'failed', appliedMappings: {}, recommendations: [] };
  }
}
