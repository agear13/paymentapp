import {
  countryName,
  formatLandingAmount,
  isDomestic,
  priorityLabel,
  transactionTypeLabel,
  type LandingComparedRoute,
  type LandingPriorityId,
  type LandingRouteId,
  type LandingSearchQuery,
} from '@/lib/journey/landing-route-model';

export type LandingPriorityOutlook = {
  priority: LandingPriorityId;
  label: string;
  routeId: LandingRouteId;
  routeName: string;
};

export type LandingRecommendation = {
  why: string;
  rankingReasons: string[];
  tradeoff: string;
  tradeoffShift: string;
  mainAdvantage: string;
  mainTradeoff: string;
  couldChangeIf: string;
  bestWhen: string;
};

export type LandingGenericConfidence = {
  level: 'Moderate';
  explanation: string;
};

function counterparty(query: LandingSearchQuery): string {
  switch (query.transactionType) {
    case 'supplier_payment':
      return 'supplier';
    case 'customer_collection':
      return 'customer';
    case 'contractor_payroll':
      return 'contractor';
    case 'revenue_share':
      return 'recipient';
    case 'intercompany':
      return 'related entity';
  }
}

function paymentNoun(query: LandingSearchQuery): string {
  return transactionTypeLabel(query.transactionType).toLowerCase();
}

function corridorPhrase(query: LandingSearchQuery): string {
  const from = countryName(query.originCountry);
  const to = countryName(query.destinationCountry);
  return isDomestic(query) ? `inside ${from}` : `from ${from} to ${to}`;
}

export function buildContextLine(query: LandingSearchQuery): string {
  const amount = formatLandingAmount(query.amount, query.currency);
  const type = transactionTypeLabel(query.transactionType);
  const priority = priorityLabel(query.priority);
  if (isDomestic(query)) {
    return `${amount} · ${type} · ${countryName(query.originCountry)} · ${priority}`;
  }
  return `${amount} · ${type} · ${countryName(query.originCountry)} → ${countryName(query.destinationCountry)} · ${priority}`;
}

export const LANDING_GENERIC_CONFIDENCE: LandingGenericConfidence = {
  level: 'Moderate',
  explanation:
    "This comparison uses transaction details and typical route characteristics. Provvy does not yet know your business's cash position, negotiated rates, connected rails or supplier terms.",
};

export function whatCouldChangeTheRecommendation(
  query: LandingSearchQuery
): string[] {
  const party = counterparty(query);
  const first =
    query.transactionType === 'customer_collection'
      ? 'how this customer actually prefers to pay'
      : `whether the ${party} already accepts a particular currency`;

  return [
    first,
    'your available cash by currency',
    'your existing payment rails',
    'your negotiated FX rates',
    `the ${party}'s agreed payment terms`,
    'how urgently the payment needs to arrive',
    'your approval requirements',
    `your previous payment history with this ${party}`,
  ];
}

function routeName(id: LandingRouteId): string {
  switch (id) {
    case 'domestic_bank':
      return 'Domestic bank transfer';
    case 'international_bank':
      return 'International bank transfer';
    case 'card_checkout':
      return 'Card checkout';
    case 'local_currency_settlement':
      return 'Settle in the destination currency';
    case 'stablecoin_settlement':
      return 'Digital-dollar transfer';
    case 'direct_debit':
      return 'Direct debit / scheduled collection';
  }
}

export function landingRouteName(id: LandingRouteId): string {
  return routeName(id);
}

function whyForRoute(id: LandingRouteId, query: LandingSearchQuery): string {
  const amount = formatLandingAmount(query.amount, query.currency);
  const type = paymentNoun(query);
  const priority = priorityLabel(query.priority).toLowerCase();
  const corridor = corridorPhrase(query);
  const party = counterparty(query);
  const opener = `For a ${amount} ${type} ${corridor}, where ${priority} is the priority,`;

  switch (id) {
    case 'domestic_bank':
      return query.priority === 'fastest'
        ? `${opener} a local bank transfer is generally still a practical starting point, but only because faster rails usually need setup this transaction has not indicated is already in place.`
        : `${opener} a local bank transfer is generally the strongest starting point because it is familiar, typically low-fee, and avoids introducing another rail for a domestic payment.`;
    case 'international_bank':
      return query.priority === 'fastest'
        ? `${opener} a correspondent bank path is generally familiar, but it is rarely the fastest option once both sides can operate another rail.`
        : query.priority === 'simplest'
          ? `${opener} a bank transfer is generally the strongest starting point because ${party} settlement on bank rails is widely understood and needs less new infrastructure than alternatives.`
          : `${opener} a bank transfer is generally the strongest starting point because it avoids the setup and operational overhead of alternative rails.`;
    case 'card_checkout':
      return `${opener} a card checkout is generally the strongest starting point because the other party can complete it quickly, without waiting on bank cut-offs — at a higher acceptance cost.`;
    case 'local_currency_settlement':
      return `${opener} paying the way the ${party} actually receives money is generally the strongest starting point, because receiving-side FX surprise often matters more than sending-side familiarity.`;
    case 'stablecoin_settlement':
      return `${opener} a digital-dollar rail is generally the strongest starting point for speed — provided both sides can already operate compatible wallets and treasury. That readiness has not been confirmed here.`;
    case 'direct_debit':
      return `${opener} a scheduled collection is generally the strongest starting point once a mandate exists, because it reduces chasing without card acceptance cost.`;
  }
}

function rankingReasons(id: LandingRouteId, query: LandingSearchQuery): string[] {
  const party = counterparty(query);
  const reasons: string[] = [`${priorityLabel(query.priority)} is your priority`];

  switch (query.transactionType) {
    case 'supplier_payment':
      reasons.push('The payment is a supplier obligation rather than an urgent customer collection');
      break;
    case 'customer_collection':
      reasons.push('This is a collection, so how quickly the other party can complete it generally matters');
      break;
    case 'contractor_payroll':
      reasons.push('This is a contractor or payroll payment, where familiar settlement usually matters more than a new rail');
      break;
    case 'revenue_share':
      reasons.push('This is a revenue-share payment, so how the recipient actually wants to be paid generally shapes the route');
      break;
    case 'intercompany':
      reasons.push('This is an intercompany movement, where control and existing settlement paths usually matter more than consumer checkout');
      break;
  }

  switch (id) {
    case 'domestic_bank':
    case 'international_bank':
      reasons.push(`Bank settlement is generally familiar to the ${party}`);
      break;
    case 'card_checkout':
      reasons.push('The other party can generally complete a payment link without sharing bank details');
      break;
    case 'local_currency_settlement':
      reasons.push(`Settling in the destination currency generally reduces receiving-side FX uncertainty for the ${party}`);
      break;
    case 'stablecoin_settlement':
      reasons.push('Once wallets are ready, settlement can generally complete in minutes to hours rather than business days');
      break;
    case 'direct_debit':
      reasons.push('After a mandate is in place, collection can generally run without another checkout each time');
      break;
  }

  if (query.priority === 'lowest_cost' && (id === 'international_bank' || id === 'domestic_bank')) {
    reasons.push(
      'There is no indication yet that faster settlement justifies additional setup or cost'
    );
  } else if (query.priority === 'fastest') {
    reasons.push(
      'Based on the information you have provided, there is no confirmed constraint that would rule out a faster rail'
    );
  } else {
    reasons.push(
      'Based on the information you have provided, there is no confirmed need to introduce a rail the other party may not already use'
    );
  }

  return reasons;
}

function tradeoffFor(id: LandingRouteId, query: LandingSearchQuery): string {
  const party = counterparty(query);
  switch (id) {
    case 'domestic_bank':
      return 'You keep fees and operational effort low, but give up speed if the other party needs funds immediately.';
    case 'international_bank':
      return query.priority === 'simplest'
        ? 'You keep the path familiar, but give up speed and some FX transparency on the receiving side.'
        : 'You save on complexity and setup, but give up speed.';
    case 'card_checkout':
      return 'You gain speed and less chasing, but you generally pay more in acceptance cost.';
    case 'local_currency_settlement':
      return `The ${party} is more likely to receive what they expect, but you take on more setup until their settlement preference is known.`;
    case 'stablecoin_settlement':
      return 'Settlement can be fast, but operational setup and treasury/accounting readiness can outweigh the network cost.';
    case 'direct_debit':
      return 'Repeat collection gets quieter, but a first-time or disputed invoice is a weak fit until a mandate exists.';
  }
}

function mainAdvantage(id: LandingRouteId, query: LandingSearchQuery): string {
  const party = counterparty(query);
  switch (id) {
    case 'domestic_bank':
      return 'Familiar local settlement with typically low operational overhead';
    case 'international_bank':
      return `Familiar ${party} settlement with relatively low operational overhead`;
    case 'card_checkout':
      return 'The other party can complete payment quickly from a link';
    case 'local_currency_settlement':
      return `The ${party} is paid in the currency they actually operate in`;
    case 'stablecoin_settlement':
      return 'Once both sides are ready, settlement is typically minutes to hours';
    case 'direct_debit':
      return 'After authorisation, collection can run without another checkout';
  }
}

function mainTradeoff(id: LandingRouteId): string {
  switch (id) {
    case 'domestic_bank':
      return 'Slower than instant or card collection when timing is tight';
    case 'international_bank':
      return 'Slower than alternative settlement methods';
    case 'card_checkout':
      return 'Higher acceptance cost than bank or scheduled collection';
    case 'local_currency_settlement':
      return 'More setup until the recipient’s settlement preference is known';
    case 'stablecoin_settlement':
      return 'Setup, wallets and treasury readiness can outweigh the network cost';
    case 'direct_debit':
      return 'Weak until a mandate exists; slow for a one-off first invoice';
  }
}

function couldChangeIf(query: LandingSearchQuery): string {
  const party = counterparty(query);
  if (query.transactionType === 'customer_collection') {
    return `Customer payment preference, cash position, connected rails or approval rules differ`;
  }
  return `${party.charAt(0).toUpperCase()}${party.slice(1)} terms, FX exposure, cash position or existing rails differ`;
}

function bestWhen(id: LandingRouteId, query: LandingSearchQuery): string {
  const party = counterparty(query);
  switch (id) {
    case 'domestic_bank':
      return `The ${party} already accepts local bank settlement and timing is not critical.`;
    case 'international_bank':
      return `The ${party} already accepts bank settlement and timing is not critical.`;
    case 'card_checkout':
      return 'You need the other party to pay quickly from a link, and acceptance cost is acceptable.';
    case 'local_currency_settlement':
      return `The ${party} needs to receive a specific currency and receiving-side FX uncertainty matters.`;
    case 'stablecoin_settlement':
      return 'Both sides already operate compatible wallets and treasury infrastructure.';
    case 'direct_debit':
      return 'The customer has authorised a pull, and this payment will repeat.';
  }
}

export function buildRecommendation(
  id: LandingRouteId,
  query: LandingSearchQuery,
  outlook: LandingPriorityOutlook[]
): LandingRecommendation {
  const current = query.priority;
  const alternative = outlook.find(
    (entry) => entry.priority !== current && entry.routeId !== id
  );
  const sameRouteOtherPriority = outlook.find(
    (entry) => entry.priority !== current && entry.routeId === id
  );

  let tradeoffShift: string;
  if (alternative) {
    tradeoffShift = `If ${priorityLabel(alternative.priority).toLowerCase()} were your priority instead, ${alternative.routeName} could become more attractive.`;
  } else if (sameRouteOtherPriority) {
    tradeoffShift = `Changing priority still keeps ${routeName(id)} in play for this payment — the reason it ranks first would change, not necessarily the rail.`;
  } else {
    tradeoffShift = 'Changing what you optimise for can change which route ranks first.';
  }

  return {
    why: whyForRoute(id, query),
    rankingReasons: rankingReasons(id, query),
    tradeoff: tradeoffFor(id, query),
    tradeoffShift,
    mainAdvantage: mainAdvantage(id, query),
    mainTradeoff: mainTradeoff(id),
    couldChangeIf: couldChangeIf(query),
    bestWhen: bestWhen(id, query),
  };
}

export function buildPriorityOutlook(
  query: LandingSearchQuery,
  rankFor: (next: LandingSearchQuery) => { id: LandingRouteId }[]
): LandingPriorityOutlook[] {
  const priorities: LandingPriorityId[] = ['lowest_cost', 'fastest', 'simplest'];
  return priorities.map((priority) => {
    const winner = rankFor({ ...query, priority })[0];
    if (!winner) {
      throw new Error('Landing comparison produced no routes');
    }
    return {
      priority,
      label: priorityLabel(priority),
      routeId: winner.id,
      routeName: routeName(winner.id),
    };
  });
}

type RoutePresentation = Omit<LandingComparedRoute, 'isGenericBest'>;

export function presentLandingRoute(
  id: LandingRouteId,
  query: LandingSearchQuery
): RoutePresentation {
  const amount = formatLandingAmount(query.amount, query.currency);
  const from = countryName(query.originCountry);
  const to = countryName(query.destinationCountry);
  const party = counterparty(query);
  const domestic = isDomestic(query);

  switch (id) {
    case 'domestic_bank':
      return {
        id,
        name: routeName(id),
        summary: `Move ${amount} inside ${from} through a local bank rail.`,
        costLabel: 'Typically the lowest fees',
        speedLabel: 'Same day to 2 business days',
        operationalEffortLabel: 'Low',
        bestWhen: bestWhen(id, query),
        chooseWhen: `Choose this when the ${party} already banks locally and you want the most familiar, typically cheapest path.`,
        tradeoff: 'Little leakage, but not the fastest if the other party needs funds immediately.',
      };
    case 'international_bank':
      return {
        id,
        name: routeName(id),
        summary: `Send ${amount} from ${from} to ${to} on a correspondent bank path.`,
        costLabel: 'Mid-range',
        speedLabel: '1–4 business days',
        operationalEffortLabel: 'Low–moderate',
        bestWhen: bestWhen(id, query),
        chooseWhen: `Choose this when the ${party} already accepts bank settlement and you want a familiar path without standing up another rail.`,
        tradeoff: 'Predictable operations, rarely the fastest or cheapest in every corridor.',
      };
    case 'card_checkout':
      return {
        id,
        name: routeName(id),
        summary:
          query.transactionType === 'customer_collection' || query.transactionType === 'revenue_share'
            ? `Collect ${amount} with a payment link the other party can complete in minutes.`
            : `Request ${amount} over a card checkout if speed matters more than fee.`,
        costLabel: 'Higher acceptance cost',
        speedLabel: 'Minutes, once the payer completes checkout',
        operationalEffortLabel: 'Low once the link is sent',
        bestWhen: bestWhen(id, query),
        chooseWhen:
          'Choose this when the other party can pay from a link and getting funds moving matters more than minimising acceptance cost.',
        tradeoff: 'You usually pay more to get paid faster and with less chasing.',
      };
    case 'local_currency_settlement':
      return {
        id,
        name: routeName(id),
        summary: `Arrange ${amount} so the recipient in ${to} is paid the way they actually operate.`,
        costLabel: 'Can reduce receiving-side FX surprise',
        speedLabel: '1–3 business days after setup',
        operationalEffortLabel: 'Moderate',
        bestWhen: bestWhen(id, query),
        chooseWhen: `Choose this when the ${party} needs to receive a specific currency and avoiding receiving-side FX uncertainty matters more than minimising setup.`,
        tradeoff: `More setup and dependency on the ${party}'s settlement preference.`,
      };
    case 'stablecoin_settlement':
      return {
        id,
        name: routeName(id),
        summary: domestic
          ? `Settle ${amount} on a digital-dollar rail if treasury and wallets are already in place.`
          : `Move ${amount} from ${from} to ${to} once wallets and treasury are ready.`,
        costLabel: 'Low network cost — setup is the real cost',
        speedLabel: 'Minutes to hours after wallets are ready',
        operationalEffortLabel: 'High until wallets exist',
        bestWhen: bestWhen(id, query),
        chooseWhen:
          'Choose this when both sides already operate compatible wallets and treasury infrastructure.',
        tradeoff:
          'Potentially fast settlement, but operational setup and accounting/treasury readiness can outweigh the network cost.',
      };
    case 'direct_debit':
      return {
        id,
        name: routeName(id),
        summary: `Collect ${amount} in ${from} after the customer has authorised a pull.`,
        costLabel: 'Typically lower than cards',
        speedLabel: '2–5 days after authorisation',
        operationalEffortLabel: 'Moderate to set up, then low',
        bestWhen: bestWhen(id, query),
        chooseWhen:
          'Choose this when the customer has authorised a pull and the payment will repeat.',
        tradeoff: 'Strong for repeats. Weak for a first-time or disputed invoice.',
      };
  }
}
