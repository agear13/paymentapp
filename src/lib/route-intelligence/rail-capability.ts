import { catalogEvidence } from '@/lib/route-intelligence/capability-evidence';
import { corridorKind } from '@/lib/route-intelligence/corridor-kind';
import type {
  Corridor,
  RailCapability,
  RailCapabilityStatus,
} from '@/lib/route-intelligence/types';

export const RAIL_CAPABILITY_STATUSES: readonly RailCapabilityStatus[] = [
  'supported',
  'unsupported',
  'restricted',
  'unknown',
];

export function railCapabilityStatusesAreDistinct(): boolean {
  return new Set(RAIL_CAPABILITY_STATUSES).size === RAIL_CAPABILITY_STATUSES.length;
}

export function railCapabilityId(input: {
  railId: string;
  originCountry: string | null;
  destinationCountry: string | null;
  sourceCurrency: string | null;
  destinationCurrency: string | null;
  paymentType: string | null;
}): string {
  const part = (value: string | null) => (value && value.trim() ? value : '-');
  return [
    'railcap',
    input.railId,
    part(input.originCountry),
    part(input.destinationCountry),
    part(input.sourceCurrency),
    part(input.destinationCurrency),
    part(input.paymentType),
  ].join(':');
}

export function corridorKindForCapability(
  originCountry: string | null,
  destinationCountry: string | null
): RailCapability['corridorKind'] {
  if (!originCountry?.trim() || !destinationCountry?.trim()) return null;
  return corridorKind({ origin: originCountry, destination: destinationCountry });
}

function capability(input: Omit<RailCapability, 'id' | 'corridorKind'>): RailCapability {
  return {
    id: railCapabilityId(input),
    corridorKind: corridorKindForCapability(input.originCountry, input.destinationCountry),
    ...input,
  };
}

/**
 * Small sourced capability set. Absence of a row is unspecified, not unsupported.
 * Do not infer provider access from these rows.
 */
export const RAIL_CAPABILITY_CATALOGUE: readonly RailCapability[] = [
  capability({
    railId: 'npp',
    originCountry: 'AU',
    destinationCountry: 'AU',
    sourceCurrency: 'AUD',
    destinationCurrency: 'AUD',
    paymentType: null,
    participantRequirements: [
      'NPP participation via Australian Payments Plus; FSS settlement participants are ADIs or approved institutions',
    ],
    status: 'supported',
    evidence: catalogEvidence({
      source: 'Reserve Bank of Australia',
      sourceUrl: 'https://www.rba.gov.au/payments-and-infrastructure/new-payments-platform/about-npp.html',
      sourceType: 'regulator',
      asOf: '2018-02',
      notes:
        'RBA: NPP enables households, businesses and government agencies to make simply addressed payments in Australia with near real-time funds availability 24/7.',
    }),
  }),
  capability({
    railId: 'bi_fast',
    originCountry: 'ID',
    destinationCountry: 'ID',
    sourceCurrency: 'IDR',
    destinationCurrency: 'IDR',
    paymentType: null,
    participantRequirements: ['BI-FAST participant (banks and payment-system industry participants)'],
    status: 'supported',
    evidence: catalogEvidence({
      source: 'Bank Indonesia',
      sourceUrl: 'https://www.bi.go.id/en/publikasi/ruang-media/news-release/Pages/sp_2333421.aspx',
      sourceType: 'regulator',
      publishedAt: '2021-12-21',
      asOf: '2021-12-21',
      notes:
        'BI launched BI-FAST as national retail payment-system infrastructure for real-time 24/7 transactions. This row does not assert a specific end-user payment type such as supplier.',
    }),
  }),
  capability({
    railId: 'bi_fast',
    originCountry: 'AU',
    destinationCountry: 'ID',
    sourceCurrency: 'AUD',
    destinationCurrency: 'IDR',
    paymentType: null,
    participantRequirements: [],
    status: 'unknown',
    evidence: catalogEvidence({
      source: 'Bank Indonesia',
      sourceUrl: 'https://www.bi.go.id/en/publikasi/ruang-media/news-release/Pages/sp_2333421.aspx',
      sourceType: 'regulator',
      publishedAt: '2021-12-21',
      asOf: '2021-12-21',
      notes:
        'The BI-FAST launch note mentions future expansion including cross-border transactions. That is not current corridor support, so AU→ID remains unknown.',
    }),
  }),
  capability({
    railId: 'sknbi',
    originCountry: 'ID',
    destinationCountry: 'ID',
    sourceCurrency: 'IDR',
    destinationCurrency: 'IDR',
    paymentType: null,
    participantRequirements: [],
    status: 'supported',
    evidence: catalogEvidence({
      source: 'Bank Indonesia',
      sourceUrl: 'https://www.bi.go.id/id/fungsi-utama/sistem-pembayaran/ritel/infrastruktur',
      sourceType: 'regulator',
      notes:
        'BI describes SKNBI as existing national retail payment infrastructure, distinct from BI-FAST. Hours and instruments are not further asserted.',
    }),
  }),
  capability({
    railId: 'sg_fast',
    originCountry: 'SG',
    destinationCountry: 'SG',
    sourceCurrency: 'SGD',
    destinationCurrency: 'SGD',
    paymentType: null,
    participantRequirements: ['FAST participating entity'],
    status: 'supported',
    evidence: catalogEvidence({
      source: 'Monetary Authority of Singapore',
      sourceUrl: 'https://www.mas.gov.sg/regulation/payments/payment-systems',
      sourceType: 'regulator',
      asOf: '2014-03-17',
      notes:
        'MAS: FAST enables customers of participating entities to transfer Singapore Dollar funds from one entity to another in Singapore almost instantly.',
    }),
  }),
  capability({
    railId: 'promptpay',
    originCountry: 'TH',
    destinationCountry: 'TH',
    sourceCurrency: 'THB',
    destinationCurrency: 'THB',
    paymentType: null,
    participantRequirements: ['Registered PromptPay user linked to a bank account'],
    status: 'supported',
    evidence: catalogEvidence({
      source: 'Bank of Thailand',
      sourceUrl:
        'https://www.bot.or.th/en/financial-innovation/digital-finance/digital-payment/promptpay.html',
      sourceType: 'regulator',
      asOf: '2016',
      notes:
        'BOT describes PromptPay as domestic payment infrastructure for transfers via citizen ID, mobile number, or account. Fee table is in baht.',
    }),
  }),
  capability({
    railId: 'duitnow',
    originCountry: 'MY',
    destinationCountry: 'MY',
    sourceCurrency: null,
    destinationCurrency: null,
    paymentType: null,
    participantRequirements: [],
    status: 'supported',
    evidence: catalogEvidence({
      source: 'Payments Network Malaysia (PayNet)',
      sourceUrl: 'https://paynet.my/about-us/corporate-profile.html',
      sourceType: 'industry_body',
      notes:
        'PayNet describes DuitNow as instant transfers to any account or DuitNow ID. Currency is not named on the cited page, so it is left unknown.',
    }),
  }),
  capability({
    railId: 'instapay',
    originCountry: 'PH',
    destinationCountry: 'PH',
    sourceCurrency: 'PHP',
    destinationCurrency: 'PHP',
    paymentType: null,
    participantRequirements: ['Participating BSP-supervised bank or e-money issuer'],
    status: 'supported',
    evidence: catalogEvidence({
      source: 'Bangko Sentral ng Pilipinas',
      sourceUrl:
        'https://www.bsp.gov.ph/Pages/PAYMENTS%20AND%20SETTLEMENTS/National%20Retail%20Payment%20System/Empowering-Every-Juan-and-Maria.aspx',
      sourceType: 'regulator',
      asOf: '2018-04-23',
      notes:
        'BSP: InstaPay is a real-time low-value EFT credit-push scheme for PHP transfers between participating institutions in the Philippines.',
    }),
  }),
  capability({
    railId: 'napas',
    originCountry: 'VN',
    destinationCountry: 'VN',
    sourceCurrency: null,
    destinationCurrency: null,
    paymentType: null,
    participantRequirements: [],
    status: 'supported',
    evidence: catalogEvidence({
      source: 'National Payment Corporation of Vietnam',
      sourceUrl: 'https://en.napas.com.vn/napas-for-a-cashless-society',
      sourceType: 'industry_body',
      asOf: '2016',
      notes:
        'NAPAS operates licensed financial switching and electronic clearing for retail payments in Vietnam. Specific currency pairs are not taken from the cited page.',
    }),
  }),
  capability({
    railId: 'fednow',
    originCountry: 'US',
    destinationCountry: 'US',
    sourceCurrency: 'USD',
    destinationCurrency: 'USD',
    paymentType: null,
    participantRequirements: ['Eligible US depository institution'],
    status: 'supported',
    evidence: catalogEvidence({
      source: 'Board of Governors of the Federal Reserve System',
      sourceUrl: 'https://www.federalreserve.gov/paymentsystems/fednow_about.htm',
      sourceType: 'regulator',
      asOf: '2023-07-20',
      notes:
        'FedNow provides interbank clearing and settlement so funds can move between sender and receiver accounts at US depository institutions in near real time, any day of the year.',
    }),
  }),
  capability({
    railId: 'swift',
    originCountry: null,
    destinationCountry: null,
    sourceCurrency: null,
    destinationCurrency: null,
    paymentType: null,
    participantRequirements: ['SWIFT-connected financial institution'],
    status: 'unknown',
    evidence: catalogEvidence({
      source: 'SWIFT',
      sourceUrl: 'https://www.swift.com/about-us',
      sourceType: 'industry_body',
      notes:
        'SWIFT is a messaging network. No Provvy corridor or currency capability is asserted from the about page. Mechanism international_bank is not SWIFT.',
    }),
  }),
];

export function railCapabilitiesFor(railId: string): RailCapability[] {
  return RAIL_CAPABILITY_CATALOGUE.filter((row) => row.railId === railId);
}

export function corridorKindFromCountries(corridor: Corridor): RailCapability['corridorKind'] {
  return corridorKind(corridor);
}
