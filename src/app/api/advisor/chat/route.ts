import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';
import { runAdvisorChat } from '@/lib/advisor/advisor-chat-orchestrator.server';
import { isAdvisorChatEnabledServer } from '@/lib/advisor/advisor-chat-config';
import { PAYMENT_ADVISOR_PRIORITIES } from '@/lib/advisor/payment-advisor-context';
import { loadAdvisorIntelligenceContext } from '@/lib/advisor/load-advisor-intelligence.server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { recordAdvisorActivity } from '@/lib/email/lifecycle/server-advisor-signal';
import { LANDING_TRANSACTION_TYPES } from '@/lib/journey/landing-route-model';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(4000),
});

const paymentSchema = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  amount: z.number().positive().optional(),
  sourceCurrency: z.string().optional(),
  destinationCurrency: z.string().nullable().optional(),
  priority: z.enum(PAYMENT_ADVISOR_PRIORITIES).optional(),
  transactionType: z
    .enum(LANDING_TRANSACTION_TYPES.map((item) => item.id) as [string, ...string[]])
    .optional(),
});

const schema = z.object({
  message: z.string().min(1).max(4000),
  messages: z.array(messageSchema).max(40).optional(),
  sessionPaymentContext: paymentSchema.optional(),
});

/** POST /api/advisor/chat — natural-language Advisor with deterministic tool grounding */
export async function POST(request: NextRequest) {
  if (!isAdvisorChatEnabledServer()) {
    return apiError('Advisor chat is not enabled.', 404, 'ADVISOR_CHAT_DISABLED');
  }

  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response;

  const { data: body, error } = await validateBody(request, schema);
  if (error) return error;

  const org = await getOrganizationForAuthenticatedUser(auth.user.id);
  const intelligence = await loadAdvisorIntelligenceContext();

  const result = await runAdvisorChat({
    message: body!.message,
    messages: body!.messages,
    sessionPaymentContext: body!.sessionPaymentContext,
    intelligence,
  });

  const auditContext = extractRequestAuditContext(request);

  if ('error' in result) {
    await recordAdvisorActivity({
      userId: auth.user.id,
      organizationId: org?.id,
      action: 'engaged_prompt',
      metadata: {
        channel: 'advisor_chat',
        ok: false,
        error: result.error,
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    }).catch(() => {});
    return apiResponse({ ok: false, error: result.error }, 200);
  }

  await recordAdvisorActivity({
    userId: auth.user.id,
    organizationId: org?.id,
    action: 'engaged_prompt',
    metadata: {
      channel: 'advisor_chat',
      ok: true,
      toolUsed: result.toolUsed,
      routingMode: result.routingMode,
      paymentContext: result.sessionPaymentContext,
      recommendedProvider: result.recommendation?.providerName ?? null,
    },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  }).catch(() => {});

  return apiResponse({
    ok: true,
    answer: result.answer,
    toolUsed: result.toolUsed,
    routingMode: result.routingMode,
    sessionPaymentContext: result.sessionPaymentContext,
    intent: result.intent,
    paymentContext: result.paymentContext,
    parameterUsage: result.parameterUsage,
    recommendation: result.recommendation,
    alternatives: result.alternatives,
    reasons: result.reasons,
    tradeoffs: result.tradeoffs,
    unknowns: result.unknowns,
    explanation: result.explanation,
    scenarioComparison: result.scenarioComparison,
    monitoring: result.monitoring,
    evidence: result.evidence,
    dataFreshness: result.dataFreshness,
    whatCouldChange: result.whatCouldChange,
  });
}
