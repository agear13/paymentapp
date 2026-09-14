import {
  buildDeterministicRouting,
  extractPaymentPatchesFromMessage,
  mergeAdvisorPaymentContext,
  routeAdvisorToolFromMessage,
} from '@/lib/advisor/payment-advisor-nl';
import { FLAGSHIP_ADVISOR_PAYMENT } from '@/lib/advisor/payment-advisor-context';

describe('payment-advisor NL extraction', () => {
  it('extracts flagship Indonesian supplier A$100,000 payment context', () => {
    const patches = extractPaymentPatchesFromMessage(
      'How should I pay my Indonesian supplier A$100,000?'
    );
    expect(patches.origin).toBe('AU');
    expect(patches.destination).toBe('ID');
    expect(patches.amount).toBe(100_000);
    expect(patches.sourceCurrency).toBe('AUD');
    expect(patches.destinationCurrency).toBe('IDR');
    expect(patches.transactionType).toBe('supplier_payment');
  });

  it('extracts lowest cost priority', () => {
    const patches = extractPaymentPatchesFromMessage("What's cheapest?");
    expect(patches.priority).toBe('lowest_cost');
  });

  it('extracts fastest priority', () => {
    const patches = extractPaymentPatchesFromMessage('Which is fastest?');
    expect(patches.priority).toBe('fastest');
  });

  it('routes Airwallex follow-up to compare tool', () => {
    expect(routeAdvisorToolFromMessage('What if I use Airwallex instead?')).toBe(
      'compare_payment_rail'
    );
  });

  it('routes Wise health questions to monitoring tool', () => {
    expect(routeAdvisorToolFromMessage('Are there any problems with Wise right now?')).toBe(
      'check_payment_rail_health'
    );
  });

  it('routes explanation questions to explain tool', () => {
    expect(routeAdvisorToolFromMessage('Why did you recommend Wise?')).toBe(
      'explain_payment_recommendation'
    );
  });
});

describe('conversation payment context merge', () => {
  it('inherits session payment context for follow-up Airwallex question', () => {
    const session = mergeAdvisorPaymentContext(undefined, {
      origin: 'AU',
      destination: 'ID',
      amount: 100_000,
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      transactionType: 'supplier_payment',
      priority: 'balanced',
    });

    const routed = buildDeterministicRouting('What about Airwallex?', session);
    expect(routed.tool).toBe('compare_payment_rail');
    expect(routed.payment.amount).toBe(100_000);
    expect(routed.payment.destination).toBe('ID');
    expect(routed.payment.priority).toBe(FLAGSHIP_ADVISOR_PAYMENT.priority);
  });

  it('overrides priority when follow-up asks for lowest cost', () => {
    const session = mergeAdvisorPaymentContext(undefined, {
      origin: 'AU',
      destination: 'ID',
      amount: 100_000,
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      transactionType: 'supplier_payment',
      priority: 'balanced',
    });

    const routed = buildDeterministicRouting('What if lowest cost is my priority?', session);
    expect(routed.tool).toBe('recommend_payment_rail');
    expect(routed.payment.priority).toBe('lowest_cost');
  });
});
