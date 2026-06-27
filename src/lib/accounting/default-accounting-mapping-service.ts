export type AccountingAccount = {
  code: string;
  name: string;
  type: string;
  status?: string | null;
};

export type DefaultAccountingMappings = {
  revenueAccountCode?: string;
  receivableAccountCode?: string;
  processorFeeExpenseAccountCode?: string;
  stripeClearingAccountCode?: string;
};

export type AccountingMappingRecommendation = {
  target: keyof DefaultAccountingMappings;
  message: string;
};

export type DefaultAccountingMappingResult = {
  mappings: DefaultAccountingMappings;
  recommendations: AccountingMappingRecommendation[];
};

type MappingRule = {
  target: keyof DefaultAccountingMappings;
  accountTypes: readonly string[];
  preferredNames: readonly string[];
  recommendation: string;
};

const STANDARD_MAPPING_RULES: readonly MappingRule[] = [
  {
    target: 'revenueAccountCode',
    accountTypes: ['SALES', 'REVENUE', 'INCOME'],
    preferredNames: ['Sales', 'Revenue', 'Income'],
    recommendation: 'Revenue could not be matched. Select a sales or revenue account later.',
  },
  {
    target: 'receivableAccountCode',
    accountTypes: ['CURRENT', 'CURRLIAB', 'ASSET', 'CURRENT_ASSET', 'ACCOUNTS_RECEIVABLE'],
    preferredNames: ['Accounts Receivable', 'Trade Debtors', 'Debtors'],
    recommendation:
      'Accounts Receivable could not be matched. Your accountant can configure this later.',
  },
  {
    target: 'processorFeeExpenseAccountCode',
    accountTypes: ['EXPENSE', 'OVERHEADS'],
    preferredNames: ['Bank Fees', 'Merchant Fees', 'Payment Processing Fees', 'Stripe Fees'],
    recommendation:
      'Processor Fees could not be matched. Select a bank fees or merchant fees expense account later.',
  },
  {
    target: 'stripeClearingAccountCode',
    accountTypes: ['BANK', 'CURRENT', 'CURRLIAB', 'ASSET', 'LIABILITY', 'CURRENT_ASSET'],
    preferredNames: ['Stripe Clearing', 'Stripe', 'Payment Clearing', 'Merchant Clearing', 'Clearing'],
    recommendation:
      'Stripe Clearing could not be matched. You may continue using Provvypay; your accountant can configure this later.',
  },
];

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function isActive(account: AccountingAccount): boolean {
  const status = normalize(account.status);
  return !status || status === 'active';
}

function accountTypeMatches(account: AccountingAccount, allowedTypes: readonly string[]): boolean {
  const type = account.type.trim().toUpperCase();
  return allowedTypes.some((allowed) => allowed.toUpperCase() === type);
}

function findByPreferredName(
  accounts: AccountingAccount[],
  preferredNames: readonly string[]
): AccountingAccount | undefined {
  for (const preferredName of preferredNames) {
    const exact = accounts.find((account) => normalize(account.name) === normalize(preferredName));
    if (exact) return exact;

    const partial = accounts.find((account) => normalize(account.name).includes(normalize(preferredName)));
    if (partial) return partial;
  }
  return undefined;
}

export class DefaultAccountingMappingService {
  resolve(accounts: AccountingAccount[]): DefaultAccountingMappingResult {
    const activeAccounts = accounts.filter(isActive);
    const mappings: DefaultAccountingMappings = {};
    const recommendations: AccountingMappingRecommendation[] = [];

    for (const rule of STANDARD_MAPPING_RULES) {
      const candidates = activeAccounts.filter((account) =>
        accountTypeMatches(account, rule.accountTypes)
      );
      const match = findByPreferredName(candidates, rule.preferredNames);

      if (match?.code) {
        mappings[rule.target] = match.code;
      } else {
        recommendations.push({
          target: rule.target,
          message: rule.recommendation,
        });
      }
    }

    return { mappings, recommendations };
  }
}
