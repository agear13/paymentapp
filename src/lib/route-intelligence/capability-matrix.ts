import { catalogEvidence } from '@/lib/route-intelligence/capability-evidence';
import type {
  CorridorCapability,
  MechanismId,
  ProviderId,
} from '@/lib/route-intelligence/types';

const WISE_SEND_TO =
  'https://wise.com/help/articles/2571942/what-countriesregions-can-i-send-to';
const WISE_AU_ID =
  'https://wise.com/id/send-money/send-money-to-indonesia-from-australia';
const WISE_AU_TH =
  'https://wise.com/th/send-money/send-money-to-thailand-from-australia';
const WISE_AU_SG =
  'https://wise.com/sg/send-money/send-money-to-singapore-from-australia';
const WISE_IDR = 'https://wise.com/help/articles/2932330/guide-to-idr-transfers';
const WISE_THB = 'https://wise.com/help/articles/2932335/guide-to-thb-transfers';
const WISE_SGD = 'https://wise.com/help/articles/2932159/guide-to-sgd-transfers';
const WISE_AUD = 'https://wise.com/help/articles/2932154/guide-to-aud-transfers';
const AIRWALLEX_NETWORK =
  'https://www.airwallex.com/docs/payouts/payout-network/bank-accounts';
const AIRWALLEX_ID = 'https://www.airwallex.com/docs/payouts/payout-network/indonesia';
const AIRWALLEX_TH =
  'https://www.airwallex.com/docs/payouts/payout-network/bank-accounts/thailand';
const AIRWALLEX_SG =
  'https://www.airwallex.com/docs/payouts/payout-network/bank-accounts/singapore';
const OFX_CURRENCIES = 'https://www.ofx.com/en-au/faqs/what-currencies-can-i-transfer-with-ofx/';
const OFX_AVAILABLE = 'https://www.ofx.com/en-au/legal/available-currencies/';

function row(input: {
  id: string;
  offeringId: string;
  providerId: ProviderId;
  mechanism: MechanismId;
  origin?: string | null;
  destination?: string | null;
  source?: string | null;
  target?: string | null;
  transactionType?: string | null;
  status: 'supported' | 'unsupported';
  evidence: CorridorCapability['evidence'];
}): CorridorCapability {
  return {
    id: input.id,
    offeringId: input.offeringId,
    providerId: input.providerId,
    mechanism: input.mechanism,
    origin: input.origin ?? null,
    destination: input.destination ?? null,
    currencyPair: { source: input.source ?? null, target: input.target ?? null },
    transactionType: input.transactionType ?? null,
    networkRails: ['unknown'],
    status: input.status,
    evidence: input.evidence,
  };
}

const WISE_SEND_OFFERINGS: Array<{ offeringId: string; mechanism: MechanismId }> = [
  { offeringId: 'wise-international', mechanism: 'international_bank' },
  { offeringId: 'wise-local', mechanism: 'local_currency_settlement' },
];

function wiseRows(): CorridorCapability[] {
  return WISE_SEND_OFFERINGS.flatMap(({ offeringId, mechanism }) => [
    row({
      id: `${offeringId}-au-id-supplier`,
      offeringId,
      providerId: 'wise',
      mechanism,
      origin: 'AU',
      destination: 'ID',
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'Wise Help Centre / Wise send-money',
        sourceUrl: WISE_AU_ID,
        sourceType: 'provider_marketing',
        notes:
          'Wise lists Indonesia as a send-to country and publishes an Australia → Indonesia page stating “Send AUD, receive IDR.” IDR help says payouts can go to individual and business bank accounts in Indonesia. This establishes a send path, not a customer collection, and does not name a single underlying rail.',
      }),
    }),
    row({
      id: `${offeringId}-au-id-aud-idr-supplier`,
      offeringId,
      providerId: 'wise',
      mechanism,
      origin: 'AU',
      destination: 'ID',
      source: 'AUD',
      target: 'IDR',
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'Wise Help Centre / Wise send-money',
        sourceUrl: WISE_IDR,
        sourceType: 'provider_help',
        notes:
          'Australia → Indonesia page: Send AUD, receive IDR. IDR guide: send IDR to individual and business bank accounts in Indonesia. AUD guide: AUD can be paid in from an Australian bank account in the sender’s name. Network rail remains unknown. Customer collection is not established.',
      }),
    }),
    row({
      id: `${offeringId}-au-th-supplier`,
      offeringId,
      providerId: 'wise',
      mechanism,
      origin: 'AU',
      destination: 'TH',
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'Wise Help Centre / Wise send-money',
        sourceUrl: WISE_AU_TH,
        sourceType: 'provider_marketing',
        notes:
          'Wise lists Thailand as a send-to country and publishes an Australia → Thailand page stating “Send AUD, receive THB.” THB help says payouts can go to individual and business bank accounts at a named set of Thai banks. This is a send path, not a collection path. Rail remains unknown.',
      }),
    }),
    row({
      id: `${offeringId}-au-th-aud-thb-supplier`,
      offeringId,
      providerId: 'wise',
      mechanism,
      origin: 'AU',
      destination: 'TH',
      source: 'AUD',
      target: 'THB',
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'Wise Help Centre',
        sourceUrl: WISE_THB,
        sourceType: 'provider_help',
        notes:
          'Australia → Thailand page: Send AUD, receive THB. THB guide: send THB to individual and business bank accounts; some banks dropped from 6 May 2025. Wise says it pays out via Thai banking partners locally, but does not name a single scheme. Rail remains unknown.',
        asOf: '2025-05-06',
      }),
    }),
    row({
      id: `${offeringId}-au-sg-supplier`,
      offeringId,
      providerId: 'wise',
      mechanism,
      origin: 'AU',
      destination: 'SG',
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'Wise Help Centre / Wise send-money',
        sourceUrl: WISE_AU_SG,
        sourceType: 'provider_marketing',
        notes:
          'Wise lists Singapore as a send-to country and publishes an Australia → Singapore page stating “Send AUD, receive SGD.” SGD help says payouts can go to individual and business bank accounts in Singapore. Send path only. Rail unknown.',
      }),
    }),
    row({
      id: `${offeringId}-au-sg-aud-sgd-supplier`,
      offeringId,
      providerId: 'wise',
      mechanism,
      origin: 'AU',
      destination: 'SG',
      source: 'AUD',
      target: 'SGD',
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'Wise Help Centre',
        sourceUrl: WISE_SGD,
        sourceType: 'provider_help',
        notes:
          'Australia → Singapore page: Send AUD, receive SGD. SGD guide: send SGD to individual and business bank accounts in Singapore; cannot send SGD by Swift. Rail remains unknown.',
      }),
    }),
  ]);
}

function airwallexRows(): CorridorCapability[] {
  return [
    row({
      id: 'airwallex-local-id-supplier',
      offeringId: 'airwallex-local',
      providerId: 'airwallex',
      mechanism: 'local_currency_settlement',
      destination: 'ID',
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'Airwallex Docs — bank account payout network',
        sourceUrl: AIRWALLEX_NETWORK,
        sourceType: 'provider_docs',
        notes:
          'Official payout-network table lists Indonesia with local payouts in IDR. This is destination payout coverage for an Airwallex business account, not a claim that every send currency or collection use-case is supported. Origin remains unspecified. Listed schemes include SKN / BI-FAST / iACH — no single rail is selected.',
      }),
    }),
    row({
      id: 'airwallex-local-id-idr-supplier',
      offeringId: 'airwallex-local',
      providerId: 'airwallex',
      mechanism: 'local_currency_settlement',
      destination: 'ID',
      target: 'IDR',
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'Airwallex Docs — Indonesia',
        sourceUrl: AIRWALLEX_ID,
        sourceType: 'provider_docs',
        notes:
          'Indonesia country guide: local transfer method supports IDR only; bank_country_code ID. SWIFT method on the same page does not list IDR. Origin/send currency is not established. Rail remains unknown because multiple local schemes are listed.',
      }),
    }),
    row({
      id: 'airwallex-local-th-supplier',
      offeringId: 'airwallex-local',
      providerId: 'airwallex',
      mechanism: 'local_currency_settlement',
      destination: 'TH',
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'Airwallex Docs — bank account payout network',
        sourceUrl: AIRWALLEX_NETWORK,
        sourceType: 'provider_docs',
        notes:
          'Official table lists Thailand with local payouts in THB. Destination payout coverage only. Origin unspecified. Schemes include PromptPay / Smart Credit / BAHTNET — rail left unknown.',
      }),
    }),
    row({
      id: 'airwallex-local-th-thb-supplier',
      offeringId: 'airwallex-local',
      providerId: 'airwallex',
      mechanism: 'local_currency_settlement',
      destination: 'TH',
      target: 'THB',
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'Airwallex Docs — Thailand',
        sourceUrl: AIRWALLEX_TH,
        sourceType: 'provider_docs',
        notes:
          'Thailand country guide: local transfer method supports THB; bank_country_code TH. Origin/send currency is not established. Rail unknown.',
      }),
    }),
    row({
      id: 'airwallex-local-sg-supplier',
      offeringId: 'airwallex-local',
      providerId: 'airwallex',
      mechanism: 'local_currency_settlement',
      destination: 'SG',
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'Airwallex Docs — bank account payout network',
        sourceUrl: AIRWALLEX_NETWORK,
        sourceType: 'provider_docs',
        notes:
          'Official table lists Singapore with local payouts in SGD (FAST, GIRO, RTGS). Destination payout coverage only. Origin unspecified. Rail unknown.',
      }),
    }),
    row({
      id: 'airwallex-local-sg-sgd-supplier',
      offeringId: 'airwallex-local',
      providerId: 'airwallex',
      mechanism: 'local_currency_settlement',
      destination: 'SG',
      target: 'SGD',
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'Airwallex Docs — Singapore',
        sourceUrl: AIRWALLEX_SG,
        sourceType: 'provider_docs',
        notes:
          'Singapore country guide: local methods support SGD; bank_country_code SG. Origin/send currency is not established. Rail unknown.',
      }),
    }),
    row({
      id: 'airwallex-international-id-idr-supplier',
      offeringId: 'airwallex-international',
      providerId: 'airwallex',
      mechanism: 'international_bank',
      destination: 'ID',
      target: 'IDR',
      transactionType: 'supplier_payment',
      status: 'unsupported',
      evidence: catalogEvidence({
        source: 'Airwallex Docs — Indonesia',
        sourceUrl: AIRWALLEX_ID,
        sourceType: 'provider_docs',
        notes:
          'Indonesia SWIFT payout currencies are listed as AUD, CAD, CHF, CNY, CZK, DKK, EUR, GBP, HKD, HUF, ILS, JPY, NOK, NZD, PLN, RON, SEK, SGD, THB, TRY, USD, ZAR. IDR is documented only on the local method, not SWIFT. The international-bank offering is therefore unsupported for an IDR payout to Indonesia.',
      }),
    }),
    row({
      id: 'airwallex-international-th-thb-supplier',
      offeringId: 'airwallex-international',
      providerId: 'airwallex',
      mechanism: 'international_bank',
      destination: 'TH',
      target: 'THB',
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'Airwallex Docs — Thailand',
        sourceUrl: AIRWALLEX_TH,
        sourceType: 'provider_docs',
        notes:
          'Thailand SWIFT payout currency list includes THB. This establishes a SWIFT payout to Thailand in THB, not a local-rail payout and not a specific origin country. Rail still unknown as a single id.',
      }),
    }),
    row({
      id: 'airwallex-international-sg-sgd-supplier',
      offeringId: 'airwallex-international',
      providerId: 'airwallex',
      mechanism: 'international_bank',
      destination: 'SG',
      target: 'SGD',
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'Airwallex Docs — Singapore',
        sourceUrl: AIRWALLEX_SG,
        sourceType: 'provider_docs',
        notes:
          'Singapore SWIFT payout currency list includes SGD. Origin country is not established. Rail unknown.',
      }),
    }),
  ];
}

function ofxRows(): CorridorCapability[] {
  return (['IDR', 'THB', 'SGD'] as const).map((target) =>
    row({
      id: `ofx-international-currency-${target.toLowerCase()}`,
      offeringId: 'ofx-international',
      providerId: 'ofx',
      mechanism: 'international_bank',
      target,
      transactionType: 'supplier_payment',
      status: 'supported',
      evidence: catalogEvidence({
        source: 'OFX — supported currencies',
        sourceUrl: target === 'IDR' ? OFX_AVAILABLE : OFX_CURRENCIES,
        sourceType: 'provider_docs',
        notes:
          target === 'IDR'
            ? 'OFX lists IDR as a transfer currency. The legal available-currencies page marks IDR as a restricted currency that cannot be funded directly and must be bought then paid out. This is currency support, not an Australia → Indonesia corridor and not a named rail.'
            : `OFX lists ${target} among currencies that can be transferred. This is currency support only — not proof of a specific origin → destination corridor or rail.`,
      }),
    })
  );
}

const SOURCE_URLS_USED = [
  WISE_SEND_TO,
  WISE_AU_ID,
  WISE_AU_TH,
  WISE_AU_SG,
  WISE_IDR,
  WISE_THB,
  WISE_SGD,
  WISE_AUD,
  AIRWALLEX_NETWORK,
  AIRWALLEX_ID,
  AIRWALLEX_TH,
  AIRWALLEX_SG,
  OFX_CURRENCIES,
  OFX_AVAILABLE,
] as const;

export const CAPABILITY_MATRIX_SOURCES = SOURCE_URLS_USED;

export const CORRIDOR_CAPABILITY_MATRIX: CorridorCapability[] = [
  ...wiseRows(),
  ...airwallexRows(),
  ...ofxRows(),
];
