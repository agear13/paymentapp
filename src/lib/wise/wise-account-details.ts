/**
 * Wise Account Details API adapter (v1).
 * Isolates GET /v1/profiles/{profileId}/account-details and response mapping.
 * Upgrade Wise receive-details API versions here only.
 */

/** Stable DTO consumed by checkout UI and payment_events metadata. */
export interface WiseBankDetails {
  id: number;
  currency: string;
  bankCode?: string;
  accountNumber?: string;
  swift?: string;
  iban?: string;
  bankName?: string;
  accountHolderName?: string;
  bankAddress?: {
    addressFirstLine?: string;
    city?: string;
    country?: string;
    postCode?: string;
  };
}

/** Supported v1 path — change here when Wise upgrades account-details API. */
export const WISE_ACCOUNT_DETAILS_PATH = (profileId: string) =>
  `/profiles/${profileId}/account-details`;

export type WiseAccountDetailsStatus = 'AVAILABLE' | 'ACTIVE';

export type WiseReceiveOptionType = 'LOCAL' | 'INTERNATIONAL';

export interface WiseAccountDetailsCurrency {
  code: string;
  name?: string;
}

export interface WiseReceiveOptionDetail {
  type: string;
  title?: string;
  body?: string;
  hidden?: boolean;
}

export interface WiseReceiveOption {
  type: WiseReceiveOptionType;
  title?: string;
  details?: WiseReceiveOptionDetail[];
}

export interface WiseAccountDetailsEntry {
  id: number | null;
  currency: WiseAccountDetailsCurrency;
  title?: string;
  subtitle?: string;
  status: WiseAccountDetailsStatus;
  deprecated?: boolean;
  receiveOptions?: WiseReceiveOption[];
}

export type WiseAccountDetailsFetcher = (
  profileId: string
) => Promise<WiseAccountDetailsEntry[]>;

export class WiseAccountDetailsError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'NO_MATCHING_CURRENCY'
      | 'NOT_ISSUED'
      | 'NO_ACTIVE_DETAILS'
  ) {
    super(message);
    this.name = 'WiseAccountDetailsError';
  }
}

function normalizeCurrencyCode(currency: string): string {
  return currency.trim().toUpperCase();
}

function entriesForCurrency(
  entries: WiseAccountDetailsEntry[],
  currency: string
): WiseAccountDetailsEntry[] {
  const target = normalizeCurrencyCode(currency);
  return entries.filter(
    (entry) => normalizeCurrencyCode(entry.currency?.code ?? '') === target
  );
}

/**
 * Select the ACTIVE account-details entry for a currency, or throw a specific error.
 */
export function selectAccountDetailsForCurrency(
  entries: WiseAccountDetailsEntry[],
  currency: string
): WiseAccountDetailsEntry {
  const matches = entriesForCurrency(entries, currency);
  if (matches.length === 0) {
    throw new WiseAccountDetailsError(
      `No Wise account details found for currency ${normalizeCurrencyCode(currency)}`,
      'NO_MATCHING_CURRENCY'
    );
  }

  const active = matches.find((entry) => entry.status === 'ACTIVE' && entry.deprecated !== true);
  if (active) {
    return active;
  }

  const available = matches.find((entry) => entry.status === 'AVAILABLE');
  if (available) {
    throw new WiseAccountDetailsError(
      `Wise bank account details for ${normalizeCurrencyCode(currency)} are not yet issued (status AVAILABLE). Complete setup in Wise.`,
      'NOT_ISSUED'
    );
  }

  throw new WiseAccountDetailsError(
    `No ACTIVE Wise account details for ${normalizeCurrencyCode(currency)}`,
    'NO_ACTIVE_DETAILS'
  );
}

function pickReceiveOption(entry: WiseAccountDetailsEntry): WiseReceiveOption | null {
  const options = entry.receiveOptions ?? [];
  return (
    options.find((option) => option.type === 'LOCAL') ??
    options.find((option) => option.type === 'INTERNATIONAL') ??
    options[0] ??
    null
  );
}

function applyDetailField(
  target: Partial<WiseBankDetails>,
  detail: WiseReceiveOptionDetail
): void {
  const body = detail.body?.trim();
  if (!body || detail.hidden) return;

  const type = detail.type.toUpperCase();
  switch (type) {
    case 'IBAN':
      target.iban = body;
      break;
    case 'SWIFT_CODE':
    case 'BIC':
    case 'SWIFT/BIC':
      target.swift = body;
      break;
    case 'ACCOUNT_NUMBER':
      target.accountNumber = body;
      break;
    case 'BSB':
    case 'SORT_CODE':
    case 'BANK_CODE':
    case 'ROUTING_NUMBER':
      target.bankCode = body;
      break;
    case 'ACCOUNT_HOLDER':
      target.accountHolderName = body;
      break;
    case 'BANK_NAME':
      target.bankName = body;
      break;
    case 'BANK_NAME_AND_ADDRESS': {
      const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length > 0) {
        target.bankName = lines[0];
      }
      if (lines.length > 1) {
        target.bankAddress = {
          addressFirstLine: lines[1],
          city: lines[2],
          country: lines[3],
          postCode: lines[4],
        };
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Map a Wise account-details entry to our stable WiseBankDetails DTO.
 */
export function mapAccountDetailsEntryToWiseBankDetails(
  entry: WiseAccountDetailsEntry
): WiseBankDetails {
  const receiveOption = pickReceiveOption(entry);
  const mapped: Partial<WiseBankDetails> = {
    id: entry.id ?? 0,
    currency: normalizeCurrencyCode(entry.currency.code),
  };

  for (const detail of receiveOption?.details ?? []) {
    applyDetailField(mapped, detail);
  }

  return mapped as WiseBankDetails;
}

/**
 * Resolve bank details for a currency from Wise account-details entries.
 */
export function resolveBankDetailsForCurrency(
  entries: WiseAccountDetailsEntry[],
  currency: string
): WiseBankDetails[] {
  const selected = selectAccountDetailsForCurrency(entries, currency);
  return [mapAccountDetailsEntryToWiseBankDetails(selected)];
}

/**
 * Fetch and map profile account details for invoice / checkout payer instructions.
 */
export async function fetchBankDetailsForCurrency(
  profileId: string,
  currency: string,
  fetchAccountDetails: WiseAccountDetailsFetcher
): Promise<WiseBankDetails[]> {
  const entries = await fetchAccountDetails(profileId);
  return resolveBankDetailsForCurrency(entries, currency);
}
