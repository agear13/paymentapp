import { compareLandingRoutes } from '@/lib/journey/landing-route-comparison';
import { LANDING_TRANSACTION_TYPES } from '@/lib/journey/landing-route-model';
import { answerPaymentAdvisorQuestion } from '@/lib/advisor/payment-advisor';
import {
  parsePaymentAdvisorContext,
  PAYMENT_ADVISOR_PRIORITIES,
  toLandingSearchQuery,
  type PaymentAdvisorPaymentContextInput,
} from '@/lib/advisor/payment-advisor-context';
import type { PaymentAdvisorIntentId } from '@/lib/advisor/payment-advisor-intents';
import type { PaymentAdvisorResponse } from '@/lib/advisor/payment-advisor-types';
import type { PublicRouteIntelligenceSnapshotInput } from '@/lib/route-intelligence';

export const ADVISOR_TOOL_NAMES = [
  'recommend_payment_rail',
  'explain_payment_recommendation',
  'compare_payment_rail',
  'check_payment_rail_health',
] as const;

export type AdvisorToolName = (typeof ADVISOR_TOOL_NAMES)[number];

const TOOL_TO_INTENT: Record<AdvisorToolName, PaymentAdvisorIntentId> = {
  recommend_payment_rail: 'best_rail_recommendation',
  explain_payment_recommendation: 'explain_recommendation',
  compare_payment_rail: 'airwallex_scenario_comparison',
  check_payment_rail_health: 'wise_rail_health',
};

export type PaymentAdvisorToolResult = PaymentAdvisorResponse & {
  tool: AdvisorToolName;
  whatCouldChange?: string[];
};

export type AdvisorToolPaymentInput = Partial<PaymentAdvisorPaymentContextInput> & {
  scenarioProviderId?: 'airwallex';
};

export function advisorToolOpenAiDefinitions() {
  const transactionTypes = LANDING_TRANSACTION_TYPES.map((item) => item.id);
  const paymentProperties = {
    origin: { type: 'string', description: 'Origin country code, e.g. AU' },
    destination: { type: 'string', description: 'Destination country code, e.g. ID' },
    amount: { type: 'number', description: 'Payment amount in source currency' },
    sourceCurrency: { type: 'string', description: 'Source currency code, e.g. AUD' },
    destinationCurrency: { type: 'string', description: 'Destination currency code, e.g. IDR' },
    priority: {
      type: 'string',
      enum: [...PAYMENT_ADVISOR_PRIORITIES],
      description: 'Payment priority such as balanced, lowest_cost, fastest, reliability',
    },
    transactionType: {
      type: 'string',
      enum: transactionTypes,
      description: 'Payment type such as supplier_payment',
    },
  };

  return [
    {
      type: 'function' as const,
      function: {
        name: 'recommend_payment_rail',
        description:
          'Get Provvy deterministic best payment rail recommendation for structured payment inputs.',
        parameters: {
          type: 'object',
          properties: paymentProperties,
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'explain_payment_recommendation',
        description:
          'Explain the current recommendation using Provvy shadow decision evidence. Do not invent reasons.',
        parameters: {
          type: 'object',
          properties: paymentProperties,
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'compare_payment_rail',
        description:
          'Compare an alternative provider scenario (default Airwallex) against the current recommendation using catalogue/intelligence data only.',
        parameters: {
          type: 'object',
          properties: {
            ...paymentProperties,
            scenarioProviderId: {
              type: 'string',
              enum: ['airwallex'],
              description: 'Provider to compare against the recommendation',
            },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'check_payment_rail_health',
        description:
          'Check monitored operational health for Wise payment rails. Not real-time; returns observation freshness.',
        parameters: {
          type: 'object',
          properties: {
            ...paymentProperties,
            providerId: {
              type: 'string',
              enum: ['wise'],
              description: 'Monitored provider',
            },
          },
          additionalProperties: false,
        },
      },
    },
  ];
}

export function runPaymentAdvisorTool(
  tool: AdvisorToolName,
  payment: Partial<PaymentAdvisorPaymentContextInput> | null | undefined,
  intelligence: PublicRouteIntelligenceSnapshotInput = {}
): PaymentAdvisorToolResult | { error: string } {
  const intent = TOOL_TO_INTENT[tool];
  const result = answerPaymentAdvisorQuestion({
    intent,
    payment,
    intelligence,
  });

  if ('error' in result) {
    return result;
  }

  const parsed = parsePaymentAdvisorContext(payment);
  const whatCouldChange =
    tool === 'recommend_payment_rail' && parsed.ok
      ? compareLandingRoutes(toLandingSearchQuery(parsed.context), intelligence).whatCouldChange
      : undefined;

  return {
    ...result,
    tool,
    whatCouldChange,
  };
}
