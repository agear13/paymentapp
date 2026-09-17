'use client';

import { useMemo, useState } from 'react';
import { Loader2, SendHorizontal } from 'lucide-react';
import { isAdvisorChatEnabledClient } from '@/lib/advisor/advisor-chat-config';
import type { PaymentAdvisorPaymentContextInput } from '@/lib/advisor/payment-advisor-context';
import type {
  AdvisorMonitoringSnapshot,
  AdvisorOfferingSnapshot,
  PaymentAdvisorResponse,
} from '@/lib/advisor/payment-advisor-types';
import { OnboardingReadinessPanel } from '@/components/business-passport/onboarding-readiness-panel';
import { selectPassportOffering } from '@/lib/business-passport/select-offering';

export const ADVISOR_SUGGESTED_QUESTIONS = [
  'How should I pay my Indonesian supplier A$100,000?',
  'Why did you recommend Wise?',
  'What if I use Airwallex instead?',
  'Are there any problems with Wise right now?',
] as const;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intelligence?: Omit<PaymentAdvisorResponse, 'answer'> & {
    toolUsed?: string;
    whatCouldChange?: string[];
  };
};

function IntelligenceCard({
  intelligence,
}: {
  intelligence: NonNullable<ChatMessage['intelligence']>;
}) {
  const recommendation = intelligence.recommendation;
  const monitoring = intelligence.monitoring;
  const passportOffering = selectPassportOffering({
    scenarioOffering: intelligence.scenarioComparison?.scenarioOffering
      ? {
          offeringId: intelligence.scenarioComparison.scenarioOffering.offeringId,
          providerId: intelligence.scenarioComparison.scenarioOffering.providerId,
          providerName: intelligence.scenarioComparison.scenarioOffering.providerName,
        }
      : null,
    alternatives: intelligence.alternatives,
  });

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/30 p-3 text-[12px]">
      {recommendation ? (
        <div>
          <div className="font-medium text-foreground">Recommendation</div>
          <p className="mt-1 text-ink-soft">
            {recommendation.providerName} · {recommendation.pricing.totalLabel} ·{' '}
            {recommendation.pricing.kind.replace(/_/g, ' ')}
          </p>
        </div>
      ) : null}

      {intelligence.alternatives.length > 0 ? (
        <div>
          <div className="font-medium text-foreground">Alternatives</div>
          <ul className="mt-1 space-y-1 text-ink-soft">
            {intelligence.alternatives.slice(0, 3).map((item: AdvisorOfferingSnapshot) => (
              <li key={item.offeringId}>
                {item.providerName} — {item.pricing.totalLabel} (rank {item.rank})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {intelligence.reasons.length > 0 ? (
        <div>
          <div className="font-medium text-foreground">Reasons</div>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-soft">
            {intelligence.reasons.map((item) => (
              <li key={item.kind}>{item.text}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {intelligence.tradeoffs.length > 0 ? (
        <div>
          <div className="font-medium text-foreground">Trade-offs</div>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-soft">
            {intelligence.tradeoffs.map((item) => (
              <li key={item.kind}>{item.text}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {intelligence.unknowns.length > 0 ? (
        <div>
          <div className="font-medium text-foreground">Unknowns</div>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-soft">
            {intelligence.unknowns.map((item) => (
              <li key={item.kind}>{item.text}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {monitoring ? (
        <div>
          <div className="font-medium text-foreground">Monitoring</div>
          <p className="mt-1 text-ink-soft">
            {(monitoring as AdvisorMonitoringSnapshot).status} ·{' '}
            {(monitoring as AdvisorMonitoringSnapshot).freshness.label}
          </p>
        </div>
      ) : null}

      {passportOffering ? (
        <OnboardingReadinessPanel
          offeringId={passportOffering.offeringId}
          providerName={passportOffering.providerName}
        />
      ) : null}

      <p className="text-[11px] text-ink-soft">{intelligence.dataFreshness.disclaimer}</p>
    </div>
  );
}

export function WorkspaceAdvisorChatPanel() {
  const enabled = isAdvisorChatEnabledClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionPaymentContext, setSessionPaymentContext] =
    useState<Partial<PaymentAdvisorPaymentContextInput> | null>(null);

  const canSend = useMemo(() => draft.trim().length > 0 && !loading, [draft, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/advisor/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          messages: [...messages, userMessage].map((item) => ({
            role: item.role,
            content: item.content,
          })),
          ...(sessionPaymentContext ? { sessionPaymentContext } : {}),
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        answer?: string;
        error?: string;
        sessionPaymentContext?: Partial<PaymentAdvisorPaymentContextInput>;
        recommendation?: PaymentAdvisorResponse['recommendation'];
        alternatives?: PaymentAdvisorResponse['alternatives'];
        reasons?: PaymentAdvisorResponse['reasons'];
        tradeoffs?: PaymentAdvisorResponse['tradeoffs'];
        unknowns?: PaymentAdvisorResponse['unknowns'];
        monitoring?: PaymentAdvisorResponse['monitoring'];
        evidence?: PaymentAdvisorResponse['evidence'];
        dataFreshness?: PaymentAdvisorResponse['dataFreshness'];
        explanation?: PaymentAdvisorResponse['explanation'];
        scenarioComparison?: PaymentAdvisorResponse['scenarioComparison'];
        intent?: PaymentAdvisorResponse['intent'];
        paymentContext?: PaymentAdvisorResponse['paymentContext'];
        parameterUsage?: PaymentAdvisorResponse['parameterUsage'];
        toolUsed?: string;
        whatCouldChange?: string[];
      };

      if (!response.ok) {
        setError(payload.error ?? 'Unable to reach Provvy Advisor.');
        return;
      }

      if (payload.ok === false) {
        setError(payload.error ?? 'Provvy could not answer that question.');
        return;
      }

      if (payload.sessionPaymentContext) {
        setSessionPaymentContext(payload.sessionPaymentContext);
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: payload.answer ?? 'No answer returned.',
          intelligence: {
            intent: payload.intent!,
            paymentContext: payload.paymentContext!,
            parameterUsage: payload.parameterUsage!,
            recommendation: payload.recommendation ?? null,
            alternatives: payload.alternatives ?? [],
            reasons: payload.reasons ?? [],
            tradeoffs: payload.tradeoffs ?? [],
            unknowns: payload.unknowns ?? [],
            explanation: payload.explanation ?? null,
            scenarioComparison: payload.scenarioComparison ?? null,
            monitoring: payload.monitoring ?? null,
            evidence: payload.evidence ?? [],
            dataFreshness: payload.dataFreshness!,
            toolUsed: payload.toolUsed,
            whatCouldChange: payload.whatCouldChange,
          },
        },
      ]);
    } catch {
      setError('Unable to reach Provvy Advisor.');
    } finally {
      setLoading(false);
    }
  }

  if (!enabled) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
        Ask Provvy
      </div>
      <p className="mt-1 text-[12px] text-ink-soft">
        Natural-language payment rail questions grounded in Provvy deterministic intelligence.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {ADVISOR_SUGGESTED_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            disabled={loading}
            onClick={() => {
              setDraft(question);
              void sendMessage(question);
            }}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:border-primary/40 hover:bg-accent disabled:opacity-60"
          >
            {question}
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-border bg-background/60 p-3">
        {messages.length === 0 ? (
          <p className="text-[13px] text-ink-soft">
            Try the flagship demo: paying an Indonesian supplier A$100,000.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === 'user'
                  ? 'ml-8 rounded-xl bg-accent px-3 py-2 text-[13px] text-foreground'
                  : 'mr-8 rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-foreground'
              }
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.role === 'assistant' && message.intelligence ? (
                <IntelligenceCard intelligence={message.intelligence} />
              ) : null}
            </div>
          ))
        )}
        {loading ? (
          <p className="inline-flex items-center gap-2 text-[13px] text-ink-soft">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Provvy is checking payment intelligence…
          </p>
        ) : null}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about payment rails, costs, alternatives, or Wise health…"
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] outline-none ring-primary/30 focus:ring-2"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!canSend}
          className="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-2.5 text-primary-foreground disabled:opacity-60"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>

      {error ? <p className="mt-3 text-[13px] text-destructive">{error}</p> : null}
    </section>
  );
}
