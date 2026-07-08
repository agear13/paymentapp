import {
  RECOMMENDED_CLEARING_ACCOUNTS,
  RECOMMENDED_STANDARD_MAPPINGS,
  type RecommendedClearingAccountConfig,
  type RecommendedStandardMappingConfig,
  type XeroMappingField,
} from '@/lib/accounting/recommended-accounting-config';

export type AccountingChartAccount = {
  code: string;
  name: string;
  type: string;
  status?: string | null;
};

export type RecommendedMappings = Partial<Record<XeroMappingField, string>>;

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function isActive(account: AccountingChartAccount): boolean {
  const status = normalize(account.status);
  return !status || status === 'active';
}

export function findAccountByExactName(
  accounts: AccountingChartAccount[],
  accountName: string
): AccountingChartAccount | undefined {
  const target = normalize(accountName);
  return accounts.find(
    (account) => isActive(account) && normalize(account.name) === target
  );
}

export function findClearingAccount(
  accounts: AccountingChartAccount[],
  config: RecommendedClearingAccountConfig
): AccountingChartAccount | undefined {
  return findAccountByExactName(accounts, config.accountName);
}

function findByPreferredCode(
  accounts: AccountingChartAccount[],
  preferredCodes: readonly string[],
  allowedTypes: readonly string[]
): AccountingChartAccount | undefined {
  const allowed = new Set(allowedTypes.map((type) => type.toUpperCase()));
  const active = accounts.filter(isActive);

  for (const code of preferredCodes) {
    const match = active.find(
      (account) =>
        account.code.trim() === code &&
        (allowed.size === 0 || allowed.has(account.type.trim().toUpperCase()))
    );
    if (match) return match;
  }

  return undefined;
}

function findByPreferredName(
  accounts: AccountingChartAccount[],
  preferredNames: readonly string[],
  allowedTypes: readonly string[]
): AccountingChartAccount | undefined {
  const allowed = new Set(allowedTypes.map((type) => type.toUpperCase()));
  const candidates = accounts.filter(
    (account) =>
      isActive(account) &&
      (allowed.size === 0 || allowed.has(account.type.trim().toUpperCase()))
  );

  for (const preferredName of preferredNames) {
    const target = normalize(preferredName);
    const exact = candidates.find((account) => normalize(account.name) === target);
    if (exact) return exact;

    const partial = candidates.find((account) => normalize(account.name).includes(target));
    if (partial) return partial;
  }

  return undefined;
}

export function resolveStandardMapping(
  accounts: AccountingChartAccount[],
  config: RecommendedStandardMappingConfig
): string | undefined {
  const byCode = findByPreferredCode(
    accounts,
    config.preferredCodes,
    config.preferredAccountTypes
  );
  if (byCode?.code) return byCode.code;

  const byName = findByPreferredName(
    accounts,
    config.preferredNames,
    config.preferredAccountTypes
  );
  return byName?.code;
}

export function detectClearingAccountMappings(
  accounts: AccountingChartAccount[]
): RecommendedMappings {
  const mappings: RecommendedMappings = {};

  for (const config of RECOMMENDED_CLEARING_ACCOUNTS) {
    const match = findClearingAccount(accounts, config);
    if (match?.code) {
      mappings[config.mappingField] = match.code;
    }
  }

  return mappings;
}

export function getMissingRecommendedClearingAccounts(
  accounts: AccountingChartAccount[],
  configs: readonly RecommendedClearingAccountConfig[] = RECOMMENDED_CLEARING_ACCOUNTS
): RecommendedClearingAccountConfig[] {
  return configs.filter((config) => !findClearingAccount(accounts, config));
}

export function buildRecommendedMappings(
  accounts: AccountingChartAccount[],
  currentMappings: RecommendedMappings,
  options?: { includeStablecoinRails?: boolean }
): RecommendedMappings {
  const includeStablecoinRails = options?.includeStablecoinRails ?? true;
  const result: RecommendedMappings = {};

  for (const config of RECOMMENDED_STANDARD_MAPPINGS) {
    if (currentMappings[config.mappingField]) continue;
    const code = resolveStandardMapping(accounts, config);
    if (code) result[config.mappingField] = code;
  }

  for (const config of RECOMMENDED_CLEARING_ACCOUNTS) {
    if (config.requiresStablecoinRail && !includeStablecoinRails) continue;
    if (currentMappings[config.mappingField]) continue;
    const match = findClearingAccount(accounts, config);
    if (match?.code) result[config.mappingField] = match.code;
  }

  return result;
}

export function mergeRecommendedMappingsIntoEmptyFields(
  currentMappings: RecommendedMappings,
  recommended: RecommendedMappings
): RecommendedMappings {
  const merged = { ...currentMappings };
  for (const [field, code] of Object.entries(recommended) as [XeroMappingField, string][]) {
    if (!merged[field]) {
      merged[field] = code;
    }
  }
  return merged;
}

export function resolveAvailableAccountCode(
  accounts: AccountingChartAccount[],
  preferredCode: string,
  fallbackStart = 1050,
  fallbackEnd = 1099
): string {
  const usedCodes = new Set(accounts.map((account) => account.code.trim()));
  if (!usedCodes.has(preferredCode)) {
    return preferredCode;
  }

  for (let code = fallbackStart; code <= fallbackEnd; code += 1) {
    const candidate = String(code);
    if (!usedCodes.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('No available account codes in the recommended clearing range');
}

export function getRecommendedAccountDisplayName(
  config: RecommendedClearingAccountConfig | RecommendedStandardMappingConfig,
  accounts: AccountingChartAccount[],
  mappedCode?: string
): string {
  if (mappedCode) {
    const account = accounts.find((item) => item.code === mappedCode);
    if (account) return account.name;
  }

  if ('accountName' in config) {
    return config.accountName;
  }

  return config.label;
}

export function hasAnyRecommendedMappingAvailable(
  accounts: AccountingChartAccount[],
  currentMappings: RecommendedMappings,
  includeStablecoinRails: boolean
): boolean {
  const recommended = buildRecommendedMappings(accounts, currentMappings, {
    includeStablecoinRails,
  });
  return Object.keys(recommended).length > 0;
}
