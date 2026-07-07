/**
 * Wise account-details adapter — mapper and currency resolution tests.
 */

import { describe, expect, it } from '@jest/globals';
import {
  fetchBankDetailsForCurrency,
  mapAccountDetailsEntryToWiseBankDetails,
  resolveBankDetailsForCurrency,
  selectAccountDetailsForCurrency,
  WiseAccountDetailsError,
  type WiseAccountDetailsEntry,
} from '@/lib/wise/wise-account-details';

const AUD_ACTIVE: WiseAccountDetailsEntry = {
  id: 9001,
  currency: { code: 'AUD', name: 'Australian Dollar' },
  status: 'ACTIVE',
  deprecated: false,
  receiveOptions: [
    {
      type: 'LOCAL',
      title: 'Local',
      details: [
        { type: 'ACCOUNT_HOLDER', title: 'Account holder', body: 'Acme Pty Ltd' },
        { type: 'BSB', title: 'BSB', body: '062-000' },
        { type: 'ACCOUNT_NUMBER', title: 'Account number', body: '12345678' },
        { type: 'BANK_NAME', title: 'Bank name', body: 'Commonwealth Bank' },
      ],
    },
  ],
};

const EUR_ACTIVE: WiseAccountDetailsEntry = {
  id: 9002,
  currency: { code: 'EUR', name: 'Euro' },
  status: 'ACTIVE',
  deprecated: false,
  receiveOptions: [
    {
      type: 'LOCAL',
      title: 'Local',
      details: [
        { type: 'ACCOUNT_HOLDER', title: 'Account holder', body: 'Acme GmbH' },
        { type: 'IBAN', title: 'IBAN', body: 'DE89 3704 0044 0532 0130 00' },
        { type: 'SWIFT_CODE', title: 'SWIFT/BIC', body: 'COBADEFFXXX' },
        {
          type: 'BANK_NAME_AND_ADDRESS',
          title: 'Bank name and address',
          body: 'Commerzbank\nKaiserplatz\nFrankfurt\nGermany\n60311',
        },
      ],
    },
    {
      type: 'INTERNATIONAL',
      title: 'International',
      details: [
        { type: 'IBAN', title: 'IBAN', body: 'DE89 3704 0044 0532 0130 00' },
        { type: 'SWIFT_CODE', title: 'SWIFT/BIC', body: 'COBADEFFXXX' },
      ],
    },
  ],
};

const GBP_ACTIVE: WiseAccountDetailsEntry = {
  id: 9003,
  currency: { code: 'GBP', name: 'British Pound' },
  status: 'ACTIVE',
  deprecated: false,
  receiveOptions: [
    {
      type: 'LOCAL',
      title: 'Local',
      details: [
        { type: 'ACCOUNT_HOLDER', title: 'Account holder', body: 'Acme Ltd' },
        { type: 'SORT_CODE', title: 'Sort code', body: '20-00-00' },
        { type: 'ACCOUNT_NUMBER', title: 'Account number', body: '55779911' },
        { type: 'IBAN', title: 'IBAN', body: 'GB33BUKB20201555779911' },
      ],
    },
  ],
};

const AUD_AVAILABLE: WiseAccountDetailsEntry = {
  id: null,
  currency: { code: 'AUD', name: 'Australian Dollar' },
  status: 'AVAILABLE',
  receiveOptions: [
    {
      type: 'LOCAL',
      details: [
        { type: 'ACCOUNT_HOLDER', body: 'Example Holder' },
        { type: 'BSB', body: '000-000' },
      ],
    },
  ],
};

const USD_ACTIVE: WiseAccountDetailsEntry = {
  id: 9004,
  currency: { code: 'USD', name: 'US Dollar' },
  status: 'ACTIVE',
  receiveOptions: [
    {
      type: 'LOCAL',
      details: [
        { type: 'ACCOUNT_HOLDER', body: 'US Entity' },
        { type: 'ROUTING_NUMBER', body: '026073150' },
        { type: 'ACCOUNT_NUMBER', body: '8310000001' },
      ],
    },
  ],
};

describe('mapAccountDetailsEntryToWiseBankDetails', () => {
  it('maps AUD LOCAL receive option fields', () => {
    const mapped = mapAccountDetailsEntryToWiseBankDetails(AUD_ACTIVE);
    expect(mapped).toEqual({
      id: 9001,
      currency: 'AUD',
      accountHolderName: 'Acme Pty Ltd',
      bankCode: '062-000',
      accountNumber: '12345678',
      bankName: 'Commonwealth Bank',
    });
  });

  it('maps EUR LOCAL receive option with IBAN, SWIFT, and bank address', () => {
    const mapped = mapAccountDetailsEntryToWiseBankDetails(EUR_ACTIVE);
    expect(mapped.id).toBe(9002);
    expect(mapped.currency).toBe('EUR');
    expect(mapped.accountHolderName).toBe('Acme GmbH');
    expect(mapped.iban).toBe('DE89 3704 0044 0532 0130 00');
    expect(mapped.swift).toBe('COBADEFFXXX');
    expect(mapped.bankName).toBe('Commerzbank');
    expect(mapped.bankAddress).toEqual({
      addressFirstLine: 'Kaiserplatz',
      city: 'Frankfurt',
      country: 'Germany',
      postCode: '60311',
    });
  });

  it('maps GBP LOCAL receive option with sort code and account number', () => {
    const mapped = mapAccountDetailsEntryToWiseBankDetails(GBP_ACTIVE);
    expect(mapped).toEqual({
      id: 9003,
      currency: 'GBP',
      accountHolderName: 'Acme Ltd',
      bankCode: '20-00-00',
      accountNumber: '55779911',
      iban: 'GB33BUKB20201555779911',
    });
  });

  it('prefers LOCAL over INTERNATIONAL receive option', () => {
    const mapped = mapAccountDetailsEntryToWiseBankDetails(EUR_ACTIVE);
    expect(mapped.accountHolderName).toBe('Acme GmbH');
  });
});

describe('selectAccountDetailsForCurrency', () => {
  it('selects ACTIVE entry for matching currency', () => {
    const selected = selectAccountDetailsForCurrency(
      [AUD_ACTIVE, EUR_ACTIVE, GBP_ACTIVE],
      'eur'
    );
    expect(selected).toBe(EUR_ACTIVE);
  });

  it('throws NO_MATCHING_CURRENCY when currency is absent', () => {
    expect(() =>
      selectAccountDetailsForCurrency([AUD_ACTIVE, EUR_ACTIVE], 'NZD')
    ).toThrow(WiseAccountDetailsError);

    try {
      selectAccountDetailsForCurrency([AUD_ACTIVE, EUR_ACTIVE], 'NZD');
    } catch (error) {
      expect(error).toBeInstanceOf(WiseAccountDetailsError);
      expect((error as WiseAccountDetailsError).code).toBe('NO_MATCHING_CURRENCY');
      expect((error as WiseAccountDetailsError).message).toContain('NZD');
    }
  });

  it('throws NOT_ISSUED when only AVAILABLE entry exists for currency', () => {
    expect(() => selectAccountDetailsForCurrency([AUD_AVAILABLE], 'AUD')).toThrow(
      WiseAccountDetailsError
    );

    try {
      selectAccountDetailsForCurrency([AUD_AVAILABLE], 'AUD');
    } catch (error) {
      expect((error as WiseAccountDetailsError).code).toBe('NOT_ISSUED');
      expect((error as WiseAccountDetailsError).message).toContain('AVAILABLE');
    }
  });

  it('throws NO_ACTIVE_DETAILS when matching currency has no ACTIVE or AVAILABLE entry', () => {
    const orphan: WiseAccountDetailsEntry = {
      id: 1,
      currency: { code: 'CAD' },
      status: 'ACTIVE',
      deprecated: true,
      receiveOptions: [],
    };

    try {
      selectAccountDetailsForCurrency([orphan], 'CAD');
    } catch (error) {
      expect((error as WiseAccountDetailsError).code).toBe('NO_ACTIVE_DETAILS');
    }
  });

  it('skips deprecated ACTIVE entries and uses non-deprecated ACTIVE', () => {
    const deprecatedAud: WiseAccountDetailsEntry = {
      ...AUD_ACTIVE,
      id: 1,
      deprecated: true,
    };
    const currentAud: WiseAccountDetailsEntry = {
      ...AUD_ACTIVE,
      id: 2,
      deprecated: false,
      receiveOptions: [
        {
          type: 'LOCAL',
          details: [{ type: 'ACCOUNT_HOLDER', body: 'Current Account' }],
        },
      ],
    };

    const selected = selectAccountDetailsForCurrency([deprecatedAud, currentAud], 'AUD');
    expect(selected.id).toBe(2);
  });
});

describe('resolveBankDetailsForCurrency', () => {
  it('returns a single WiseBankDetails array element for ACTIVE AUD', () => {
    const result = resolveBankDetailsForCurrency([AUD_ACTIVE, USD_ACTIVE], 'AUD');
    expect(result).toHaveLength(1);
    expect(result[0].currency).toBe('AUD');
    expect(result[0].accountNumber).toBe('12345678');
  });
});

describe('fetchBankDetailsForCurrency', () => {
  it('uses injected fetcher and maps mocked Wise API response', async () => {
    const fetcher = async () => [AUD_ACTIVE, EUR_ACTIVE, GBP_ACTIVE];

    const result = await fetchBankDetailsForCurrency('84420198', 'GBP', fetcher);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 9003,
      currency: 'GBP',
      accountHolderName: 'Acme Ltd',
      bankCode: '20-00-00',
    });
  });

  it('propagates NOT_ISSUED from mocked AVAILABLE-only response', async () => {
    const fetcher = async () => [AUD_AVAILABLE];

    await expect(fetchBankDetailsForCurrency('84420198', 'AUD', fetcher)).rejects.toMatchObject({
      code: 'NOT_ISSUED',
    });
  });

  it('propagates NO_MATCHING_CURRENCY from mocked response', async () => {
    const fetcher = async () => [EUR_ACTIVE];

    await expect(fetchBankDetailsForCurrency('84420198', 'AUD', fetcher)).rejects.toMatchObject({
      code: 'NO_MATCHING_CURRENCY',
    });
  });
});
