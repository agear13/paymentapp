import { catalogEvidence } from '@/lib/route-intelligence/capability-evidence';
import type { NetworkRail, NetworkRailId } from '@/lib/route-intelligence/types';

/** Explicit unknown — prefer this over inventing a rail from a mechanism. */
export const UNKNOWN_NETWORK_RAIL: NetworkRailId = 'unknown';

export function isUnknownNetworkRail(railId: NetworkRailId | null | undefined): boolean {
  return !railId || railId === UNKNOWN_NETWORK_RAIL;
}

export function sameNetworkRail(left: NetworkRailId, right: NetworkRailId): boolean {
  return left === right;
}

function rail(input: Omit<NetworkRail, 'evidence'> & { evidence: NetworkRail['evidence'] }): NetworkRail {
  return input;
}

/**
 * Small authoritative catalogue. Not an exhaustive global list.
 * Regional focus is where evidence is established first, not a type limit.
 */
export const NETWORK_RAIL_CATALOGUE: readonly NetworkRail[] = [
  rail({
    id: 'npp',
    name: 'New Payments Platform',
    operator: 'NPP Australia Limited / Australian Payments Plus; RBA Fast Settlement Service',
    railType: 'instant_payment',
    additionalTypes: ['domestic_payment', 'account_to_account'],
    jurisdictions: ['AU'],
    currencies: ['AUD'],
    evidence: catalogEvidence({
      source: 'Reserve Bank of Australia',
      sourceUrl: 'https://www.rba.gov.au/payments-and-infrastructure/new-payments-platform/about-npp.html',
      sourceType: 'regulator',
      publishedAt: null,
      asOf: '2018-02',
      notes:
        'RBA describes the NPP as open-access infrastructure for fast payments in Australia, launched February 2018, with near real-time funds availability 24/7. The Bank built the Fast Settlement Service. Do not treat this as evidence that any specific provider uses NPP.',
    }),
  }),
  rail({
    id: 'bi_fast',
    name: 'BI-FAST',
    operator: 'Bank Indonesia',
    railType: 'instant_payment',
    additionalTypes: ['domestic_payment', 'account_to_account'],
    jurisdictions: ['ID'],
    currencies: ['IDR'],
    evidence: catalogEvidence({
      source: 'Bank Indonesia',
      sourceUrl: 'https://www.bi.go.id/en/publikasi/ruang-media/news-release/Pages/sp_2333421.aspx',
      sourceType: 'regulator',
      publishedAt: '2021-12-21',
      asOf: '2021-12-21',
      notes:
        'Bank Indonesia launched BI-FAST on 21 December 2021 as payment-system infrastructure for retail transactions, available in real time 24/7. The launch note mentions future cross-border work; that is not treated as current cross-border support.',
    }),
  }),
  rail({
    id: 'sknbi',
    name: 'Sistem Kliring Nasional Bank Indonesia',
    operator: 'Bank Indonesia',
    railType: 'account_to_account',
    additionalTypes: ['domestic_payment'],
    jurisdictions: ['ID'],
    currencies: ['IDR'],
    evidence: catalogEvidence({
      source: 'Bank Indonesia',
      sourceUrl: 'https://www.bi.go.id/id/fungsi-utama/sistem-pembayaran/ritel/infrastruktur',
      sourceType: 'regulator',
      publishedAt: null,
      asOf: null,
      notes:
        'Bank Indonesia describes SKNBI as existing national retail payment-system infrastructure that BI-FAST was developed to complement. Distinct from BI-FAST. Service windows and instruments are not asserted beyond that page.',
    }),
  }),
  rail({
    id: 'sg_fast',
    name: 'FAST (Fast And Secure Transfers)',
    operator: 'Not named on the cited MAS page; MAS oversees FAST as a SWIPS',
    railType: 'instant_payment',
    additionalTypes: ['domestic_payment', 'account_to_account'],
    jurisdictions: ['SG'],
    currencies: ['SGD'],
    evidence: catalogEvidence({
      source: 'Monetary Authority of Singapore',
      sourceUrl: 'https://www.mas.gov.sg/regulation/payments/payment-systems',
      sourceType: 'regulator',
      publishedAt: null,
      asOf: '2014-03-17',
      notes:
        'MAS describes FAST as an electronic funds transfer service enabling customers of participating entities to transfer Singapore Dollar funds in Singapore almost instantly. Launched 17 March 2014. Operator legal name is not taken from this page.',
    }),
  }),
  rail({
    id: 'promptpay',
    name: 'PromptPay',
    operator: 'Not named on the cited Bank of Thailand page',
    railType: 'instant_payment',
    additionalTypes: ['domestic_payment', 'account_to_account'],
    jurisdictions: ['TH'],
    currencies: ['THB'],
    evidence: catalogEvidence({
      source: 'Bank of Thailand',
      sourceUrl:
        'https://www.bot.or.th/en/financial-innovation/digital-finance/digital-payment/promptpay.html',
      sourceType: 'regulator',
      publishedAt: null,
      asOf: '2016',
      notes:
        'BOT describes PromptPay as payment-system infrastructure launched in 2016 for transfers using citizen ID, mobile number, or bank account via digital channels. Fee table is denominated in baht. Scheme operator is not named on this page.',
    }),
  }),
  rail({
    id: 'duitnow',
    name: 'DuitNow',
    operator: 'Payments Network Malaysia Sdn Bhd (PayNet)',
    railType: 'instant_payment',
    additionalTypes: ['domestic_payment', 'account_to_account'],
    jurisdictions: ['MY'],
    currencies: [],
    evidence: catalogEvidence({
      source: 'Payments Network Malaysia (PayNet)',
      sourceUrl: 'https://paynet.my/about-us/corporate-profile.html',
      sourceType: 'industry_body',
      publishedAt: null,
      asOf: '2017-08-01',
      notes:
        'PayNet, Malaysia’s national payments network (BNM is the largest shareholder), describes DuitNow as enabling instant transfers to any account or DuitNow ID. The cited page does not name a currency, so none is recorded. Do not treat this as a provider mapping.',
    }),
  }),
  rail({
    id: 'instapay',
    name: 'InstaPay',
    operator: 'Philippine Payment Management Inc. under BSP oversight',
    railType: 'instant_payment',
    additionalTypes: ['domestic_payment', 'account_to_account'],
    jurisdictions: ['PH'],
    currencies: ['PHP'],
    evidence: catalogEvidence({
      source: 'Bangko Sentral ng Pilipinas',
      sourceUrl:
        'https://www.bsp.gov.ph/Pages/PAYMENTS%20AND%20SETTLEMENTS/National%20Retail%20Payment%20System/Empowering-Every-Juan-and-Maria.aspx',
      sourceType: 'regulator',
      publishedAt: null,
      asOf: '2018-04-23',
      notes:
        'BSP describes InstaPay as a real-time low-value EFT credit-push scheme launched 23 April 2018 under the National Retail Payment System. The BSP fact sheet states InstaPay transfers PHP funds between participating BSP-supervised institutions.',
    }),
  }),
  rail({
    id: 'napas',
    name: 'NAPAS',
    operator: 'National Payment Corporation of Vietnam (NAPAS)',
    railType: 'account_to_account',
    additionalTypes: ['domestic_payment', 'instant_payment'],
    jurisdictions: ['VN'],
    currencies: ['VND'],
    evidence: catalogEvidence({
      source: 'National Payment Corporation of Vietnam',
      sourceUrl: 'https://en.napas.com.vn/napas-for-a-cashless-society',
      sourceType: 'industry_body',
      publishedAt: null,
      asOf: '2016',
      notes:
        'NAPAS states it is licensed to provide financial switching and electronic clearing in Vietnam, with the State Bank of Vietnam among main shareholders, and operates retail payment infrastructure. This does not establish which providers clear over NAPAS.',
    }),
  }),
  rail({
    id: 'fednow',
    name: 'FedNow Service',
    operator: 'Federal Reserve',
    railType: 'instant_payment',
    additionalTypes: ['domestic_payment', 'account_to_account'],
    jurisdictions: ['US'],
    currencies: ['USD'],
    evidence: catalogEvidence({
      source: 'Board of Governors of the Federal Reserve System',
      sourceUrl: 'https://www.federalreserve.gov/paymentsystems/fednow_about.htm',
      sourceType: 'regulator',
      publishedAt: null,
      asOf: '2023-07-20',
      notes:
        'The Federal Reserve states the FedNow Service went live on 20 July 2023 and is available to depository institutions in the United States for instant interbank clearing and settlement. Currency is the US dollar as the Federal Reserve’s domestic funds service; the cited page does not enumerate foreign-currency clearing.',
    }),
  }),
  rail({
    id: 'swift',
    name: 'SWIFT',
    operator: 'S.W.I.F.T. SC',
    railType: 'bank_messaging',
    additionalTypes: ['cross_border_payment'],
    jurisdictions: [],
    currencies: [],
    evidence: catalogEvidence({
      source: 'SWIFT',
      sourceUrl: 'https://www.swift.com/about-us',
      sourceType: 'industry_body',
      publishedAt: null,
      asOf: null,
      notes:
        'SWIFT is a cross-border bank messaging network. Presence in this catalogue does not mean any Provvy provider sends via SWIFT, and does not imply a specific corridor or currency capability.',
    }),
  }),
];

export function networkRailById(id: NetworkRailId): NetworkRail | undefined {
  return NETWORK_RAIL_CATALOGUE.find((item) => item.id === id);
}

export function catalogueNetworkRailIds(): NetworkRailId[] {
  return NETWORK_RAIL_CATALOGUE.map((item) => item.id);
}
