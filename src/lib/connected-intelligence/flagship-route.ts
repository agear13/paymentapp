import { createRouteSubject } from '@/lib/route-intelligence/route-subject';
import type { DecisionPayment } from '@/lib/route-intelligence/decision-types';
import type { RouteSubject } from '@/lib/route-intelligence/types';

export const FLAGSHIP_ORIGIN = 'AU';
export const FLAGSHIP_DESTINATION = 'ID';
export const FLAGSHIP_SOURCE_CURRENCY = 'AUD';
export const FLAGSHIP_DESTINATION_CURRENCY = 'IDR';
export const FLAGSHIP_AMOUNT = 10_000;
export const FLAGSHIP_TRANSACTION_TYPE = 'supplier_payment';

export function flagshipWiseRouteSubject(): RouteSubject {
  return createRouteSubject({
    providerId: 'wise',
    offeringId: 'wise-international',
    mechanismId: 'international_bank',
    corridor: { origin: FLAGSHIP_ORIGIN, destination: FLAGSHIP_DESTINATION },
    sourceCurrency: FLAGSHIP_SOURCE_CURRENCY,
    destinationCurrency: FLAGSHIP_DESTINATION_CURRENCY,
    networkRail: 'unknown',
  });
}

export function flagshipOfxRouteSubject(): RouteSubject {
  return createRouteSubject({
    providerId: 'ofx',
    offeringId: 'ofx-international',
    mechanismId: 'international_bank',
    corridor: { origin: FLAGSHIP_ORIGIN, destination: FLAGSHIP_DESTINATION },
    sourceCurrency: FLAGSHIP_SOURCE_CURRENCY,
    destinationCurrency: FLAGSHIP_DESTINATION_CURRENCY,
    networkRail: 'unknown',
  });
}

export function flagshipBankRouteSubject(): RouteSubject {
  return createRouteSubject({
    providerId: 'bank',
    offeringId: 'bank-swift',
    mechanismId: 'international_bank',
    corridor: { origin: FLAGSHIP_ORIGIN, destination: FLAGSHIP_DESTINATION },
    sourceCurrency: FLAGSHIP_SOURCE_CURRENCY,
    destinationCurrency: FLAGSHIP_DESTINATION_CURRENCY,
    networkRail: 'unknown',
  });
}

export function flagshipDecisionPayment(): DecisionPayment {
  return {
    origin: FLAGSHIP_ORIGIN,
    destination: FLAGSHIP_DESTINATION,
    sourceCurrency: FLAGSHIP_SOURCE_CURRENCY,
    destinationCurrency: FLAGSHIP_DESTINATION_CURRENCY,
    amount: FLAGSHIP_AMOUNT,
    transactionType: FLAGSHIP_TRANSACTION_TYPE,
    priority: 'lowest_cost',
  };
}
