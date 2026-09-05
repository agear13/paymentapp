import fs from 'fs';
import path from 'path';

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('homepage narrative and control principles', () => {
  const landing = read('components/journey/lovable/journey-landing-page.tsx');
  const search = read('components/journey/lovable/landing-payment-search.tsx');
  const results = read('components/journey/lovable/landing-comparison-results.tsx');
  const advisor = read('lib/journey/landing-advisor.ts');
  const advisorUi = read('components/journey/lovable/landing-advisor.tsx');
  const labels = read('lib/journey/landing-result-labels.ts');
  const providerSearch = read('lib/journey/landing-provider-search.ts');
  const comparison = read('lib/journey/landing-route-comparison.ts');
  const model = read('lib/journey/landing-route-model.ts');
  const intelligence = read('lib/journey/landing-route-intelligence.ts');

  it('opens as a payment decision tool, not an OS manifesto', () => {
    expect(landing).toContain("What&apos;s the best way to move this money?");
    expect(landing).toContain(
      "Compare payment routes. Then connect Provvy to find what&apos;s best for your business."
    );
    expect(landing).not.toContain('Introducing the Commercial Operating System');
    expect(landing).not.toContain('Run your business');
    expect(landing).not.toContain('before it reaches accounting');
    expect(landing).toContain('Compare routes');
    expect(landing).not.toContain('Get a recommendation <ArrowRight');
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

  it('states the three product layers and the Commercial OS line further down', () => {
    expect(landing).toContain('Discovery is public.');
    expect(landing).toContain('Intelligence is personalised.');
    expect(landing).toContain('Execution is authorised.');
    expect(landing).toContain('Accounting records what happened.');
    expect(landing).toContain("Provvy coordinates what&apos;s happening now.");
    expect(landing).toContain('sits above that');
  });

  it('keeps the owner in control and does not position Provvy as autonomous management', () => {
    expect(landing).toContain('You stay in control');
    expect(landing).toContain('You decide what to authorise.');
    expect(landing).toContain('recommend → approve');
    expect(`${landing}\n${search}\n${results}\n${advisor}\n${advisorUi}`).not.toMatch(/AI CEO/i);
    expect(`${landing}\n${search}\n${results}\n${advisor}\n${advisorUi}`).not.toMatch(/AI runs your business/i);
    expect(`${landing}\n${search}\n${results}\n${advisor}\n${advisorUi}`).not.toMatch(/autonomous AI employee/i);
    expect(`${landing}\n${search}\n${results}\n${advisor}\n${advisorUi}`).not.toMatch(/AI decides for you/i);
    expect(`${landing}\n${search}\n${results}\n${advisor}\n${advisorUi}`).not.toMatch(/chatbot/i);
    expect(`${landing}\n${search}\n${results}\n${advisor}\n${advisorUi}`).not.toMatch(/copilot/i);
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

  it('keeps workflow and pricing anchors used by the rest of the product', () => {
    expect(landing).toContain('id="workflow-library"');
    expect(landing).toContain('id="pricing"');
    expect(landing).toContain('30 days of Professional');
    expect(landing).toContain('CALENDLY_CONSULTATION_URL');
  });
});
