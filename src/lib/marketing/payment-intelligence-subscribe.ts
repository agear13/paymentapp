import { z } from 'zod';
import {
  countryName,
  isLandingCountryCode,
} from '@/lib/journey/landing-route-model';

export const PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE = 'payment_intelligence';
export const PAYMENT_INTELLIGENCE_SUBSCRIBE_PATH = '/';
export const PAYMENT_INTELLIGENCE_SUBSCRIBE_ANCHOR = 'payment-intelligence-inbox';

export const PAYMENT_INTELLIGENCE_TOPICS = [
  {
    id: 'rail_updates',
    title: 'Payment rail updates',
    detail: 'new corridors, capabilities and availability',
  },
  {
    id: 'routes_to_consider',
    title: 'Routes to consider',
    detail: 'alternative or backup rails worth knowing about',
  },
  {
    id: 'regulatory_changes',
    title: 'Regulatory changes',
    detail: 'developments that could affect how businesses pay or get paid',
  },
  {
    id: 'business_impact',
    title: 'Business impact',
    detail: 'what changed, why it matters and what you might want to do',
  },
] as const;

export type PaymentIntelligenceTopicId = (typeof PAYMENT_INTELLIGENCE_TOPICS)[number]['id'];

export type PaymentIntelligenceSubscribeContext = {
  origin?: string | null;
  destination?: string | null;
  compared?: boolean;
  topics?: PaymentIntelligenceTopicId[];
};

export const paymentIntelligenceEmailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());

export const paymentIntelligenceSubscribeBodySchema = z.object({
  email: paymentIntelligenceEmailSchema,
  consent: z.literal(true),
  origin: z.string().trim().max(8).optional(),
  destination: z.string().trim().max(8).optional(),
  compared: z.boolean().optional(),
  turnstileToken: z.string().min(1).optional(),
});

export const normalizePaymentIntelligenceEmail = (email: string): string =>
  email.trim().toLowerCase();

export const paymentIntelligenceLandingPage = (
  context?: PaymentIntelligenceSubscribeContext
): string => {
  if (
    context?.compared &&
    context.origin &&
    context.destination &&
    isLandingCountryCode(context.origin) &&
    isLandingCountryCode(context.destination)
  ) {
    return `/?corridor=${context.origin}-${context.destination}`;
  }
  return PAYMENT_INTELLIGENCE_SUBSCRIBE_PATH;
};

export type PaymentIntelligenceSubscribeCopy = {
  eyebrow: string;
  heading: string;
  lead: string;
  support: string | null;
  topics: typeof PAYMENT_INTELLIGENCE_TOPICS;
};

export const presentPaymentIntelligenceSubscribe = (
  context?: PaymentIntelligenceSubscribeContext
): PaymentIntelligenceSubscribeCopy => {
  if (
    context?.compared &&
    context.origin &&
    context.destination &&
    isLandingCountryCode(context.origin) &&
    isLandingCountryCode(context.destination)
  ) {
    return {
      eyebrow: 'PAYMENT INTELLIGENCE',
      heading: `Want payment intelligence for ${countryName(context.origin)} → ${countryName(context.destination)}?`,
      lead: 'Get relevant rail changes, alternative routes and regulatory developments in your inbox.',
      support: null,
      topics: PAYMENT_INTELLIGENCE_TOPICS,
    };
  }

  return {
    eyebrow: 'PAYMENT INTELLIGENCE',
    heading: 'Payment Intelligence, in your inbox',
    lead: 'Payment rails change. Providers launch new routes. Regulations move. Backup options appear.',
    support:
      'Get the developments that matter for moving money — and what they mean for your business.',
    topics: PAYMENT_INTELLIGENCE_TOPICS,
  };
};
