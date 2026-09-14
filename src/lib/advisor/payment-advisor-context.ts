import {
  isLandingCountryCode,
  isLandingPriorityId,
  isLandingTransactionTypeId,
  type LandingCountryCode,
  type LandingPriorityId,
  type LandingSearchQuery,
  type LandingTransactionTypeId,
} from '@/lib/journey/landing-route-model';

/** Advisor-facing priority labels. Some map to engine priorities; others are contextual only. */
export const PAYMENT_ADVISOR_PRIORITIES = [
  'balanced',
  'lowest_cost',
  'fastest',
  'reliability',
  'best_fit',
  'simplest',
] as const;

export type PaymentAdvisorPriority = (typeof PAYMENT_ADVISOR_PRIORITIES)[number];

export type PaymentAdvisorPaymentContextInput = {
  origin: string;
  destination: string;
  amount: number;
  sourceCurrency: string;
  destinationCurrency?: string | null;
  priority?: string;
  transactionType?: string;
};

export type PaymentAdvisorPaymentContext = {
  origin: LandingCountryCode;
  destination: LandingCountryCode;
  amount: number;
  sourceCurrency: string;
  destinationCurrency: string | null;
  priority: PaymentAdvisorPriority;
  transactionType: LandingTransactionTypeId;
};

export type PaymentAdvisorParameterUsage = {
  /** Passed to compareLandingRoutes / decideRoute. */
  engineUsed: Array<
    | 'origin'
    | 'destination'
    | 'amount'
    | 'sourceCurrency'
    | 'destinationCurrency'
    | 'priority'
    | 'transactionType'
  >;
  /** Preserved at Advisor layer but not consumed by ranking/decision today. */
  contextualOnly: Array<'destinationCurrency' | 'priority'>;
  enginePriority: LandingPriorityId;
  requestedPriority: PaymentAdvisorPriority;
};

export const FLAGSHIP_ADVISOR_PAYMENT: PaymentAdvisorPaymentContext = {
  origin: 'AU',
  destination: 'ID',
  amount: 100_000,
  sourceCurrency: 'AUD',
  destinationCurrency: 'IDR',
  priority: 'balanced',
  transactionType: 'supplier_payment',
};

const PRIORITY_TO_ENGINE: Partial<Record<PaymentAdvisorPriority, LandingPriorityId>> = {
  balanced: 'best_fit',
  best_fit: 'best_fit',
  lowest_cost: 'lowest_cost',
  fastest: 'fastest',
  simplest: 'simplest',
};

export function normalizeAdvisorPriority(value: string | undefined): PaymentAdvisorPriority {
  if (!value) return 'balanced';
  if ((PAYMENT_ADVISOR_PRIORITIES as readonly string[]).includes(value)) {
    return value as PaymentAdvisorPriority;
  }
  if (isLandingPriorityId(value)) {
    return value as PaymentAdvisorPriority;
  }
  if (value === 'operational_resilience') return 'reliability';
  return 'balanced';
}

export function resolveAdvisorParameterUsage(
  context: PaymentAdvisorPaymentContext
): PaymentAdvisorParameterUsage {
  const requestedPriority = context.priority;
  const mapped = PRIORITY_TO_ENGINE[requestedPriority];
  const enginePriority = mapped ?? 'best_fit';

  const engineUsed: PaymentAdvisorParameterUsage['engineUsed'] = [
    'origin',
    'destination',
    'amount',
    'sourceCurrency',
    'transactionType',
    'priority',
  ];
  const contextualOnly: PaymentAdvisorParameterUsage['contextualOnly'] = [];

  if (context.destinationCurrency) {
    engineUsed.push('destinationCurrency');
  }

  if (requestedPriority === 'reliability') {
    contextualOnly.push('priority');
  }

  return {
    engineUsed,
    contextualOnly,
    enginePriority,
    requestedPriority,
  };
}

export function toLandingSearchQuery(context: PaymentAdvisorPaymentContext): LandingSearchQuery {
  const usage = resolveAdvisorParameterUsage(context);
  return {
    originCountry: context.origin,
    destinationCountry: context.destination,
    amount: context.amount,
    currency: context.sourceCurrency,
    destinationCurrency: context.destinationCurrency,
    transactionType: context.transactionType,
    priority: usage.enginePriority,
  };
}

export function parsePaymentAdvisorContext(
  input?: Partial<PaymentAdvisorPaymentContextInput> | null
): { ok: true; context: PaymentAdvisorPaymentContext } | { ok: false; error: string } {
  const merged = {
    ...FLAGSHIP_ADVISOR_PAYMENT,
    ...input,
    origin: input?.origin ?? FLAGSHIP_ADVISOR_PAYMENT.origin,
    destination: input?.destination ?? FLAGSHIP_ADVISOR_PAYMENT.destination,
    amount: input?.amount ?? FLAGSHIP_ADVISOR_PAYMENT.amount,
    sourceCurrency: input?.sourceCurrency ?? FLAGSHIP_ADVISOR_PAYMENT.sourceCurrency,
    destinationCurrency:
      input?.destinationCurrency === undefined
        ? FLAGSHIP_ADVISOR_PAYMENT.destinationCurrency
        : input.destinationCurrency,
    priority: normalizeAdvisorPriority(input?.priority),
    transactionType:
      input?.transactionType && isLandingTransactionTypeId(input.transactionType)
        ? input.transactionType
        : FLAGSHIP_ADVISOR_PAYMENT.transactionType,
  };

  if (!isLandingCountryCode(merged.origin)) {
    return { ok: false, error: `Unsupported origin country: ${merged.origin}` };
  }
  if (!isLandingCountryCode(merged.destination)) {
    return { ok: false, error: `Unsupported destination country: ${merged.destination}` };
  }
  if (!Number.isFinite(merged.amount) || merged.amount <= 0) {
    return { ok: false, error: 'Amount must be a positive number.' };
  }
  if (!merged.sourceCurrency.trim()) {
    return { ok: false, error: 'Source currency is required.' };
  }

  return {
    ok: true,
    context: {
      origin: merged.origin,
      destination: merged.destination,
      amount: merged.amount,
      sourceCurrency: merged.sourceCurrency,
      destinationCurrency: merged.destinationCurrency ?? null,
      priority: merged.priority,
      transactionType: merged.transactionType,
    },
  };
}
