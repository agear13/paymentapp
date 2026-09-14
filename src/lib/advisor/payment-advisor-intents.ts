export const PAYMENT_ADVISOR_DEMO_INTENTS = [
  {
    id: 'best_rail_recommendation',
    label: 'How should I pay my Indonesian supplier A$100,000?',
    patterns: [
      /indonesian supplier/i,
      /100,?000/i,
      /which payment rail/i,
      /best.*rail/i,
      /what.*recommend/i,
      /best way to pay/i,
    ],
  },
  {
    id: 'explain_recommendation',
    label: 'Why that recommendation?',
    patterns: [/why.*recommend/i, /explain.*recommend/i, /why did you pick/i, /why that/i],
  },
  {
    id: 'airwallex_scenario_comparison',
    label: 'What if I use Airwallex instead?',
    patterns: [/airwallex/i, /what happens if i use/i, /scenario comparison/i, /compare.*airwallex/i],
  },
  {
    id: 'wise_rail_health',
    label: 'How is Wise performing right now?',
    patterns: [/wise.*health/i, /wise.*perform/i, /problems.*rail/i, /rail health/i, /wise.*monitor/i],
  },
] as const;

export type PaymentAdvisorIntentId = (typeof PAYMENT_ADVISOR_DEMO_INTENTS)[number]['id'];

export function resolvePaymentAdvisorIntent(input: {
  intent?: string | null;
  question?: string | null;
}): PaymentAdvisorIntentId | null {
  if (input.intent) {
    const match = PAYMENT_ADVISOR_DEMO_INTENTS.find((item) => item.id === input.intent);
    if (match) return match.id;
  }

  const question = input.question?.trim();
  if (!question) return null;

  for (const item of PAYMENT_ADVISOR_DEMO_INTENTS) {
    if (item.patterns.some((pattern) => pattern.test(question))) {
      return item.id;
    }
  }

  return null;
}
