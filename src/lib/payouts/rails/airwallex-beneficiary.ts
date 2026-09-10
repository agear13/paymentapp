import type { CanonicalPayoutDestination } from '@/lib/payouts/rails/types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function countryFromIban(iban: string): string | null {
  const prefix = iban.slice(0, 2).toUpperCase();
  return /^[A-Z]{2}$/.test(prefix) ? prefix : null;
}

/**
 * Build an Airwallex beneficiary from payout_methods.details (or a saved
 * beneficiary_id). Does not invent provider columns. BSB implies AU routing;
 * IBAN prefix implies country. entity_type defaults to COMPANY only when the
 * destination has a single account name and no personal-name split.
 */
export function buildAirwallexBeneficiary(
  destination: CanonicalPayoutDestination
): { beneficiary_id: string } | { beneficiary: Record<string, unknown> } | null {
  const details = destination.details ?? null;
  const beneficiaryId = readString(details, 'beneficiary_id', 'beneficiaryId');
  if (beneficiaryId) return { beneficiary_id: beneficiaryId };

  const prebuilt = asRecord(details?.beneficiary);
  if (prebuilt) return { beneficiary: prebuilt };

  const accountName = readString(details, 'account_name', 'accountName');
  const accountNumber =
    readString(details, 'account_number', 'accountNumber') ??
    (destination.handle && /^[A-Za-z0-9]{4,34}$/.test(destination.handle)
      ? destination.handle
      : null);
  const iban = readString(details, 'iban');
  const bsb = readString(details, 'bsb')?.replace(/\D/g, '') ?? null;
  const aba = readString(details, 'aba', 'routingNumber', 'routing_number');
  const sortCode = readString(details, 'sort_code', 'sortCode')?.replace(/\D/g, '') ?? null;
  const swift = readString(details, 'swift_code', 'swift', 'bic');
  const accountCurrency = readString(details, 'account_currency', 'accountCurrency');
  const bankCountry =
    readString(details, 'bank_country_code', 'bankCountry', 'bankCountryCode') ??
    (bsb ? 'AU' : null) ??
    (iban ? countryFromIban(iban) : null);

  if (!accountName || (!accountNumber && !iban)) return null;

  const bankDetails: Record<string, unknown> = {
    account_name: accountName,
  };
  if (accountCurrency) bankDetails.account_currency = accountCurrency.toUpperCase();
  if (accountNumber) bankDetails.account_number = accountNumber;
  if (iban) bankDetails.iban = iban;
  if (swift) bankDetails.swift_code = swift;
  if (bankCountry) bankDetails.bank_country_code = bankCountry.toUpperCase();
  if (bsb) {
    bankDetails.account_routing_type1 = 'bsb';
    bankDetails.account_routing_value1 = bsb;
  } else if (aba) {
    bankDetails.account_routing_type1 = 'aba';
    bankDetails.account_routing_value1 = aba;
  } else if (sortCode) {
    bankDetails.account_routing_type1 = 'sort_code';
    bankDetails.account_routing_value1 = sortCode;
  }

  const firstName = readString(details, 'first_name', 'firstName');
  const lastName = readString(details, 'last_name', 'lastName');
  const companyName = readString(details, 'company_name', 'companyName') ?? accountName;
  const entityType =
    readString(details, 'entity_type', 'entityType')?.toUpperCase() === 'PERSONAL'
      ? 'PERSONAL'
      : firstName && lastName && !readString(details, 'company_name', 'companyName')
        ? 'PERSONAL'
        : 'COMPANY';

  const beneficiary: Record<string, unknown> = {
    entity_type: entityType,
    bank_details: bankDetails,
  };
  if (entityType === 'PERSONAL') {
    beneficiary.first_name = firstName ?? accountName;
    if (lastName) beneficiary.last_name = lastName;
  } else {
    beneficiary.company_name = companyName;
  }

  const address = asRecord(details?.address);
  const street = readString(address, 'street_address', 'street', 'line1') ?? readString(details, 'street', 'street_address');
  const city = readString(address, 'city') ?? readString(details, 'city');
  const state = readString(address, 'state') ?? readString(details, 'state');
  const postcode = readString(address, 'postcode', 'postal_code', 'postcode') ?? readString(details, 'postcode', 'postalCode');
  const countryCode =
    readString(address, 'country_code', 'country') ??
    readString(details, 'country_code', 'country') ??
    bankCountry;
  if (street || city || countryCode) {
    beneficiary.address = {
      ...(street ? { street_address: street } : {}),
      ...(city ? { city } : {}),
      ...(state ? { state } : {}),
      ...(postcode ? { postcode } : {}),
      ...(countryCode ? { country_code: countryCode.toUpperCase() } : {}),
    };
  }

  return { beneficiary };
}
