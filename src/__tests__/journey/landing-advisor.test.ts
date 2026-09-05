import {
  ADVISOR_PERSONALISE_SUPPORT,
  ADVISOR_SUBSCRIBE_LINES,
  ADVISOR_VISION_LINES,
  EMPTY_ADVISOR_CONTEXT,
  advisorExcludeDigitalDollarFilters,
  advisorFilterNote,
  presentAdvisor,
  type AdvisorContext,
} from '@/lib/journey/landing-advisor';
import { EMPTY_LANDING_FILTERS } from '@/lib/journey/landing-provider-search';

function context(patch: Partial<AdvisorContext>): AdvisorContext {
  return { ...EMPTY_ADVISOR_CONTEXT, ...patch, connected: false };
}

describe('presentAdvisor', () => {
  it('introduces itself as the intelligence layer, not a chat or payment rail', () => {
    const presentation = presentAdvisor(
      context({ stage: 'welcome', showThemeChoice: true })
    );
    expect(presentation.eyebrow).toBe('PROVVY ADVISOR');
    expect(presentation.status).toBe('Watching payment infrastructure');
    expect(presentation.conclusion).toBe("Hi, I'm Provvy.");
    expect(presentation.lines.join(' ')).toMatch(
      /Tell me what you're trying to pay below and I'll show you the routes available/
    );
    expect(presentation.lines.join(' ')).toMatch(
      /The more I know about your business, the smarter my recommendations become/
    );
    expect(presentation.actions.map((action) => action.id)).toEqual(['see-how-provvy-works']);
    expect(presentation.lines.join(' ')).not.toMatch(/lighter or darker/i);
    expect(presentation.lines.join(' ')).not.toMatch(/live quote/i);
    expect(JSON.stringify(presentation)).not.toMatch(/cash balance/i);
    expect(JSON.stringify(presentation)).not.toMatch(/\bChat\b/);
    expect(JSON.stringify(presentation)).not.toMatch(/textarea|Ask me anything/i);
    expect(JSON.stringify(presentation)).not.toMatch(/payment provider|another payment rail/i);
  });

  it('keeps the introduction until the visitor compares a payment', () => {
    const presentation = presentAdvisor(
      context({
        stage: 'search',
        origin: 'AU',
        destination: 'ID',
        highlightedIntelligenceId: 'rba-psr-review-2026-06',
      })
    );
    expect(presentation.conclusion).toBe("Hi, I'm Provvy.");
    expect(presentation.lines.join(' ')).toMatch(/Tell me what you're trying to pay below/i);
    expect(presentation.lines.join(' ')).toMatch(/smarter my recommendations become/i);
    expect(presentation.actions.map((action) => action.id)).toEqual(['see-how-provvy-works']);
    expect(JSON.stringify(presentation)).not.toMatch(/live quote|minutes ago/i);
  });

  it('reveals the longer-term role without overpromising live data', () => {
    const presentation = presentAdvisor(context({ stage: 'welcome' }), 'see-how-provvy-works');
    expect(presentation.lines.join(' ')).toContain(ADVISOR_VISION_LINES[0]);
    expect(presentation.lines.join(' ')).toMatch(/extra pair of hands/i);
    expect(JSON.stringify(presentation)).not.toMatch(/I can see your|live FX/i);
  });

  it('skips theme choice when a preference already exists', () => {
    const presentation = presentAdvisor(context({ stage: 'search', showThemeChoice: false }));
    expect(presentation.actions.map((action) => action.id)).toEqual(['see-how-provvy-works']);
    expect(presentation.lines.join(' ')).not.toMatch(/lighter or darker/i);
  });

  it('after a search, frames the public answer and asks the visitor to connect', () => {
    const presentation = presentAdvisor(
      context({
        stage: 'results',
        origin: 'AU',
        destination: 'ID',
        amount: 10000,
        currency: 'AUD',
        transactionType: 'supplier_payment',
        priority: 'lowest_cost',
        recommendedProvider: 'Wise',
        recommendedProviderId: 'wise',
        resultCount: 9,
      })
    );
    expect(presentation.status).toBe('Based on your current criteria');
    expect(presentation.criteria).toEqual(
      expect.arrayContaining(['Australia → Indonesia', 'Supplier payment', 'Lowest total cost'])
    );
    expect(presentation.criteria.join(' ')).toMatch(/10,000/);
    expect(presentation.conclusion).toMatch(
      /You're comparing a .* supplier payment from Australia to Indonesia/
    );
    expect(presentation.lines.join(' ')).toMatch(
      /These results are based on the transaction details you've given me/
    );
    expect(presentation.lines).toContain(ADVISOR_PERSONALISE_SUPPORT);
    expect(presentation.lines).toEqual(expect.arrayContaining([...ADVISOR_SUBSCRIBE_LINES]));
    expect(presentation.actions[0]).toEqual({
      id: 'personalise',
      label: 'Connect your business',
    });
    expect(presentation.actions[1]).toEqual({
      id: 'see-how-provvy-works',
      label: 'See how Provvy works',
    });
    expect(presentation.actions[2]).toEqual({
      id: 'get-payment-intelligence',
      label: 'Get Payment Intelligence',
      href: '#payment-intelligence-inbox',
    });
    expect(presentation.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining(['Why is this #1?', "What's faster?", "What's simpler?"])
    );
    expect(JSON.stringify(presentation)).not.toMatch(/live FX/i);
    expect(JSON.stringify(presentation)).not.toMatch(/your Wise account/i);
  });

  it('keeps ranking questions secondary after a highlighted development', () => {
    const presentation = presentAdvisor(
      context({
        stage: 'results',
        origin: 'AU',
        destination: 'ID',
        amount: 10000,
        currency: 'AUD',
        transactionType: 'supplier_payment',
        priority: 'lowest_cost',
        recommendedProvider: 'Wise',
        recommendedProviderId: 'wise',
        highlightedIntelligenceId: 'swift-retail-framework-2026-03',
      })
    );
    expect(presentation.conclusion).toMatch(/You're comparing a/);
    expect(presentation.lines.join(' ')).toMatch(/This matters because/);
    expect(presentation.actions[0]?.label).toBe('Connect your business');
    expect(presentation.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining(['Why is this #1?', "What's faster?", "What's simpler?"])
    );
  });

  it('exposes ranking context when asked why a route is first', () => {
    const presentation = presentAdvisor(
      context({
        stage: 'results',
        priority: 'lowest_cost',
        transactionType: 'supplier_payment',
        recommendedProvider: 'Wise',
        recommendedProviderId: 'wise',
        recommendationReason:
          'Provvy puts Wise first for lowest total cost among the indicative routes shown.',
        productName: 'International transfer',
        paymentMethodLabel: 'Bank transfer',
        indicativeCostLabel: '~A$70–100',
        arrivalLabel: '1–2 business days',
        setupLabel: 'Low — account required',
        characteristics: 'Low cost, Fast enough, Low setup',
        knownLimitation: 'Recipient must accept a local bank deposit.',
      }),
      'why-first'
    );
    expect(presentation.conclusion).toMatch(/Wise is the strongest starting point/i);
    const text = presentation.lines.join(' ');
    expect(text).toMatch(/lowest total cost is the current priority/i);
    expect(text).toMatch(/supplier payment/i);
    expect(text).toMatch(/Provvy puts Wise first/i);
    expect(text).toMatch(/Typical estimated total: ~A\$70–100/);
    expect(text).toMatch(/Typical arrival: 1–2 business days/);
    expect(text).toMatch(/Typical setup: Low — account required/);
    expect(text).toMatch(/International transfer \(Bank transfer\)/);
    expect(text).toMatch(/Recipient must accept a local bank deposit/);
    expect(text).toMatch(/typical route characteristics, not live quotes/i);
    expect(text).not.toMatch(/I can see your/i);
  });

  it('updates like an analysis when the visitor optimises for speed', () => {
    const presentation = presentAdvisor(
      context({
        stage: 'results',
        priority: 'fastest',
        priorityChanged: true,
        recommendedProvider: 'Digital-dollar transfer',
        recommendedProviderId: 'digital_dollar',
      })
    );
    expect(presentation.status).toBe('Recommendation changed');
    expect(presentation.lines.join(' ')).toMatch(
      /Digital-dollar transfer is now the strongest starting point because speed is your priority/
    );
    expect(JSON.stringify(presentation)).not.toMatch(/stablecoin/i);
    expect(JSON.stringify(presentation)).not.toMatch(/blockchain/i);
    expect(presentation.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining([
        'Connect your business',
        'See how Provvy works',
        'Why is this fastest?',
        'What is digital-dollar?',
        "What's simpler?",
      ])
    );
    const explained = presentAdvisor(
      context({
        stage: 'results',
        priority: 'fastest',
        priorityChanged: true,
        recommendedProvider: 'Digital-dollar transfer',
        recommendedProviderId: 'digital_dollar',
      }),
      'what-is-digital-dollar'
    );
    expect(explained.explainer?.body).toMatch(/compatible wallets or accounts/i);
    expect(explained.explainer?.body).not.toMatch(/crypto|stablecoin|blockchain/i);
    expect(explained.explainer?.action?.label).toBe("Show me routes that don't require this");
  });

  it('updates when the visitor optimises for simplicity without naming their bank', () => {
    const presentation = presentAdvisor(
      context({
        stage: 'results',
        priority: 'simplest',
        priorityChanged: true,
        recommendedProvider: 'Your bank',
        recommendedProviderId: 'bank',
      })
    );
    expect(presentation.status).toBe('Recommendation changed');
    expect(presentation.lines.join(' ')).toMatch(
      /Your existing bank is now the strongest starting point because simplicity is your priority/
    );
    expect(presentation.conclusion).not.toMatch(/Westpac|NAB|ANZ|CommBank|your bank is CommBank/i);
    expect(
      presentAdvisor(
        context({
          stage: 'results',
          priority: 'simplest',
          recommendedProvider: 'Your bank',
          recommendedProviderId: 'bank',
        }),
        'why-first'
      ).lines.join(' ')
    ).toMatch(/I do not know which bank you actually use/);
  });

  it('acknowledges a payment-method filter in one sentence', () => {
    const note = advisorFilterNote({
      ...EMPTY_LANDING_FILTERS,
      paymentMethods: ['bank_transfer'],
    });
    expect(note).toBe(
      "You've narrowed this to bank-transfer routes. The comparison now excludes the other payment methods."
    );
    const presentation = presentAdvisor(
      context({
        stage: 'results',
        priority: 'lowest_cost',
        recommendedProvider: 'Wise',
        recommendedProviderId: 'wise',
        filterNote: note,
      })
    );
    expect(presentation.status).toBe('Criteria updated');
    expect(presentation.lines).toContain(note);
    expect(presentation.lines.filter((line) => line === note)).toHaveLength(1);
  });

  it('can exclude digital-dollar routes after explaining them', () => {
    const note = advisorFilterNote(advisorExcludeDigitalDollarFilters());
    expect(note).toBe("You've narrowed this to routes that don't require a digital-dollar setup.");
  });
});
