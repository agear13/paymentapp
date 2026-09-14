import { runAdvisorChat } from '@/lib/advisor/advisor-chat-orchestrator.server';

describe('advisor chat orchestrator', () => {
  it('grounds flagship demo in deterministic tool output without LLM', async () => {
    const result = await runAdvisorChat({
      message: 'How should I pay my Indonesian supplier A$100,000?',
      intelligence: {},
      useLlm: false,
    });

    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.routingMode).toBe('deterministic');
    expect(result.toolUsed).toBe('recommend_payment_rail');
    expect(result.sessionPaymentContext.amount).toBe(100_000);
    expect(result.recommendation).not.toBeNull();
    expect(result.answer).toMatch(/Wise|Airwallex|recommend/i);
    expect(result.dataFreshness.pricingKind).toBe('indicative_catalogue');
  });

  it('inherits payment context for Airwallex follow-up', async () => {
    const first = await runAdvisorChat({
      message: 'I need to pay an Indonesian supplier A$100k.',
      intelligence: {},
      useLlm: false,
    });
    expect('error' in first).toBe(false);
    if ('error' in first) return;

    const second = await runAdvisorChat({
      message: 'What about Airwallex?',
      sessionPaymentContext: first.sessionPaymentContext,
      intelligence: {},
      useLlm: false,
    });
    expect('error' in second).toBe(false);
    if ('error' in second) return;

    expect(second.toolUsed).toBe('compare_payment_rail');
    expect(second.sessionPaymentContext.amount).toBe(100_000);
    expect(second.sessionPaymentContext.destination).toBe('ID');
    expect(second.scenarioComparison?.scenarioOffering).not.toBeNull();
  });

  it('does not fabricate monitoring when unavailable', async () => {
    const result = await runAdvisorChat({
      message: 'Are there any problems with Wise right now?',
      intelligence: {},
      useLlm: false,
    });
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.monitoring?.status).toBe('unavailable');
    expect(result.answer).not.toMatch(/all systems operational/i);
  });
});
