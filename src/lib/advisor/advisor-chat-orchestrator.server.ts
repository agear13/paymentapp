import 'server-only';

import OpenAI from 'openai';
import { isOpenAIConfigured } from '@/lib/agreement-analyzer/extraction/core/openai-client';
import {
  ADVISOR_CHAT_EXPLAIN_SYSTEM_PROMPT,
  ADVISOR_CHAT_SYSTEM_PROMPT,
} from '@/lib/advisor/advisor-chat-system-prompt';
import { getAdvisorChatModel } from '@/lib/advisor/advisor-chat-config';
import {
  buildDeterministicRouting,
  type AdvisorConversationMessage,
} from '@/lib/advisor/payment-advisor-nl';
import {
  advisorToolOpenAiDefinitions,
  runPaymentAdvisorTool,
  type AdvisorToolName,
  type PaymentAdvisorToolResult,
} from '@/lib/advisor/payment-advisor-tools';
import {
  parsePaymentAdvisorContext,
  type PaymentAdvisorPaymentContext,
  type PaymentAdvisorPaymentContextInput,
} from '@/lib/advisor/payment-advisor-context';
import type { PublicRouteIntelligenceSnapshotInput } from '@/lib/route-intelligence';

export type AdvisorChatOrchestratorInput = {
  message: string;
  messages?: AdvisorConversationMessage[];
  sessionPaymentContext?: Partial<PaymentAdvisorPaymentContextInput> | null;
  intelligence: PublicRouteIntelligenceSnapshotInput;
  useLlm?: boolean;
};

export type AdvisorChatOrchestratorResult = PaymentAdvisorToolResult & {
  answer: string;
  toolUsed: AdvisorToolName;
  sessionPaymentContext: PaymentAdvisorPaymentContext;
  routingMode: 'llm' | 'deterministic';
};

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  return new OpenAI({ apiKey });
}

function parseToolArgs(raw: unknown): Partial<PaymentAdvisorPaymentContextInput> {
  if (!raw || typeof raw !== 'object') return {};
  const value = raw as Record<string, unknown>;
  const payment: Partial<PaymentAdvisorPaymentContextInput> = {};
  if (typeof value.origin === 'string') payment.origin = value.origin;
  if (typeof value.destination === 'string') payment.destination = value.destination;
  if (typeof value.amount === 'number') payment.amount = value.amount;
  if (typeof value.sourceCurrency === 'string') payment.sourceCurrency = value.sourceCurrency;
  if (typeof value.destinationCurrency === 'string') payment.destinationCurrency = value.destinationCurrency;
  if (typeof value.priority === 'string') payment.priority = value.priority;
  if (typeof value.transactionType === 'string') payment.transactionType = value.transactionType;
  return payment;
}

async function selectToolWithLlm(input: AdvisorChatOrchestratorInput): Promise<{
  tool: AdvisorToolName;
  payment: Partial<PaymentAdvisorPaymentContextInput>;
}> {
  const client = getOpenAIClient();
  const sessionContext = input.sessionPaymentContext ?? {};
  const history = (input.messages ?? []).slice(-8).map((item) => ({
    role: item.role,
    content: item.content,
  }));

  const response = await client.chat.completions.create({
    model: getAdvisorChatModel(),
    temperature: 0,
    tools: advisorToolOpenAiDefinitions(),
    tool_choice: 'required',
    messages: [
      { role: 'system', content: ADVISOR_CHAT_SYSTEM_PROMPT },
      {
        role: 'system',
        content: `Current session payment context JSON:\n${JSON.stringify(sessionContext)}`,
      },
      ...history,
      { role: 'user', content: input.message },
    ],
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.name) {
    throw new Error('Advisor LLM did not select a tool.');
  }

  const tool = toolCall.function.name as AdvisorToolName;
  const llmPayment = parseToolArgs(JSON.parse(toolCall.function.arguments || '{}'));
  const deterministic = buildDeterministicRouting(input.message, sessionContext);

  return {
    tool,
    payment: {
      ...deterministic.payment,
      ...llmPayment,
      priority: llmPayment.priority ?? deterministic.payment.priority,
    },
  };
}

function formatDeterministicAnswer(result: PaymentAdvisorToolResult): string {
  return result.answer;
}

async function explainToolResultWithLlm(
  userMessage: string,
  toolResult: PaymentAdvisorToolResult
): Promise<string> {
  const client = getOpenAIClient();
  const payload = {
    userQuestion: userMessage,
    tool: toolResult.tool,
    paymentContext: toolResult.paymentContext,
    recommendation: toolResult.recommendation,
    alternatives: toolResult.alternatives,
    reasons: toolResult.reasons,
    tradeoffs: toolResult.tradeoffs,
    unknowns: toolResult.unknowns,
    evidence: toolResult.evidence,
    explanation: toolResult.explanation,
    scenarioComparison: toolResult.scenarioComparison,
    monitoring: toolResult.monitoring,
    dataFreshness: toolResult.dataFreshness,
    whatCouldChange: toolResult.whatCouldChange,
    deterministicSummary: toolResult.answer,
  };

  const response = await client.chat.completions.create({
    model: getAdvisorChatModel(),
    temperature: 0,
    messages: [
      { role: 'system', content: ADVISOR_CHAT_EXPLAIN_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Tool result JSON:\n${JSON.stringify(payload)}\n\nWrite the assistant reply.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  return content || formatDeterministicAnswer(toolResult);
}

export async function runAdvisorChat(
  input: AdvisorChatOrchestratorInput
): Promise<AdvisorChatOrchestratorResult | { error: string }> {
  const deterministicRoute = buildDeterministicRouting(
    input.message,
    input.sessionPaymentContext ?? undefined
  );

  let routingMode: 'llm' | 'deterministic' = 'deterministic';
  let tool = deterministicRoute.tool;
  let payment = deterministicRoute.payment;

  const shouldUseLlm = input.useLlm !== false && isOpenAIConfigured();
  if (shouldUseLlm) {
    try {
      const llmRoute = await selectToolWithLlm(input);
      tool = llmRoute.tool;
      payment = llmRoute.payment;
      routingMode = 'llm';
    } catch {
      routingMode = 'deterministic';
      tool = deterministicRoute.tool;
      payment = deterministicRoute.payment;
    }
  }

  const toolResult = runPaymentAdvisorTool(tool, payment, input.intelligence);
  if ('error' in toolResult) {
    return toolResult;
  }

  const parsed = parsePaymentAdvisorContext(payment);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  let answer = formatDeterministicAnswer(toolResult);
  if (shouldUseLlm && routingMode === 'llm') {
    try {
      answer = await explainToolResultWithLlm(input.message, toolResult);
    } catch {
      answer = formatDeterministicAnswer(toolResult);
    }
  }

  return {
    ...toolResult,
    answer,
    toolUsed: tool,
    sessionPaymentContext: parsed.context,
    routingMode,
  };
}
