import type { LandingRouteId, LandingTransactionTypeId } from '@/lib/journey/landing-route-model';

export const LANDING_PROVIDER_CATALOG_UPDATED = '2026-09-01';

export type LandingProviderId =
  | 'wise'
  | 'airwallex'
  | 'ofx'
  | 'stripe'
  | 'paypal'
  | 'bank'
  | 'digital_dollar';

export const LANDING_PROVIDER_WEBSITES: Partial<Record<LandingProviderId, string>> = {
  wise: 'https://wise.com',
  airwallex: 'https://www.airwallex.com',
  ofx: 'https://www.ofx.com',
  stripe: 'https://stripe.com',
  paypal: 'https://www.paypal.com',
};

export type LandingPaymentMethodFilter =
  | 'bank_transfer'
  | 'card'
  | 'payment_link'
  | 'digital_wallet'
  | 'stablecoin'
  | 'local_rail'
  | 'other';

export type LandingProviderTypeFilter =
  | 'bank'
  | 'payment_platform'
  | 'fx_transfer'
  | 'card_processor'
  | 'digital_asset';

export type LandingSpeedBand = 'instant' | 'same_day' | 'one_to_two_days' | 'three_plus_days';
export type LandingCostBand = 'lowest' | 'low_fees' | 'best_fx' | 'no_monthly';
export type LandingSetupBand =
  | 'no_account'
  | 'existing_account'
  | 'business_account'
  | 'additional_setup';
export type LandingRecipientNeed =
  | 'bank_account'
  | 'card'
  | 'payment_link'
  | 'wallet'
  | 'local_account';
export type LandingBusinessTrait =
  | 'business_friendly'
  | 'multi_user'
  | 'accounting'
  | 'approvals'
  | 'recurring';

export type LandingIndicativeFee = {
  status: 'indicative';
  model: 'percent' | 'percent_plus_fixed' | 'fixed' | 'qualitative';
  percent?: number;
  fixed?: number;
  note: string;
};

export type LandingProviderOffering = {
  id: string;
  providerId: LandingProviderId;
  providerName: string;
  productName: string;
  explanation: string;
  mechanism: LandingRouteId;
  corridors: 'cross_border' | 'domestic' | 'all';
  transactionTypes: 'all' | LandingTransactionTypeId[];
  paymentMethods: LandingPaymentMethodFilter[];
  providerType: LandingProviderTypeFilter;
  speedBand: LandingSpeedBand;
  costBands: LandingCostBand[];
  setupBand: LandingSetupBand;
  recipientNeeds: LandingRecipientNeed[];
  businessTraits: LandingBusinessTrait[];
  fee: LandingIndicativeFee;
  fxLabel: string;
  arrivalLabel: string;
  setupLabel: string;
  requirements: string[];
  howItWorks: string[];
  potentialIssues: string[];
  priorityAdj: { lowest_cost: number; fastest: number; simplest: number };
  live: false;
  source: 'static_catalog';
};

export const LANDING_PROVIDER_OFFERINGS: LandingProviderOffering[] = [
  {
    id: 'wise-international',
    providerId: 'wise',
    providerName: 'Wise',
    productName: 'International transfer',
    explanation: 'Send to a local bank account using a specialist FX provider.',
    mechanism: 'international_bank',
    corridors: 'cross_border',
    transactionTypes: 'all',
    paymentMethods: ['bank_transfer'],
    providerType: 'fx_transfer',
    speedBand: 'one_to_two_days',
    costBands: ['lowest', 'low_fees', 'best_fx', 'no_monthly'],
    setupBand: 'existing_account',
    recipientNeeds: ['bank_account', 'local_account'],
    businessTraits: ['business_friendly', 'multi_user', 'accounting'],
    fee: {
      status: 'indicative',
      model: 'percent',
      percent: 0.7,
      note: 'Typical published transfer markup range. Not a live quote.',
    },
    fxLabel: 'Mid-market plus provider markup',
    arrivalLabel: '1–2 business days',
    setupLabel: 'Low — account required',
    requirements: [
      'Sender account with Wise',
      'Recipient local bank details',
      'Supported currencies on the corridor',
    ],
    howItWorks: [
      'You fund the transfer from your account.',
      'Wise converts at its published rate plus markup.',
      'The supplier is paid into a local bank account.',
    ],
    potentialIssues: [
      'Recipient must accept a local bank deposit.',
      'Large first transfers can trigger extra checks.',
    ],
    priorityAdj: { lowest_cost: 16, fastest: 6, simplest: 10 },
    live: false,
    source: 'static_catalog',
  },
  {
    id: 'airwallex-international',
    providerId: 'airwallex',
    providerName: 'Airwallex',
    productName: 'Business international transfer',
    explanation: 'Business FX and payouts through a multi-currency account.',
    mechanism: 'international_bank',
    corridors: 'cross_border',
    transactionTypes: 'all',
    paymentMethods: ['bank_transfer'],
    providerType: 'fx_transfer',
    speedBand: 'same_day',
    costBands: ['low_fees', 'best_fx', 'no_monthly'],
    setupBand: 'business_account',
    recipientNeeds: ['bank_account', 'local_account'],
    businessTraits: ['business_friendly', 'multi_user', 'accounting', 'approvals'],
    fee: {
      status: 'indicative',
      model: 'percent',
      percent: 0.8,
      note: 'Typical business FX/payout range. Not a live quote.',
    },
    fxLabel: 'Indicative business FX',
    arrivalLabel: 'Same day to 2 business days',
    setupLabel: 'Low–medium — business account',
    requirements: [
      'Business account with Airwallex',
      'Recipient bank details',
      'Business verification',
    ],
    howItWorks: [
      'You hold or fund a business wallet.',
      'Airwallex converts and pays out.',
      'The recipient is paid locally where supported.',
    ],
    potentialIssues: [
      'Business onboarding is required.',
      'Same-day arrival is corridor-dependent.',
    ],
    priorityAdj: { lowest_cost: 12, fastest: 8, simplest: 4 },
    live: false,
    source: 'static_catalog',
  },
  {
    id: 'ofx-international',
    providerId: 'ofx',
    providerName: 'OFX',
    productName: 'International transfer',
    explanation: 'Specialist FX transfer, often used for larger business payments.',
    mechanism: 'international_bank',
    corridors: 'cross_border',
    transactionTypes: 'all',
    paymentMethods: ['bank_transfer'],
    providerType: 'fx_transfer',
    speedBand: 'one_to_two_days',
    costBands: ['low_fees', 'best_fx', 'no_monthly'],
    setupBand: 'existing_account',
    recipientNeeds: ['bank_account'],
    businessTraits: ['business_friendly'],
    fee: {
      status: 'indicative',
      model: 'percent',
      percent: 0.9,
      note: 'Typical specialist-FX range. Not a live quote.',
    },
    fxLabel: 'Indicative specialist FX',
    arrivalLabel: '1–2 business days',
    setupLabel: 'Low — account required',
    requirements: ['Sender account with OFX', 'Recipient bank details'],
    howItWorks: [
      'You book a transfer.',
      'OFX converts at its published rate.',
      'Funds arrive in the recipient bank account.',
    ],
    potentialIssues: ['Better suited to larger amounts.', 'Not a consumer checkout link.'],
    priorityAdj: { lowest_cost: 8, fastest: 2, simplest: 4 },
    live: false,
    source: 'static_catalog',
  },
  {
    id: 'bank-swift',
    providerId: 'bank',
    providerName: 'Your bank',
    productName: 'International bank transfer',
    explanation: 'A correspondent-bank payment from the account you already use.',
    mechanism: 'international_bank',
    corridors: 'cross_border',
    transactionTypes: 'all',
    paymentMethods: ['bank_transfer'],
    providerType: 'bank',
    speedBand: 'three_plus_days',
    costBands: ['no_monthly'],
    setupBand: 'existing_account',
    recipientNeeds: ['bank_account'],
    businessTraits: ['business_friendly', 'approvals'],
    fee: {
      status: 'indicative',
      model: 'percent_plus_fixed',
      percent: 2.2,
      fixed: 25,
      note: 'Typical SWIFT fee plus FX spread. Not a live quote from your bank.',
    },
    fxLabel: 'Bank rate — often a wider spread',
    arrivalLabel: '1–4 business days',
    setupLabel: 'Low if you already bank there',
    requirements: ['Existing business bank account', 'SWIFT/IBAN or equivalent details'],
    howItWorks: [
      'You instruct your bank.',
      'The payment travels a correspondent path.',
      'The supplier’s bank credits their account.',
    ],
    potentialIssues: [
      'FX markup is often the real cost.',
      'Intermediary banks can add time and fees.',
    ],
    priorityAdj: { lowest_cost: 0, fastest: -8, simplest: 16 },
    live: false,
    source: 'static_catalog',
  },
  {
    id: 'wise-local',
    providerId: 'wise',
    providerName: 'Wise',
    productName: 'Pay in the destination currency',
    explanation: 'The recipient is paid locally, in the currency they actually operate in.',
    mechanism: 'local_currency_settlement',
    corridors: 'cross_border',
    transactionTypes: 'all',
    paymentMethods: ['bank_transfer', 'local_rail'],
    providerType: 'fx_transfer',
    speedBand: 'one_to_two_days',
    costBands: ['low_fees', 'best_fx'],
    setupBand: 'existing_account',
    recipientNeeds: ['local_account', 'bank_account'],
    businessTraits: ['business_friendly'],
    fee: {
      status: 'indicative',
      model: 'percent',
      percent: 0.75,
      note: 'Typical local-payout range. Not a live quote.',
    },
    fxLabel: 'Mid-market plus markup, paid out locally',
    arrivalLabel: '1–2 business days after setup',
    setupLabel: 'Low–medium — need the local account details',
    requirements: ['Wise account', 'Recipient local account in the destination currency'],
    howItWorks: [
      'You send in your currency.',
      'Wise converts.',
      'The supplier is paid on a local rail.',
    ],
    potentialIssues: ['You need the recipient’s real local account details.'],
    priorityAdj: { lowest_cost: 6, fastest: 4, simplest: -2 },
    live: false,
    source: 'static_catalog',
  },
  {
    id: 'airwallex-local',
    providerId: 'airwallex',
    providerName: 'Airwallex',
    productName: 'Local payout',
    explanation: 'Business payout on a local rail where Airwallex supports the corridor.',
    mechanism: 'local_currency_settlement',
    corridors: 'cross_border',
    transactionTypes: 'all',
    paymentMethods: ['bank_transfer', 'local_rail'],
    providerType: 'fx_transfer',
    speedBand: 'one_to_two_days',
    costBands: ['low_fees', 'best_fx'],
    setupBand: 'business_account',
    recipientNeeds: ['local_account', 'bank_account'],
    businessTraits: ['business_friendly', 'multi_user', 'accounting'],
    fee: {
      status: 'indicative',
      model: 'percent',
      percent: 0.85,
      note: 'Typical local-payout range. Not a live quote.',
    },
    fxLabel: 'Indicative, paid out locally',
    arrivalLabel: 'Same day to 2 business days',
    setupLabel: 'Medium — business account and local details',
    requirements: ['Airwallex business account', 'Recipient local account details'],
    howItWorks: [
      'You fund a business wallet.',
      'Airwallex pays out locally.',
      'The recipient receives destination currency.',
    ],
    potentialIssues: ['Local payout coverage varies by corridor.'],
    priorityAdj: { lowest_cost: 4, fastest: 6, simplest: -4 },
    live: false,
    source: 'static_catalog',
  },
  {
    id: 'digital-dollar',
    providerId: 'digital_dollar',
    providerName: 'Digital-dollar transfer',
    productName: 'Fast settlement using a digital-dollar payment rail',
    explanation: 'Typically requires compatible accounts/wallets on both sides.',
    mechanism: 'stablecoin_settlement',
    corridors: 'all',
    transactionTypes: 'all',
    paymentMethods: ['stablecoin', 'digital_wallet'],
    providerType: 'digital_asset',
    speedBand: 'instant',
    costBands: ['low_fees', 'no_monthly'],
    setupBand: 'additional_setup',
    recipientNeeds: ['wallet'],
    businessTraits: ['business_friendly'],
    fee: {
      status: 'indicative',
      model: 'percent',
      percent: 0.15,
      note: 'Network cost is typically low. Setup and treasury readiness are the real cost. Not a live quote.',
    },
    fxLabel: 'Usually held as digital dollars — conversion may still be needed',
    arrivalLabel: 'Minutes to hours after both wallets are ready',
    setupLabel: 'High until wallets and treasury exist',
    requirements: [
      'Compatible wallets or treasury accounts on both sides',
      'A way to convert back to local currency if needed',
      'Accounting treatment agreed',
    ],
    howItWorks: [
      'You send digital dollars from a compatible account.',
      'The network settles in minutes to hours.',
      'The supplier receives digital dollars, then converts if they need local currency.',
    ],
    potentialIssues: [
      'Not useful if the supplier cannot receive digital dollars.',
      'Accounting, compliance and conversion still sit around the transfer.',
    ],
    priorityAdj: { lowest_cost: 2, fastest: 18, simplest: -22 },
    live: false,
    source: 'static_catalog',
  },
  {
    id: 'stripe-checkout',
    providerId: 'stripe',
    providerName: 'Stripe',
    productName: 'Payment link / card checkout',
    explanation: 'The other party pays from a link, usually by card.',
    mechanism: 'card_checkout',
    corridors: 'all',
    transactionTypes: 'all',
    paymentMethods: ['card', 'payment_link'],
    providerType: 'card_processor',
    speedBand: 'instant',
    costBands: ['no_monthly'],
    setupBand: 'existing_account',
    recipientNeeds: ['card', 'payment_link'],
    businessTraits: ['business_friendly', 'accounting', 'recurring'],
    fee: {
      status: 'indicative',
      model: 'percent_plus_fixed',
      percent: 1.75,
      fixed: 0.3,
      note: 'Typical card acceptance range. Not a live Stripe quote.',
    },
    fxLabel: 'Card scheme / Stripe conversion if currencies differ',
    arrivalLabel: 'Minutes for the payer; settlement to you follows Stripe timing',
    setupLabel: 'Low once a Stripe account exists',
    requirements: ['Stripe account', 'A payment link the other party can open'],
    howItWorks: [
      'You send a payment link.',
      'The other party pays by card or supported method.',
      'Stripe settles to your account on its published timeline.',
    ],
    potentialIssues: [
      'Acceptance cost is usually higher than bank or FX payouts.',
      'Better for collections than for paying a supplier.',
    ],
    priorityAdj: { lowest_cost: -18, fastest: 14, simplest: 12 },
    live: false,
    source: 'static_catalog',
  },
  {
    id: 'paypal-checkout',
    providerId: 'paypal',
    providerName: 'PayPal',
    productName: 'Payment request',
    explanation: 'The other party pays from a PayPal account or card, via a link.',
    mechanism: 'card_checkout',
    corridors: 'all',
    transactionTypes: 'all',
    paymentMethods: ['payment_link', 'digital_wallet', 'card'],
    providerType: 'payment_platform',
    speedBand: 'instant',
    costBands: ['no_monthly'],
    setupBand: 'existing_account',
    recipientNeeds: ['payment_link'],
    businessTraits: ['recurring'],
    fee: {
      status: 'indicative',
      model: 'percent',
      percent: 3.4,
      note: 'Typical PayPal commercial rate range. Not a live quote.',
    },
    fxLabel: 'PayPal conversion if currencies differ',
    arrivalLabel: 'Minutes once the payer completes',
    setupLabel: 'Low if both sides already use PayPal',
    requirements: ['PayPal account', 'The other party can complete a PayPal request'],
    howItWorks: [
      'You send a PayPal request or link.',
      'The other party pays.',
      'Funds sit in PayPal until withdrawn.',
    ],
    potentialIssues: ['Usually expensive for a A$10k-class payment.', 'Not a bank payout rail.'],
    priorityAdj: { lowest_cost: -26, fastest: 8, simplest: 8 },
    live: false,
    source: 'static_catalog',
  },
  {
    id: 'bank-domestic',
    providerId: 'bank',
    providerName: 'Your bank',
    productName: 'Domestic bank transfer',
    explanation: 'A local bank payment using the account you already have.',
    mechanism: 'domestic_bank',
    corridors: 'domestic',
    transactionTypes: 'all',
    paymentMethods: ['bank_transfer'],
    providerType: 'bank',
    speedBand: 'same_day',
    costBands: ['lowest', 'low_fees', 'no_monthly'],
    setupBand: 'existing_account',
    recipientNeeds: ['bank_account'],
    businessTraits: ['business_friendly', 'approvals'],
    fee: {
      status: 'indicative',
      model: 'fixed',
      fixed: 0,
      note: 'Domestic transfers are often free or low-fee. Not a live quote from your bank.',
    },
    fxLabel: 'None for same-currency domestic',
    arrivalLabel: 'Same day to 2 business days',
    setupLabel: 'Low',
    requirements: ['Existing local bank account', 'Recipient local account details'],
    howItWorks: [
      'You instruct your bank.',
      'The payment clears on a domestic rail.',
      'The recipient’s bank credits their account.',
    ],
    potentialIssues: ['Not available across borders.', 'Not the fastest if you need instant collection.'],
    priorityAdj: { lowest_cost: 10, fastest: 0, simplest: 12 },
    live: false,
    source: 'static_catalog',
  },
  {
    id: 'direct-debit',
    providerId: 'stripe',
    providerName: 'Stripe',
    productName: 'Direct debit / scheduled collection',
    explanation: 'The customer authorises a pull. Later collections can run without another checkout.',
    mechanism: 'direct_debit',
    corridors: 'domestic',
    transactionTypes: ['customer_collection'],
    paymentMethods: ['bank_transfer', 'other'],
    providerType: 'card_processor',
    speedBand: 'three_plus_days',
    costBands: ['low_fees'],
    setupBand: 'additional_setup',
    recipientNeeds: ['bank_account'],
    businessTraits: ['business_friendly', 'recurring', 'accounting'],
    fee: {
      status: 'indicative',
      model: 'percent',
      percent: 1.0,
      note: 'Typical debit-collection range. Not a live quote.',
    },
    fxLabel: 'None for same-currency domestic',
    arrivalLabel: '2–5 days after authorisation',
    setupLabel: 'Moderate to set up, then low',
    requirements: ['A mandate from the customer', 'A collection provider such as Stripe'],
    howItWorks: [
      'The customer authorises a debit.',
      'You collect on the agreed schedule.',
      'Funds settle after the debit clears.',
    ],
    potentialIssues: ['Weak for a first-time or disputed invoice.', 'Takes days, not minutes.'],
    priorityAdj: { lowest_cost: 6, fastest: -4, simplest: 0 },
    live: false,
    source: 'static_catalog',
  },
];
