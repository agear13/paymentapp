import { compareLandingRoutes } from '@/lib/journey/landing-route-comparison';
import {
  FLAGSHIP_ADVISOR_PAYMENT,
  toLandingSearchQuery,
} from '@/lib/advisor/payment-advisor-context';
import { runPaymentAdvisorTool } from '@/lib/advisor/payment-advisor-tools';

describe('payment advisor tools', () => {
  it('recommend_payment_rail returns engine recommendation without hardcoding', () => {
    const engine = compareLandingRoutes(toLandingSearchQuery(FLAGSHIP_ADVISOR_PAYMENT));
    const result = runPaymentAdvisorTool('recommend_payment_rail', FLAGSHIP_ADVISOR_PAYMENT);
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.tool).toBe('recommend_payment_rail');
    expect(result.recommendation?.offeringId).toBe(engine.recommendedOffering.id);
    expect(result.recommendation?.pricing.kind).toBe('indicative_catalogue');
    expect(result.whatCouldChange?.length).toBeGreaterThan(0);
  });

  it('explain_payment_recommendation returns deterministic reasons', () => {
    const result = runPaymentAdvisorTool('explain_payment_recommendation', FLAGSHIP_ADVISOR_PAYMENT);
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.tool).toBe('explain_payment_recommendation');
    expect(result.explanation).not.toBeNull();
    expect(result.explanation?.summary.length).toBeGreaterThan(0);
    expect(result.answer.length).toBeGreaterThan(0);
  });

  it('compare_payment_rail uses catalogue data for Airwallex', () => {
    const result = runPaymentAdvisorTool('compare_payment_rail', FLAGSHIP_ADVISOR_PAYMENT);
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.scenarioComparison?.scenarioProviderId).toBe('airwallex');
    expect(result.scenarioComparison?.scenarioOffering?.pricing.live).toBe(false);
    expect(result.scenarioComparison?.scenarioOffering?.pricing.kind).toBe('indicative_catalogue');
  });

  it('check_payment_rail_health reports unavailable monitoring honestly', () => {
    const result = runPaymentAdvisorTool('check_payment_rail_health', FLAGSHIP_ADVISOR_PAYMENT);
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.monitoring?.status).toBe('unavailable');
    expect(result.monitoring?.freshness.label).toMatch(/No Wise Payments observation/i);
    expect(result.dataFreshness.monitoringKind).toBe('unavailable');
  });
});
