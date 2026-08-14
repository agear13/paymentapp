import {
  CANONICAL_HOLDING_ACCOUNT_NAMES,
  HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES,
  STRIPE_HOLDING_CREATE_IN_XERO_GUIDE,
  XERO_CREATE_ACCOUNT_IN_XERO_GUIDE,
  XERO_GUIDE_FIELD_CLASSIFICATION_LABELS,
  isDetailedHoldingAccountGuide,
  resolveCreateAccountInXeroGuide,
} from '@/lib/xero/xero-holding-account-guides';

const AUTOMATIC_BANK_RECONCILIATION_CLAIMS = [
  /automatically clears/i,
  /automatic reconciliation/i,
  /automatically matched/i,
  /clears the holding balance/i,
  /Provvy clears/i,
  /automatic matching/i,
];

const EXPECTED_ACCOUNTS = [
  { name: 'Stripe Holding', code: '1050' },
  { name: 'Wise Holding', code: '1055' },
  { name: 'Digital Asset Holding', code: '1060' },
  { name: 'HBAR Holding', code: '1051' },
  { name: 'USDC Holding', code: '1052' },
  { name: 'USDT Holding', code: '1053' },
  { name: 'AUDD Holding', code: '1054' },
] as const;

function fieldValue(guide: (typeof HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES)[string], label: string) {
  return guide.createFields.find((field) => field.label === label);
}

function allGuideText(guide: (typeof HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES)[string]): string {
  return [
    guide.whenYouNeedThis,
    ...guide.steps,
    ...guide.createFields.map((f) => `${f.label} ${f.value}`),
    ...guide.closingSteps,
    guide.whySettings.body,
    guide.whySettings.taxClarification ?? '',
    guide.accountingNote.body,
    guide.afterCreate,
  ].join(' ');
}

describe('HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES', () => {
  it('defines all seven canonical holding accounts', () => {
    expect(CANONICAL_HOLDING_ACCOUNT_NAMES).toEqual(EXPECTED_ACCOUNTS.map((a) => a.name));
    expect(Object.keys(HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES)).toHaveLength(7);
  });

  it.each(EXPECTED_ACCOUNTS)('provides detailed guide for $name with code $code', ({ name, code }) => {
    const guide = HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES[name];
    expect(guide).toBeDefined();
    expect(isDetailedHoldingAccountGuide(guide)).toBe(true);

    expect(fieldValue(guide, 'Name')?.value).toBe(name);
    expect(fieldValue(guide, 'Account type')?.value).toBe('Current Asset');
    expect(fieldValue(guide, 'Code')?.value).toBe(`${code} if available`);
    expect(fieldValue(guide, 'Enable payments to this account')?.value).toBe('Yes');
    expect(fieldValue(guide, 'Show on Dashboard Watchlist')?.value).toBe('No');
    expect(fieldValue(guide, 'Show in Expense Claims')?.value).toBe('No');

    expect(fieldValue(guide, 'Account type')?.classification).toBe('required_for_provvvy');
    expect(fieldValue(guide, 'Enable payments to this account')?.classification).toBe(
      'required_for_provvvy'
    );
    expect(fieldValue(guide, 'Show on Dashboard Watchlist')?.classification).toBe('do_not_enable');
    expect(fieldValue(guide, 'Show in Expense Claims')?.classification).toBe('do_not_enable');
    expect(fieldValue(guide, 'Name')?.classification).toBe('recommended');
    expect(fieldValue(guide, 'Code')?.classification).toBe('recommended');

    const taxField = fieldValue(guide, 'Tax');
    expect(taxField?.value).toMatch(/BAS Excluded/i);
    expect(taxField?.value).toMatch(/recommended/i);
    expect(taxField?.value).toMatch(/accountant/i);
    expect(taxField?.classification).toBe('confirm_with_accountant');

    expect(guide.whySettings.title).toBe('Why these settings?');
    expect(guide.accountingNote.title).toBe('Accounting / reconciliation note');
    expect(guide.accountingNote.body).toMatch(/accountant if you're unsure/i);
  });

  it.each(EXPECTED_ACCOUNTS)(
    'does not claim automatic bank reconciliation for $name',
    ({ name }) => {
      const guide = HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES[name];
      const text = allGuideText(guide);
      for (const pattern of AUTOMATIC_BANK_RECONCILIATION_CLAIMS) {
        expect(text).not.toMatch(pattern);
      }
      expect(text).toMatch(/not posted automatically by Provvy/i);
    }
  );

  it('uses canonical Holding names only — not legacy Clearing names in primary fields', () => {
    for (const { name } of EXPECTED_ACCOUNTS) {
      expect(name).not.toMatch(/Clearing$/);
      expect(fieldValue(HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES[name], 'Name')?.value).not.toMatch(
        /Clearing$/
      );
    }
  });
});

describe('account-specific whenYouNeedThis copy', () => {
  it('describes Stripe card payments', () => {
    expect(HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES['Stripe Holding'].whenYouNeedThis).toMatch(
      /Stripe/i
    );
  });

  it('describes Wise and manual bank transfers', () => {
    expect(HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES['Wise Holding'].whenYouNeedThis).toMatch(
      /Wise|manual bank/i
    );
  });

  it('describes shared digital asset setup', () => {
    const guide = HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES['Digital Asset Holding'];
    expect(guide.whenYouNeedThis).toMatch(/shared|crypto|stablecoin/i);
    expect(guide.whySettings.body).toMatch(/multiple digital assets|HBAR|USDC|USDT|AUDD/i);
    expect(guide.accountingNote.body).toMatch(/asset-level reconciliation/i);
  });

  it.each(['HBAR Holding', 'USDC Holding', 'USDT Holding', 'AUDD Holding'] as const)(
    'describes per-asset routing for %s',
    (name) => {
      const asset = name.replace(' Holding', '');
      expect(HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES[name].whenYouNeedThis).toMatch(
        new RegExp(`${asset}|separate holding`, 'i')
      );
    }
  );
});

describe('resolveCreateAccountInXeroGuide', () => {
  it('returns the shared Stripe Holding guide object', () => {
    const guide = resolveCreateAccountInXeroGuide({
      paymentRail: 'stripe',
      accountName: 'Stripe Holding',
    });
    expect(guide).toBe(STRIPE_HOLDING_CREATE_IN_XERO_GUIDE);
    expect(isDetailedHoldingAccountGuide(guide)).toBe(true);
  });

  it.each(EXPECTED_ACCOUNTS)('resolves detailed guide for $name', ({ name }) => {
    const guide = resolveCreateAccountInXeroGuide({ accountName: name });
    expect(guide).toBe(HOLDING_ACCOUNT_CREATE_IN_XERO_GUIDES[name]);
  });

  it('returns generic fallback for unknown accounts', () => {
    const guide = resolveCreateAccountInXeroGuide({ accountName: 'Unknown Account' });
    expect(guide).toBe(XERO_CREATE_ACCOUNT_IN_XERO_GUIDE);
    expect(isDetailedHoldingAccountGuide(guide)).toBe(false);
  });
});

describe('XERO_GUIDE_FIELD_CLASSIFICATION_LABELS', () => {
  it('maps all classification keys to merchant-facing labels', () => {
    expect(XERO_GUIDE_FIELD_CLASSIFICATION_LABELS.required_for_provvvy).toBe(
      'Required for Provvy'
    );
    expect(XERO_GUIDE_FIELD_CLASSIFICATION_LABELS.recommended).toBe('Recommended');
    expect(XERO_GUIDE_FIELD_CLASSIFICATION_LABELS.do_not_enable).toBe('Do not enable');
    expect(XERO_GUIDE_FIELD_CLASSIFICATION_LABELS.confirm_with_accountant).toBe(
      'Confirm with accountant'
    );
  });
});
