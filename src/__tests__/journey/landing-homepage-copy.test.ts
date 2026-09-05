import fs from 'fs';
import path from 'path';

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('homepage narrative and control principles', () => {
  const landing = read('components/journey/lovable/journey-landing-page.tsx');
  const intelligenceUi = read('components/journey/lovable/landing-payment-intelligence.tsx');
  const watchlist = read('components/journey/lovable/landing-rail-watchlist.tsx');
  const demo = read('components/journey/lovable/landing-watch-provvy-think.tsx');
  const story = read('components/journey/lovable/landing-public-to-personal.tsx');
  const search = read('components/journey/lovable/landing-payment-search.tsx');
  const results = read('components/journey/lovable/landing-comparison-results.tsx');
  const advisor = read('lib/journey/landing-advisor.ts');
  const advisorUi = read('components/journey/lovable/landing-advisor.tsx');
  const feed = read('lib/journey/payment-intelligence-feed.ts');
  const rank = read('lib/journey/payment-intelligence-rank.ts');
  const labels = read('lib/journey/landing-result-labels.ts');
  const providerSearch = read('lib/journey/landing-provider-search.ts');
  const comparison = read('lib/journey/landing-route-comparison.ts');
  const model = read('lib/journey/landing-route-model.ts');
  const intelligence = read('lib/journey/landing-route-intelligence.ts');
  const surface = `${landing}\n${intelligenceUi}\n${watchlist}\n${demo}\n${story}`;

  it('opens as payment intelligence around an intact search', () => {
    expect(landing).toContain('Provvy payment intelligence');
    expect(landing).toContain('Payment infrastructure changes every day.');
    expect(landing).toContain('what it means for your business');
    expect(landing).toContain('LandingPaymentSearch');
    expect(landing).toContain('LandingPaymentIntelligence');
    expect(landing.indexOf('<LandingPaymentIntelligence')).toBeLessThan(
      landing.lastIndexOf('<LandingPaymentSearch')
    );
    expect(landing).toContain('Compare routes');
    expect(landing).not.toContain('Introducing the Commercial Operating System');
    expect(landing).not.toContain('Run your business');
    expect(landing).not.toContain('before it reaches accounting');
    expect(landing).not.toContain('Get a recommendation <ArrowRight');
    expect(landing).not.toContain('From a useful first answer');
    expect(surface).not.toMatch(/live payment network/i);
    expect(surface).not.toMatch(/transaction volume/i);
  });

  it('holds the brand line and personalisation ask for after a comparison', () => {
    expect(landing).toContain('Every payment has a best route.');
    expect(labels).toContain("Provvy's best match");
    expect(results).toContain('Connect your business');
    expect(results).toContain('Want Provvy to rank these using your actual business context?');
    expect(search).toContain('Anyone can explore this payment.');
    expect(providerSearch).toContain('payment routes');
    expect(results).not.toContain('Compared routes');
    expect(results).not.toContain('Sign up');
    expect(results).not.toContain('Create account');
    expect(results).not.toContain('Start free trial');
    expect(model).toContain('LANDING_CONTEXT_SIGNALS');
    expect(model).toContain('cash position');
    expect(intelligence).toContain('payment history');
    expect(intelligence).toContain('FX exposure');
    expect(intelligence).toContain('approval requirements');
    expect(comparison).toContain('rankLandingRoutes');
    expect(comparison).toContain('offerings');
  });

  it('states the product layers and keeps the Commercial OS line further down', () => {
    expect(landing).toContain('Discovery is public.');
    expect(landing).toContain('Intelligence is personalised.');
    expect(landing).toContain('Execution is authorised.');
    expect(story).toContain('Discovery is public.');
    expect(landing).toContain('Accounting records what happened.');
    expect(landing).toContain("Provvy coordinates what&apos;s happening now.");
    expect(landing).toContain('sits above that');
  });

  it('keeps the owner in control and does not position Provvy as autonomous management', () => {
    expect(story).toContain('You stay in control');
    expect(story).toContain('You decide what to authorise.');
    expect(story).toContain('recommend → approve');
    expect(`${surface}\n${search}\n${results}\n${advisor}\n${advisorUi}`).not.toMatch(/AI CEO/i);
    expect(`${surface}\n${search}\n${results}\n${advisor}\n${advisorUi}`).not.toMatch(/AI runs your business/i);
    expect(`${surface}\n${search}\n${results}\n${advisor}\n${advisorUi}`).not.toMatch(/autonomous AI employee/i);
    expect(`${surface}\n${search}\n${results}\n${advisor}\n${advisorUi}`).not.toMatch(/AI decides for you/i);
    expect(`${surface}\n${search}\n${results}\n${advisor}\n${advisorUi}`).not.toMatch(/chatbot/i);
    expect(`${surface}\n${search}\n${results}\n${advisor}\n${advisorUi}`).not.toMatch(/copilot/i);
    expect(advisor).toContain('presentAdvisor');
    expect(advisor).toContain('action?:');
    expect(advisor).toContain('PROVVY ADVISOR');
    expect(advisor).toContain('Based on your current criteria');
    expect(advisor).toContain('Recommendation changed');
    expect(advisorUi).toContain('Provvy Advisor');
    expect(advisorUi).not.toMatch(/Need help\?/);
    expect(advisorUi).not.toMatch(/<textarea|<input type="text"/);
    expect(`${landing}\n${search}\n${results}\n${advisor}\n${advisorUi}`).not.toMatch(/Ask me anything/i);
    expect(advisor).not.toContain('Sign up');
    expect(advisor).not.toContain('Start free trial');
  });

  it('grounds the intelligence layer in a catalog snapshot, not fake live data', () => {
    expect(feed).toContain('catalog snapshot');
    expect(feed).toContain('https://www.rba.gov.au/media-releases/2026/mr-26-17.html');
    expect(feed).toContain('https://www.swift.com/news-events/news/transforming-consumer-payments-banks-roll-out-new-framework-retail-transactions');
    expect(rank).toContain('rankPaymentIntelligence');
    expect(rank).toContain('searchHintForItem');
    expect(advisor).toContain('show-affected-routes');
    expect(advisor).toContain('thisMattersBecause');
    expect(rank).toContain('This matters because');
    expect(search).toContain('registerCompare');
    expect(intelligenceUi).toContain('PAYMENT_SIGNAL_LABELS');
    expect(intelligenceUi).toContain('not live quotes');
    expect(watchlist).toContain('10 payment rails Provvy is watching today');
    expect(demo).toContain('Watch Provvy think about a payment');
    expect(feed).not.toMatch(/live transaction/i);
  });

  it('keeps workflow and pricing anchors used by the rest of the product', () => {
    expect(landing).toContain('id="workflow-library"');
    expect(landing).toContain('id="pricing"');
    expect(landing).toContain('30 days of Professional');
    expect(landing).toContain('CALENDLY_CONSULTATION_URL');
  });
});
