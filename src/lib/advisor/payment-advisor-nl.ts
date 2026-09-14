import {
  FLAGSHIP_ADVISOR_PAYMENT,
  normalizeAdvisorPriority,
  type PaymentAdvisorPaymentContextInput,
} from '@/lib/advisor/payment-advisor-context';
import type { AdvisorToolName } from '@/lib/advisor/payment-advisor-tools';

export type AdvisorConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AdvisorNlExtraction = {
  tool: AdvisorToolName;
  paymentPatches: Partial<PaymentAdvisorPaymentContextInput>;
};

function parseAmount(text: string): number | undefined {
  const normalized = text.replace(/,/g, '');
  const match = normalized.match(/(?:a?\$?\s*|aud\s*)?(\d+(?:\.\d+)?)\s*k?\b/i);
  if (!match) return undefined;
  let amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  if (/\d\s*k\b/i.test(normalized) || /\$?\d+k\b/i.test(normalized)) {
    amount *= 1000;
  }
  return amount;
}

export function extractPaymentPatchesFromMessage(message: string): Partial<PaymentAdvisorPaymentContextInput> {
  const lower = message.toLowerCase();
  const patches: Partial<PaymentAdvisorPaymentContextInput> = {};

  const amount = parseAmount(message);
  if (amount !== undefined) patches.amount = amount;

  if (/\bindonesia\b|\bindonesian\b|\b→\s*id\b|\bto id\b|\bidr\b/i.test(message)) {
    patches.origin = patches.origin ?? 'AU';
    patches.destination = 'ID';
    patches.sourceCurrency = patches.sourceCurrency ?? 'AUD';
    patches.destinationCurrency = 'IDR';
    patches.transactionType = patches.transactionType ?? 'supplier_payment';
  }

  if (/\baustralia\b|\bau →|\bfrom au\b/i.test(message)) {
    patches.origin = 'AU';
    patches.sourceCurrency = patches.sourceCurrency ?? 'AUD';
  }

  if (/\bsupplier\b|\bpay my supplier\b|\bpay a supplier\b/i.test(lower)) {
    patches.transactionType = 'supplier_payment';
  }

  if (/\bcheapest\b|\blowest cost\b|\blowest_cost\b/i.test(lower)) {
    patches.priority = 'lowest_cost';
  } else if (/\bfastest\b|\bas fast as possible\b/i.test(lower)) {
    patches.priority = 'fastest';
  } else if (/\bbalanced\b|\bbest fit\b|\bbest way\b|\bbest option\b/i.test(lower)) {
    patches.priority = 'balanced';
  } else if (/\breliab/i.test(lower)) {
    patches.priority = 'reliability';
  }

  return patches;
}

export function routeAdvisorToolFromMessage(message: string): AdvisorToolName {
  const lower = message.toLowerCase();

  if (
    /\bwise\b.*\b(problem|issue|health|perform|outage|down|monitor|status)\b/i.test(message) ||
    /\b(problem|issue|health|perform|outage|down|monitor|status)\b.*\bwise\b/i.test(message) ||
    /\bany problems with\b/i.test(lower)
  ) {
    return 'check_payment_rail_health';
  }

  if (/\bairwallex\b/i.test(message) || /\bwhat if i use\b/i.test(lower) || /\binstead\b/i.test(lower)) {
    return 'compare_payment_rail';
  }

  if (
    /\bwhy\b/i.test(lower) ||
    /\bexplain\b/i.test(lower) ||
    /\bwhat would change\b/i.test(lower) ||
    /\breason\b/i.test(lower)
  ) {
    return 'explain_payment_recommendation';
  }

  return 'recommend_payment_rail';
}

export function mergeAdvisorPaymentContext(
  session: Partial<PaymentAdvisorPaymentContextInput> | undefined,
  extracted: Partial<PaymentAdvisorPaymentContextInput>
): Partial<PaymentAdvisorPaymentContextInput> {
  return {
    ...FLAGSHIP_ADVISOR_PAYMENT,
    ...session,
    ...extracted,
    priority: normalizeAdvisorPriority(extracted.priority ?? session?.priority ?? FLAGSHIP_ADVISOR_PAYMENT.priority),
  };
}

export function extractAdvisorNl(message: string): AdvisorNlExtraction {
  return {
    tool: routeAdvisorToolFromMessage(message),
    paymentPatches: extractPaymentPatchesFromMessage(message),
  };
}

export function buildDeterministicRouting(
  message: string,
  sessionPaymentContext?: Partial<PaymentAdvisorPaymentContextInput> | null
): { tool: AdvisorToolName; payment: Partial<PaymentAdvisorPaymentContextInput> } {
  const extracted = extractAdvisorNl(message);
  return {
    tool: extracted.tool,
    payment: mergeAdvisorPaymentContext(sessionPaymentContext ?? undefined, extracted.paymentPatches),
  };
}
